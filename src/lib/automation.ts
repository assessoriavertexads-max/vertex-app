import { supabase } from './supabase';

export interface AutomationContext {
  entityTitle?: string;      // task name, company name, lead title, transaction category
  companyId?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
}

export async function runAutomations(
  triggerEvent: string,
  triggerValue: string,
  context: AutomationContext = {},
): Promise<{ executed: number; ruleName?: string }> {
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_event', triggerEvent)
    .eq('trigger_value', triggerValue)
    .eq('enabled', true);

  if (!rules?.length) return { executed: 0 };

  // Resolve default list for task creation
  let listId: string | null = null;
  const { data: existingList } = await supabase.from('lists').select('id').limit(1).maybeSingle();
  listId = existingList?.id ?? null;
  if (!listId) {
    const { data: space } = await supabase.from('spaces').insert({ name: 'Operacional' }).select('id').single();
    if (space) {
      const { data: list } = await supabase.from('lists').insert({ name: 'Geral', space_id: space.id }).select('id').single();
      listId = list?.id ?? null;
    }
  }

  // Resolve company phone/name if not provided
  let phone = context.companyPhone ?? null;
  let companyName = context.companyName ?? null;
  if (context.companyId && (!phone || !companyName)) {
    const { data: co } = await supabase.from('companies').select('name, phone').eq('id', context.companyId).single();
    phone = phone ?? co?.phone ?? null;
    companyName = companyName ?? co?.name ?? null;
  }

  const entityTitle = context.entityTitle ?? '';

  const replaceVars = (template: string) =>
    template
      .replace(/\{lead_name\}/g, entityTitle)
      .replace(/\{task_name\}/g, entityTitle)
      .replace(/\{entity_name\}/g, entityTitle)
      .replace(/\{company_name\}/g, companyName ?? '');

  let executed = 0;

  for (const rule of rules) {
    const ad = rule.action_data as {
      task_name?: string;
      task_priority?: string;
      task_description?: string;
      due_in_days?: number;
      message_template?: string;
    };

    if (rule.action_type === 'create_task' && listId && ad.task_name) {
      const taskName = replaceVars(ad.task_name);
      const dueDate = ad.due_in_days
        ? new Date(Date.now() + ad.due_in_days * 86400000).toISOString().slice(0, 10)
        : null;
      await supabase.from('tasks').insert({
        name: taskName,
        description: ad.task_description ? replaceVars(ad.task_description) : `Criado automaticamente por "${rule.name}"`,
        priority: ad.task_priority || 'normal',
        due_date: dueDate,
        company_id: context.companyId || null,
        list_id: listId,
        status: 'a_receber',
      });
      executed++;
    }

    if (rule.action_type === 'send_whatsapp' && phone && ad.message_template) {
      const message = replaceVars(ad.message_template);
      const raw = phone.replace(/\D/g, '');
      const formattedPhone = raw.startsWith('55') ? raw : `55${raw}`;
      await supabase.functions.invoke('evolution-proxy', {
        body: { action: 'sendMessage', phone: formattedPhone, message },
      });
      executed++;
    }
  }

  return { executed, ruleName: rules.length === 1 ? rules[0].name : undefined };
}
