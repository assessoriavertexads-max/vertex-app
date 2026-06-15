import { useState } from 'react';
import {
  DndContext, DragStartEvent, DragEndEvent, DragOverlay,
  closestCorners, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import {
  Plus, Building2, DollarSign, Clock, Pencil, Loader2,
  Mail, Phone, CalendarClock, TrendingUp, Target, Timer,
  Info, Trophy, XCircle, Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { EditLeadModal } from '@/components/crm/EditLeadModal';
import { LeadInsert, LeadWithCompany } from '@/lib/backend-types';

// ── Pipeline ───────────────────────────────────────────────────────────────────
const COLUMNS = [
  {
    id: 'prospect',
    emoji: '🔍',
    title: 'Prospecção',
    color: 'border-slate-300 bg-slate-50/80',
    headerColor: 'text-slate-600',
    criteria: 'Lead identificado por tráfego pago, inbound ou prospecção ativa. Contato inicial realizado.',
  },
  {
    id: 'qualification',
    emoji: '✅',
    title: 'Qualificação (SDR)',
    color: 'border-violet-200 bg-violet-50/80',
    headerColor: 'text-violet-700',
    criteria: 'SDR confirmou: orçamento mínimo, perfil ideal de cliente e momento certo para contratar.',
  },
  {
    id: 'diagnosis',
    emoji: '🔬',
    title: 'Diagnóstico',
    color: 'border-blue-200 bg-blue-50/80',
    headerColor: 'text-blue-700',
    criteria: 'Reunião de briefing realizada com o tomador de decisão (CEO/Diretor). Dores e objetivos mapeados.',
  },
  {
    id: 'proposal',
    emoji: '📋',
    title: 'Proposta Comercial',
    color: 'border-indigo-200 bg-indigo-50/80',
    headerColor: 'text-indigo-700',
    criteria: 'Escopo, prazos, entregáveis e valores apresentados em reunião com o tomador de decisão.',
  },
  {
    id: 'negotiation',
    emoji: '🤝',
    title: 'Negociação',
    color: 'border-amber-200 bg-amber-50/80',
    headerColor: 'text-amber-700',
    criteria: 'Ajuste de escopo, alinhamento de cláusulas contratuais e quebra de objeções em andamento.',
  },
  {
    id: 'won',
    emoji: '🏆',
    title: 'Fechado (Ganho)',
    color: 'border-emerald-300 bg-emerald-50/80',
    headerColor: 'text-emerald-700',
    criteria: 'Contrato assinado. Empresa e cobrança criadas automaticamente. Iniciar onboarding.',
  },
  {
    id: 'lost',
    emoji: '❌',
    title: 'Perdido',
    color: 'border-red-200 bg-red-50/80',
    headerColor: 'text-red-600',
    criteria: 'Oportunidade não convertida. Registre o motivo para melhorar a abordagem futura.',
  },
];

const LOSS_REASONS = [
  'Preço alto demais',
  'Escolheu a concorrência',
  'Sem orçamento no momento',
  'Momento errado',
  'Sem resposta',
  'Proposta não aprovada',
  'Outro',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysSince(dateStr?: string) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function tempBadge(days: number, stage: string) {
  if (['won', 'lost'].includes(stage)) return null;
  if (days <= 3)  return { label: 'Novo',       cls: 'bg-emerald-100 text-emerald-700' };
  if (days <= 10) return { label: `${days}d`,   cls: 'bg-amber-100 text-amber-700' };
  return             { label: `${days}d ⚠`,    cls: 'bg-red-100 text-red-600' };
}

// ── LeadCard ───────────────────────────────────────────────────────────────────
const LeadCard = ({ lead, onEdit }: { lead: LeadWithCompany; onEdit: (l: LeadWithCompany) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: lead,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const days  = daysSince(lead.created_at);
  const temp  = tempBadge(days, lead.funnel_stage ?? '');
  const meeting = lead.scheduled_at
    ? new Date(lead.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white p-3.5 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-md transition-all ${
        isDragging ? 'opacity-40 ring-2 ring-blue-400 shadow-xl z-50 relative' : ''
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2 gap-1">
        <h4 className="font-semibold text-slate-800 text-sm leading-tight flex-1">{lead.title}</h4>
        <button
          className="text-slate-300 hover:text-blue-500 shrink-0 p-0.5 rounded transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Empresa */}
      {lead.companies?.name && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
          <Building2 className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="truncate">{lead.companies.name}</span>
        </div>
      )}

      {/* Email */}
      {lead.email && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.email}</span>
        </div>
      )}

      {/* Telefone (só se sem email) */}
      {lead.phone && !lead.email && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
          <Phone className="w-3 h-3 shrink-0" />
          {lead.phone}
        </div>
      )}

      {/* Motivo de perda */}
      {lead.funnel_stage === 'lost' && lead.loss_reason && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 mt-1 bg-red-50 px-2 py-1 rounded-md">
          <XCircle className="w-3 h-3 shrink-0" />
          {lead.loss_reason}
        </div>
      )}

      {/* Reunião agendada */}
      {meeting && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-1.5 bg-blue-50 px-2 py-1 rounded-md">
          <CalendarClock className="w-3 h-3 shrink-0" />
          Reunião: {meeting}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1 font-semibold text-emerald-600 text-sm">
          <DollarSign className="w-3.5 h-3.5" />
          {Number(lead.estimated_value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1.5">
          {temp && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${temp.cls}`}>
              {temp.label}
            </span>
          )}
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {lead.source === 'form' ? 'Form' : 'Manual'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── KanbanColumn ───────────────────────────────────────────────────────────────
const [criteriaOpen, setCriteriaOpen] = [null as string | null, (_: string | null) => {}];

const KanbanColumn = ({
  column,
  leads,
  onEdit,
  onCriteriaClick,
  activeCriteria,
}: {
  column: typeof COLUMNS[0];
  leads: LeadWithCompany[];
  onEdit: (l: LeadWithCompany) => void;
  onCriteriaClick: (id: string | null) => void;
  activeCriteria: string | null;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const colValue = leads.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column Header */}
      <div className="mb-2.5 px-1">
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-sm flex items-center gap-1.5 ${column.headerColor}`}>
            <span>{column.emoji}</span>
            {column.title}
            <span className="bg-white border border-current/20 text-xs py-0.5 px-1.5 rounded-full font-medium ml-0.5">
              {leads.length}
            </span>
          </h3>
          <button
            className="text-slate-300 hover:text-slate-500 transition-colors"
            onClick={() => onCriteriaClick(activeCriteria === column.id ? null : column.id)}
            title="Critérios de passagem"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
        {colValue > 0 && (
          <p className="text-xs text-slate-400 mt-0.5 pl-0.5">
            R$ {colValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
        {activeCriteria === column.id && (
          <div className="mt-1.5 p-2 rounded-lg bg-white border border-slate-200 shadow-sm text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-700 block mb-0.5">Critério de passagem</span>
            {column.criteria}
          </div>
        )}
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl border-2 border-dashed p-2.5 flex flex-col gap-2.5 min-h-[480px] transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50/60 scale-[1.01]' : column.color
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onEdit={onEdit} />
        ))}
        {leads.length === 0 && !isOver && (
          <div className="text-center p-6 text-xs text-slate-400">
            Arraste um lead para cá
          </div>
        )}
      </div>
    </div>
  );
};

// ── Metrics Bar ────────────────────────────────────────────────────────────────
const MetricsBar = ({ leads }: { leads: LeadWithCompany[] }) => {
  const active   = leads.filter(l => !['won', 'lost'].includes(l.funnel_stage ?? ''));
  const won      = leads.filter(l => l.funnel_stage === 'won');
  const lost     = leads.filter(l => l.funnel_stage === 'lost');
  const pipeline = active.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const wonValue = won.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const total    = won.length + lost.length;
  const winRate  = total > 0 ? Math.round((won.length / total) * 100) : 0;
  const avgDays  = won.length > 0
    ? Math.round(won.reduce((s, l) => {
        const a = new Date(l.created_at ?? Date.now()).getTime();
        const b = new Date(l.won_at ?? Date.now()).getTime();
        return s + (b - a) / 86400000;
      }, 0) / won.length)
    : 0;

  const cards = [
    { icon: <Flame className="w-4 h-4 text-amber-500" />,    label: 'Leads Ativos',    value: active.length,     sub: `${lost.length} perdidos` },
    { icon: <TrendingUp className="w-4 h-4 text-blue-500" />, label: 'Pipeline Ativo',  value: `R$ ${pipeline.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, sub: `${active.length} oportunidades` },
    { icon: <Trophy className="w-4 h-4 text-emerald-500" />, label: 'Taxa de Ganho',   value: `${winRate}%`,     sub: `R$ ${wonValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} ganhos` },
    { icon: <Timer className="w-4 h-4 text-violet-500" />,   label: 'Ciclo Médio',     value: avgDays > 0 ? `${avgDays} dias` : '—', sub: 'da prospecção ao fechamento' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="stat-card flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {c.icon} {c.label}
          </div>
          <p className="text-xl font-bold text-foreground">{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
};

// ── Loss Reason Modal ──────────────────────────────────────────────────────────
const LossReasonModal = ({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason) { toast.error('Selecione o motivo de perda'); return; }
    onConfirm(reason);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" /> Motivo de Perda
          </DialogTitle>
          <DialogDescription>
            Registrar o motivo ajuda a melhorar o processo comercial e evitar o mesmo erro.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {LOSS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                reason === r
                  ? 'border-red-400 bg-red-50 text-red-700 font-medium'
                  : 'border-border hover:border-slate-300 hover:bg-muted/50 text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason}>
            Confirmar perda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Main CRM ───────────────────────────────────────────────────────────────────
export const CRM = () => {
  const [isNewLeadOpen,   setIsNewLeadOpen]   = useState(false);
  const [editingLead,     setEditingLead]     = useState<LeadWithCompany | null>(null);
  const [activeLeadId,    setActiveLeadId]    = useState<string | null>(null);
  const [activeCriteria,  setActiveCriteria]  = useState<string | null>(null);
  const [lostModal,       setLostModal]       = useState(false);
  const [pendingLostId,   setPendingLostId]   = useState<string | null>(null);
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const { data: leads = [], isLoading, isError } = useQuery<LeadWithCompany[]>({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, title, company_id, estimated_value, funnel_stage, legal_status, status, email, phone, notes, scheduled_at, source, loss_reason, won_at, lost_at, created_at, companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Create Lead ──────────────────────────────────────────────────────────────
  const createLead = useMutation({
    mutationFn: async ({ lead, newCompany }: { lead: LeadInsert; newCompany?: { name: string; phone?: string; document?: string } }) => {
      let companyId = lead.company_id ?? null;

      if (newCompany?.name) {
        const { data: existing } = await supabase
          .from('companies').select('id').ilike('name', newCompany.name.trim()).maybeSingle();
        if (existing) {
          companyId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from('companies')
            .insert({ name: newCompany.name, phone: newCompany.phone || null, document: newCompany.document || null, status: 'ativo' })
            .select('id').single();
          if (error) throw error;
          companyId = created.id;
          toast.success(`Empresa "${newCompany.name}" criada!`);
        }
      }

      const { error } = await supabase.from('leads').insert({ ...lead, company_id: companyId });
      if (error) throw error;
      return { title: lead.title, companyId };
    },
    onSuccess: async (result) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['companies-dropdown'] });
      toast.success('Lead criado!');
      await runAutomations('new_lead_created', 'any', result);
    },
    onError: (e: Error) => toast.error(`Erro ao criar lead: ${e.message}`),
  });

  // ── Update Stage ─────────────────────────────────────────────────────────────
  const updateLeadStage = useMutation({
    mutationFn: async ({ id, funnel_stage, loss_reason }: { id: string; funnel_stage: string; loss_reason?: string }) => {
      const updateData: Record<string, unknown> = { funnel_stage };
      if (loss_reason)              updateData.loss_reason = loss_reason;
      if (funnel_stage === 'won')   updateData.won_at      = new Date().toISOString();
      if (funnel_stage === 'lost')  updateData.lost_at     = new Date().toISOString();

      if (funnel_stage === 'won') {
        const { data: lead } = await supabase
          .from('leads').select('id, title, company_id, estimated_value').eq('id', id).single();

        if (lead) {
          let companyId = lead.company_id;

          if (!companyId) {
            const { data: existing } = await supabase
              .from('companies').select('id').ilike('name', lead.title).limit(1).maybeSingle();
            if (existing) {
              companyId = existing.id;
            } else {
              const { data: created, error } = await supabase
                .from('companies')
                .insert({ name: lead.title, status: 'ativo', custom_data: { created_from_lead: lead.id } })
                .select('id').single();
              if (!error) {
                companyId = created.id;
                toast.success('Empresa criada automaticamente em Empresas.');
              }
            }
            if (companyId) updateData.company_id = companyId;
          }

          if (companyId && lead.estimated_value) {
            const { data: txExists } = await supabase
              .from('financial_transactions').select('id')
              .eq('company_id', companyId).eq('type', 'income')
              .eq('amount', Number(lead.estimated_value)).limit(1).maybeSingle();

            if (!txExists) {
              const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
              const { error: txErr } = await supabase.from('financial_transactions').insert({
                company_id: companyId,
                type: 'income',
                amount: Number(lead.estimated_value),
                due_date: dueDate,
                category: lead.title,
                status: 'pending',
                subscription_cycle: null,
              });
              if (!txErr) toast.success('Cobrança criada automaticamente no Financeiro.');
            }
          }

          // Tarefa de onboarding
          const { data: list } = await supabase.from('lists').select('id').limit(1).maybeSingle();
          if (list) {
            const kickoffDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
            await supabase.from('tasks').insert({
              name: `Onboarding — ${lead.title}`,
              description: 'Agendar reunião de kick-off e iniciar planejamento das campanhas.',
              priority: 'alta',
              due_date: kickoffDate,
              company_id: companyId ?? null,
              list_id: list.id,
              status: 'a_receber',
            });
            toast.success('Tarefa de onboarding criada!');
          }
        }
      }

      const { error } = await supabase.from('leads').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, funnel_stage }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const prev = qc.getQueryData<LeadWithCompany[]>(['leads']);
      qc.setQueryData(['leads'], (old: LeadWithCompany[] | undefined) =>
        old?.map(l => l.id === id ? { ...l, funnel_stage } : l) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['leads'], ctx.prev);
      toast.error('Erro ao mover o card.');
    },
    onSuccess: async (_, { id, funnel_stage }) => {
      const cached = qc.getQueryData<LeadWithCompany[]>(['leads']) ?? [];
      const lead   = cached.find(l => l.id === id);
      await runAutomations('lead_stage_change', funnel_stage, { title: lead?.title ?? '', companyId: lead?.company_id ?? null });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  // ── Update Lead ──────────────────────────────────────────────────────────────
  const updateLead = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadWithCompany> }) => {
      const { error } = await supabase.from('leads').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead atualizado!'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  // ── Delete Lead ──────────────────────────────────────────────────────────────
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead excluído.'); },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  // ── Automations helper ───────────────────────────────────────────────────────
  async function runAutomations(event: string, value: string, ctx: { title?: string; companyId?: string | null }) {
    try {
      const { data: rules } = await supabase
        .from('automation_rules').select('*')
        .eq('trigger_event', event).eq('trigger_value', value).eq('enabled', true);
      if (!rules?.length) return;

      const { data: list } = await supabase.from('lists').select('id').limit(1).maybeSingle();
      const listId = list?.id ?? null;

      let companyPhone: string | null = null;
      let companyName: string | null  = null;
      if (ctx.companyId) {
        const { data: co } = await supabase.from('companies').select('name, phone').eq('id', ctx.companyId).single();
        companyPhone = co?.phone ?? null;
        companyName  = co?.name  ?? null;
      }

      for (const rule of rules) {
        const ad = rule.action_data as { task_name?: string; task_priority?: string; task_description?: string; due_in_days?: number; message_template?: string };

        if (rule.action_type === 'create_task' && listId && ad.task_name) {
          const dueDate = ad.due_in_days
            ? new Date(Date.now() + ad.due_in_days * 86400000).toISOString().slice(0, 10)
            : null;
          await supabase.from('tasks').insert({
            name: (ad.task_name).replace('{lead_name}', ctx.title ?? ''),
            description: ad.task_description || `Criado por automação "${rule.name}"`,
            priority: ad.task_priority || 'normal',
            due_date: dueDate,
            company_id: ctx.companyId || null,
            list_id: listId,
            status: 'a_receber',
          });
        }

        if (rule.action_type === 'send_whatsapp' && companyPhone && ad.message_template) {
          const message = ad.message_template
            .replace('{lead_name}', ctx.title ?? '')
            .replace('{company_name}', companyName ?? '');
          const raw   = companyPhone.replace(/\D/g, '');
          const phone = raw.startsWith('55') ? raw : `55${raw}`;
          await supabase.functions.invoke('evolution-proxy', { body: { action: 'sendMessage', phone, message } });
        }
      }

      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      if (rules.length === 1) toast.success(`Automação: "${rules[0].name}"`);
      else toast.success(`${rules.length} automações executadas`);
    } catch { /* silencioso */ }
  }

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => setActiveLeadId(String(active.id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLeadId(null);
    if (!over) return;
    const leadId   = String(active.id);
    const newStage = String(over.id);
    const lead     = leads.find(l => l.id === leadId);
    if (!lead || lead.funnel_stage === newStage) return;

    if (newStage === 'lost') {
      // Atualiza visualmente e abre modal de motivo
      qc.setQueryData(['leads'], (old: LeadWithCompany[] | undefined) =>
        old?.map(l => l.id === leadId ? { ...l, funnel_stage: 'lost' } : l) ?? []
      );
      setPendingLostId(leadId);
      setLostModal(true);
    } else {
      updateLeadStage.mutate({ id: leadId, funnel_stage: newStage });
    }
  };

  const handleConfirmLost = (reason: string) => {
    if (!pendingLostId) return;
    updateLeadStage.mutate({ id: pendingLostId, funnel_stage: 'lost', loss_reason: reason });
    setLostModal(false);
    setPendingLostId(null);
  };

  const handleCancelLost = () => {
    qc.invalidateQueries({ queryKey: ['leads'] }); // reverte visual
    setLostModal(false);
    setPendingLostId(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <Target className="w-10 h-10 text-red-400" />
        <p className="text-sm text-muted-foreground">Erro ao carregar o pipeline.</p>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['leads'] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const activeLead = leads.find(l => l.id === activeLeadId);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline Comercial</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {leads.filter(l => !['won','lost'].includes(l.funnel_stage ?? '')).length} oportunidades em andamento
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsNewLeadOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {/* KPIs */}
      <MetricsBar leads={leads} />

      {/* Modals */}
      <NewLeadModal
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
        onSave={(lead, newCompany) => createLead.mutate({ lead, newCompany })}
      />
      <EditLeadModal
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSave={(id, data) => updateLead.mutate({ id, data })}
        onDelete={(id) => deleteLead.mutate(id)}
      />
      <LossReasonModal
        open={lostModal}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveLeadId(null)}
        >
          <div className="flex gap-4 h-full items-start" style={{ minWidth: 'max-content' }}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                leads={leads.filter(l => l.funnel_stage === col.id)}
                onEdit={setEditingLead}
                onCriteriaClick={setActiveCriteria}
                activeCriteria={activeCriteria}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeLead ? (
              <div className="bg-white p-3.5 rounded-xl border border-blue-300 shadow-2xl ring-2 ring-blue-400/40 rotate-1 w-64 pointer-events-none">
                <p className="font-semibold text-slate-800 text-sm">{activeLead.title}</p>
                {activeLead.companies?.name && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {activeLead.companies.name}
                  </p>
                )}
                <p className="text-sm font-semibold text-emerald-600 mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  {Number(activeLead.estimated_value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default CRM;
