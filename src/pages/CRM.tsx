import { useState } from 'react';
import { DndContext, DragEndEvent, closestCorners, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Building2, DollarSign, Clock, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { EditLeadModal } from '@/components/crm/EditLeadModal';
import { LeadInsert, LeadWithCompany } from '@/lib/backend-types';

const COLUMNS = [
  { id: 'prospect', title: 'Prospecção', color: 'border-slate-200 bg-slate-100/50' },
  { id: 'negotiation', title: 'Negociação', color: 'border-blue-200 bg-blue-50/50' },
  { id: 'legal', title: 'Análise Jurídica', color: 'border-amber-200 bg-amber-50/50' },
  { id: 'closed', title: 'Fechado (Ganho)', color: 'border-emerald-200 bg-emerald-50/50' },
];

const LeadCard = ({ lead, onEdit }: { lead: LeadWithCompany; onEdit: (lead: LeadWithCompany) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: lead,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const companyName = lead.companies?.name || 'Empresa não vinculada';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors ${
        isDragging ? 'opacity-50 ring-2 ring-blue-500 shadow-xl z-50 relative' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-800 text-sm leading-tight pr-2">{lead.title}</h4>
        <button
          className="text-slate-400 hover:text-blue-600 shrink-0 p-0.5 rounded transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
        <Building2 className="w-3.5 h-3.5" />
        {companyName}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 font-medium text-emerald-600 text-sm">
          <DollarSign className="w-3.5 h-3.5" />
          {Number(lead.estimated_value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" /> Hoje
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, leads, onEdit }: { column: typeof COLUMNS[0]; leads: LeadWithCompany[]; onEdit: (lead: LeadWithCompany) => void }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          {column.title}
          <span className="bg-slate-200 text-slate-600 text-xs py-0.5 px-2 rounded-full">
            {leads.length}
          </span>
        </h3>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-3 min-h-[500px] transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50/50' : column.color
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onEdit={onEdit} />
        ))}
        {leads.length === 0 && !isOver && (
          <div className="text-center p-4 text-sm text-slate-400 font-medium">
            Arraste um lead para cá
          </div>
        )}
      </div>
    </div>
  );
};

