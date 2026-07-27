import { supabase } from './supabase';

export interface AutomationContext {
  entityTitle?: string;      // task name, company name, lead title, transaction category
  companyId?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
  // Campos de cobrança
  amount?: number | null;
  dueDate?: string | null;
  paymentLink?: string | null;
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

  // Resolve default list for task creation (optional — tasks work without list_id)
  let listId: string | null = null;
  try {
    const { data: existingList } = await supabase.from('lists').select('id').limit(1).maybeSingle();
    listId = existingList?.id ?? null;
    if (!listId) {
      const { data: space } = await supabase.from('spaces').insert({ name: 'Operacional' }).select('id').single();
      if (space) {
        const { data: list } = await supabase.from('lists').insert({ name: 'Geral', space_id: space.id }).select('id').single();
        listId = list?.id ?? null;
      }
    }
  } catch { /* lists table may not exist; tasks will be created without list_id */ }

  // Resolve company phone/name if not provided
  let phone = context.companyPhone ?? null;
  let companyName = context.companyName ?? null;
  if (context.companyId && (!phone || !companyName)) {
    const { data: co } = await supabase.from('companies').select('name, phone').eq('id', context.companyId).single();
    phone = phone ?? co?.phone ?? null;
    companyName = companyName ?? co?.name ?? null;
  }

  const entityTitle = context.entityTitle ?? '';
  const amountFormatted = context.amount != null
    ? `R$ ${Number(context.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '';
  const dueDateFormatted = context.dueDate
    ? new Date(context.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')
    : '';
  const paymentLink = context.paymentLink ?? '';

  const replaceVars = (template: string) =>
    template
      .replace(/\{lead_name\}/g, entityTitle)
      .replace(/\{task_name\}/g, entityTitle)
      .replace(/\{entity_name\}/g, entityTitle)
      .replace(/\{description\}/g, entityTitle)
      .replace(/\{company_name\}/g, companyName ?? '')
      .replace(/\{amount\}/g, amountFormatted)
      .replace(/\{valor\}/g, amountFormatted)
      .replace(/\{due_date\}/g, dueDateFormatted)
      .replace(/\{vencimento\}/g, dueDateFormatted)
      .replace(/\{payment_link\}/g, paymentLink)
      .replace(/\{link_pagamento\}/g, paymentLink);

  let executed = 0;

  for (const rule of rules) {
    const ad = rule.action_data as {
      task_name?: string;
      task_priority?: string;
      task_description?: string;
      due_in_days?: number;
      message_template?: string;
    };

    if (rule.action_type === 'create_task' && ad.task_name) {
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
        ...(listId ? { list_id: listId } : {}),
        status: 'a_receber',
      });
      executed++;
    }

    if (rule.action_type === 'send_whatsapp' && ad.message_template) {
      const target = (ad as { whatsapp_target?: string }).whatsapp_target ?? 'company';
      let targetPhone = phone;

      if (target === 'self') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('whatsapp_phone')
            .eq('id', user.id)
            .single();
          targetPhone = (profile as { whatsapp_phone?: string | null } | null)?.whatsapp_phone ?? null;
        }
      }

      if (targetPhone) {
        const message = replaceVars(ad.message_template);
        const raw = targetPhone.replace(/\D/g, '');
        const formattedPhone = raw.startsWith('55') ? raw : `55${raw}`;
        await supabase.functions.invoke('evolution-proxy', {
          body: { action: 'sendMessage', phone: formattedPhone, message },
        });
        executed++;
      }
    }
  }

  // Disparo de webhooks configurados (fire-and-forget)
  supabase
    .from('webhook_configs')
    .select('url, events')
    .eq('active', true)
    .then(({ data: webhooks }) => {
      for (const wh of webhooks ?? []) {
        const evts = wh.events as string[];
        if (evts.includes(triggerEvent) || evts.includes('*')) {
          fetch(wh.url as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: triggerEvent,
              source: 'Vertos',
              timestamp: new Date().toISOString(),
              data: {
                entityTitle: context.entityTitle,
                companyId: context.companyId,
                companyName: context.companyName,
                amount: context.amount,
                dueDate: context.dueDate,
              },
            }),
            mode: 'no-cors',
          }).catch(() => {});
        }
      }
    })
    .catch(() => {});

  return { executed, ruleName: rules.length === 1 ? rules[0].name : undefined };
}