export const CRM = () => {
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithCompany | null>(null);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, isError } = useQuery<LeadWithCompany[]>({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createLead = useMutation({
    mutationFn: async ({ lead, newCompany }: { lead: LeadInsert; newCompany?: { name: string; phone?: string; document?: string } }) => {
      let companyId = lead.company_id ?? null;

      if (newCompany?.name) {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', newCompany.name.trim())
          .maybeSingle();

        if (existing) {
          companyId = existing.id;
        } else {
          const { data: created, error: createErr } = await supabase
            .from('companies')
            .insert({ name: newCompany.name, phone: newCompany.phone || null, document: newCompany.document || null, status: 'ativo' })
            .select('id')
            .single();
          if (createErr) throw createErr;
          companyId = created.id;
          toast.success(`Empresa "${newCompany.name}" criada com sucesso!`);
        }
      }

      const { error } = await supabase.from('leads').insert({ ...lead, company_id: companyId });
      if (error) throw error;
      return { title: lead.title, companyId };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['companies-dropdown'] });
      toast.success('Lead criado com sucesso!');

      // Executa automações do tipo new_lead_created
      try {
        const { data: rules } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('trigger_event', 'new_lead_created')
          .eq('trigger_value', 'any')
          .eq('enabled', true);

        if (!rules?.length) return;

        const { data: existingList } = await supabase.from('lists').select('id').limit(1).maybeSingle();
        let listId = existingList?.id ?? null;
        if (!listId) {
          const { data: space } = await supabase.from('spaces').insert({ name: 'Operacional' }).select('id').single();
          if (space) {
            const { data: list } = await supabase.from('lists').insert({ name: 'Geral', space_id: space.id }).select('id').single();
            listId = list?.id ?? null;
          }
        }

        let companyPhone: string | null = null;
        let companyName: string | null = null;
        if (result.companyId) {
          const { data: co } = await supabase.from('companies').select('name, phone').eq('id', result.companyId).single();
          companyPhone = co?.phone ?? null;
          companyName = co?.name ?? null;
        }

        for (const rule of rules) {
          const ad = rule.action_data as { task_name?: string; task_priority?: string; task_description?: string; due_in_days?: number; message_template?: string };

          if (rule.action_type === 'create_task' && listId && ad.task_name) {
            const taskName = (ad.task_name).replace('{lead_name}', result.title || '');
            const dueDate = ad.due_in_days
              ? new Date(Date.now() + ad.due_in_days * 86400000).toISOString().slice(0, 10)
              : null;
            await supabase.from('tasks').insert({
              name: taskName,
              description: ad.task_description || `Criado automaticamente por "${rule.name}"`,
              priority: ad.task_priority || 'normal',
              due_date: dueDate,
              company_id: result.companyId || null,
              list_id: listId,
              status: 'a_receber',
            });
          }

          if (rule.action_type === 'send_whatsapp' && companyPhone && ad.message_template) {
            const message = ad.message_template
              .replace('{lead_name}', result.title || '')
              .replace('{company_name}', companyName || '');
            const raw = companyPhone.replace(/\D/g, '');
            const phone = raw.startsWith('55') ? raw : `55${raw}`;
            await supabase.functions.invoke('evolution-proxy', { body: { action: 'sendMessage', phone, message } });
          }
        }

        if (rules.length === 1) toast.success(`Automação executada: "${rules[0].name}"`);
        else if (rules.length > 1) toast.success(`${rules.length} automações executadas`);
      } catch {
        // Automação falhou silenciosamente
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar lead: ${err.message}`);
    },
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, funnel_stage }: { id: string; funnel_stage: string }) => {
      if (funnel_stage === 'legal') {
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, title, company_id, legal_status, estimated_value')
          .eq('id', id)
          .single();
        if (leadError) throw leadError;

        const isContractSigned = typeof lead.legal_status === 'string' && /assinado|signed/i.test(lead.legal_status);

        if (isContractSigned) {
          let companyId = lead.company_id;

          if (!companyId) {
            const { data: existingCompany } = await supabase
              .from('companies')
              .select('id')
              .eq('name', lead.title)
              .limit(1)
              .maybeSingle();

            companyId = existingCompany?.id || null;
          }

          if (!companyId) {
            const { data: insertedCompany, error: insertError } = await supabase
              .from('companies')
              .insert({
                name: lead.title,
                status: 'ativo',
                custom_data: { created_from_lead: lead.id },
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            companyId = insertedCompany.id;
            toast.success('Empresa criada automaticamente em Empresas.');
          }

          await supabase.from('leads').update({ funnel_stage, company_id: companyId }).eq('id', id);

          if (companyId) {
            const { data: transactionExists, error: txCheckError } = await supabase
              .from('financial_transactions')
              .select('id')
              .eq('company_id', companyId)
              .eq('type', 'income')
              .eq('amount', Number(lead.estimated_value) || 0)
              .eq('category', lead.title)
              .eq('status', 'pending')
              .limit(1)
              .maybeSingle();

            if (txCheckError && txCheckError.code !== 'PGRST116') throw txCheckError;

            if (!transactionExists) {
              const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
              const { error: transactionError } = await supabase.from('financial_transactions').insert({
                company_id: companyId,
                type: 'income',
                amount: Number(lead.estimated_value) || 0,
                due_date: dueDate,
                category: lead.title,
                status: 'pending',
                subscription_cycle: null,
              });

              if (transactionError) throw transactionError;
              toast.success('Cobrança criada automaticamente no Financeiro.');
            }
          }

          return;
        }
      }

      const { error } = await supabase.from('leads').update({ funnel_stage }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, funnel_stage }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData<LeadWithCompany[]>(['leads']);
      queryClient.setQueryData(['leads'], (old: LeadWithCompany[] | undefined) =>
        old?.map((lead) => lead.id === id ? { ...lead, funnel_stage } : lead) ?? []
      );
      return { previousLeads };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads'], context.previousLeads);
      }
      toast.error('Erro ao mover o card.');
    },
    onSuccess: async (_, { id, funnel_stage }) => {
      try {
        const { data: rules } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('trigger_event', 'lead_stage_change')
          .eq('trigger_value', funnel_stage)
          .eq('enabled', true);

        if (!rules?.length) return;

        const cachedLeads = queryClient.getQueryData<LeadWithCompany[]>(['leads']) || [];
        const lead = cachedLeads.find(l => l.id === id);

        const { data: existingList } = await supabase.from('lists').select('id').limit(1).maybeSingle();
        let listId = existingList?.id ?? null;
        if (!listId) {
          const { data: space } = await supabase.from('spaces').insert({ name: 'Operacional' }).select('id').single();
          if (space) {
            const { data: list } = await supabase.from('lists').insert({ name: 'Geral', space_id: space.id }).select('id').single();
            listId = list?.id ?? null;
          }
        }

        let companyPhone: string | null = null;
        let companyName: string | null = null;
        if (lead?.company_id) {
          const { data: co } = await supabase.from('companies').select('name, phone').eq('id', lead.company_id).single();
          companyPhone = co?.phone ?? null;
          companyName = co?.name ?? null;
        }

        for (const rule of rules) {
          const ad = rule.action_data as { task_name?: string; task_priority?: string; task_description?: string; due_in_days?: number; message_template?: string };

          if (rule.action_type === 'create_task' && listId && ad.task_name) {
            const taskName = (ad.task_name ?? rule.name).replace('{lead_name}', lead?.title || '');
            const dueDate = ad.due_in_days
              ? new Date(Date.now() + ad.due_in_days * 86400000).toISOString().slice(0, 10)
              : null;
            await supabase.from('tasks').insert({
              name: taskName,
              description: ad.task_description || `Criado automaticamente por "${rule.name}"`,
              priority: ad.task_priority || 'normal',
              due_date: dueDate,
              company_id: lead?.company_id || null,
              list_id: listId,
              status: 'a_receber',
            });
          }

          if (rule.action_type === 'send_whatsapp' && companyPhone && ad.message_template) {
            const message = ad.message_template
              .replace('{lead_name}', lead?.title || '')
              .replace('{company_name}', companyName || '');
            const raw = companyPhone.replace(/\D/g, '');
            const phone = raw.startsWith('55') ? raw : `55${raw}`;
            await supabase.functions.invoke('evolution-proxy', { body: { action: 'sendMessage', phone, message } });
          }
        }

        queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
        if (rules.length === 1) toast.success(`Automação executada: "${rules[0].name}"`);
        else toast.success(`${rules.length} automações executadas`);
      } catch {
        // Automação falhou silenciosamente — não deve bloquear o drag
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadWithCompany> }) => {
      const { error } = await supabase.from('leads').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead atualizado!');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead excluído.');
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const newStage = String(over.id);
    const lead = leads.find((l: LeadWithCompany) => l.id === leadId);

    if (lead && lead.funnel_stage !== newStage) {
      updateLeadStage.mutate({ id: leadId, funnel_stage: newStage });
    }
  };

  const totalValue = leads.reduce((acc: number, lead: LeadWithCompany) => acc + Number(lead.estimated_value ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-red-500 text-sm">Erro ao carregar leads. Verifique sua conexão e tente novamente.</p>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM Comercial</h1>
          <p className="text-slate-500 mt-1">Gerencie suas prospecções e contratos jurídicos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg border border-emerald-200">
            <span className="text-sm block">Pipeline Total</span>
            <span className="font-bold text-lg">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setIsNewLeadOpen(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <NewLeadModal isOpen={isNewLeadOpen} onClose={() => setIsNewLeadOpen(false)} onSave={(lead, newCompany) => createLead.mutate({ lead, newCompany })} />
      <EditLeadModal
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSave={(id, data) => updateLead.mutate({ id, data })}
        onDelete={(id) => deleteLead.mutate(id)}
      />

      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full items-start">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                leads={leads.filter((lead: LeadWithCompany) => lead.funnel_stage === column.id)}
                onEdit={setEditingLead}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
};

export default CRM;
