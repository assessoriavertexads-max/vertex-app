import { useState } from 'react';
import { Plus, Zap, Trash2, Loader2, MessageSquare, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_EVENTS: { value: string; label: string; description: string; group: string }[] = [
  // CRM
  { value: 'lead_stage_change',       label: 'Lead muda de estágio',          description: 'Dispara quando um lead é movido para um estágio específico no funil.',                      group: 'CRM' },
  { value: 'new_lead_created',        label: 'Novo lead criado',               description: 'Dispara toda vez que um novo lead é cadastrado no CRM.',                                   group: 'CRM' },
  { value: 'lead_closed',             label: 'Lead fechado (ganho)',            description: 'Dispara especificamente quando um lead é marcado como Fechado (Ganho).',                   group: 'CRM' },
  // Tarefas
  { value: 'task_completed',          label: 'Tarefa concluída',               description: 'Dispara quando qualquer tarefa é marcada como concluída.',                                 group: 'Tarefas' },
  { value: 'task_created',            label: 'Nova tarefa criada',             description: 'Dispara quando uma nova tarefa é adicionada ao sistema.',                                  group: 'Tarefas' },
  // Empresas
  { value: 'new_company_created',     label: 'Nova empresa cadastrada',        description: 'Dispara quando uma nova empresa é registrada.',                                            group: 'Empresas' },
  { value: 'company_status_change',   label: 'Status da empresa muda',         description: 'Dispara quando o status de uma empresa é alterado para um valor específico.',             group: 'Empresas' },
  // Financeiro
  { value: 'transaction_paid',        label: 'Pagamento recebido',             description: 'Dispara quando uma transação financeira é marcada como paga.',                            group: 'Financeiro' },
  { value: 'new_transaction_created', label: 'Nova transação criada',          description: 'Dispara quando uma nova transação financeira é registrada.',                              group: 'Financeiro' },
  // Agendado (via cron diário)
  { value: 'task_due_soon',           label: 'Tarefa prestes a vencer',        description: 'Executa automaticamente X dias antes do vencimento de tarefas em aberto.',                group: 'Agendado' },
  { value: 'task_due_today',          label: 'Tarefa vence hoje',              description: 'Executa automaticamente no dia do vencimento de tarefas em aberto.',                      group: 'Agendado' },
  { value: 'transaction_due_soon',    label: 'Cobrança prestes a vencer',      description: 'Executa automaticamente X dias antes do vencimento de cobranças pendentes.',             group: 'Agendado' },
  { value: 'transaction_due_today',   label: 'Cobrança vence hoje',            description: 'Executa automaticamente no dia do vencimento de cobranças pendentes.',                   group: 'Agendado' },
];

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospecção',
  negotiation: 'Negociação',
  legal: 'Análise Jurídica',
  closed: 'Fechado (Ganho)',
};

const COMPANY_STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  'stand-by': 'Stand-by',
  inativo: 'Inativo',
  cancelado: 'Cancelado',
  churn: 'Churn',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  normal: 'Normal',
};

const ACTION_TYPES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: 'create_task', label: 'Criar Tarefa', icon: ClipboardList },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp', icon: MessageSquare },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface ActionData {
  // create_task
  task_name?: string;
  task_priority?: string;
  task_description?: string;
  due_in_days?: number;
  // send_whatsapp
  message_template?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_value: string;
  action_type: string;
  action_data: ActionData;
  enabled: boolean;
  created_at: string;
}

// ── Modal ──────────────────────────────────────────────────────────────────

function RuleModal({ isOpen, onClose, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<AutomationRule, 'id' | 'created_at'>) => void;
}) {
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('lead_stage_change');
  const [triggerValue, setTriggerValue] = useState('negotiation');
  const [actionType, setActionType] = useState('create_task');
  // create_task fields
  const [taskName, setTaskName] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDesc, setTaskDesc] = useState('');
  const [dueInDays, setDueInDays] = useState(3);
  // send_whatsapp fields
  const [messageTemplate, setMessageTemplate] = useState('');

  const reset = () => {
    setName(''); setTriggerEvent('lead_stage_change'); setTriggerValue('negotiation');
    setActionType('create_task'); setTaskName(''); setTaskPriority('normal');
    setTaskDesc(''); setDueInDays(3); setMessageTemplate('');
  };

  // Variables available per trigger for the template hint
  const templateVars: Record<string, string[]> = {
    lead_stage_change:        ['{lead_name}', '{company_name}'],
    new_lead_created:         ['{lead_name}', '{company_name}'],
    lead_closed:              ['{lead_name}', '{company_name}'],
    task_completed:           ['{task_name}', '{company_name}'],
    task_created:             ['{task_name}', '{company_name}'],
    new_company_created:      ['{company_name}'],
    company_status_change:    ['{company_name}'],
    transaction_paid:         ['{entity_name}', '{company_name}'],
    new_transaction_created:  ['{entity_name}', '{company_name}'],
    task_due_soon:            ['{task_name}', '{company_name}', '{due_date}'],
    task_due_today:           ['{task_name}', '{company_name}'],
    transaction_due_soon:     ['{entity_name}', '{company_name}', '{due_date}'],
    transaction_due_today:    ['{entity_name}', '{company_name}'],
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe um nome para a regra.'); return; }
    if (actionType === 'create_task' && !taskName.trim()) { toast.error('Informe o título da tarefa.'); return; }
    if (actionType === 'send_whatsapp' && !messageTemplate.trim()) { toast.error('Informe o template da mensagem.'); return; }

    const resolvedTriggerValue =
      triggerEvent === 'lead_stage_change'       ? triggerValue :
      triggerEvent === 'lead_closed'             ? 'closed' :
      triggerEvent === 'company_status_change'   ? triggerValue :
      triggerEvent === 'task_due_soon'           ? triggerValue :
      triggerEvent === 'transaction_due_soon'    ? triggerValue :
      triggerEvent === 'task_due_today'          ? 'today' :
      triggerEvent === 'transaction_due_today'   ? 'today' :
      'any';

    const resolvedEvent = triggerEvent === 'lead_closed' ? 'lead_stage_change' : triggerEvent;

    const actionData: ActionData =
      actionType === 'create_task'
        ? { task_name: taskName.trim(), task_priority: taskPriority, task_description: taskDesc.trim() || undefined, due_in_days: dueInDays }
        : { message_template: messageTemplate.trim() };

    onSave({
      name: name.trim(),
      trigger_event: resolvedEvent,
      trigger_value: resolvedTriggerValue,
      action_type: actionType,
      action_data: actionData,
      enabled: true,
    });
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Nova Regra de Automação
          </DialogTitle>
          <DialogDescription>Configure um gatilho e a ação que será executada automaticamente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome da Regra *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Criar proposta ao entrar em Negociação" autoFocus />
          </div>

          {/* Gatilho */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gatilho — Quando isso acontecer</p>

            <div className="grid gap-2">
              <Label>Tipo de evento</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={triggerEvent}
                onChange={e => {
                  const ev = e.target.value;
                  setTriggerEvent(ev);
                  if (ev === 'lead_stage_change') setTriggerValue('negotiation');
                  else if (ev === 'company_status_change') setTriggerValue('ativo');
                  else if (ev === 'task_due_soon' || ev === 'transaction_due_soon') setTriggerValue('5');
                  else setTriggerValue('any');
                }}
              >
                {['CRM', 'Tarefas', 'Empresas', 'Financeiro', 'Agendado'].map(group => (
                  <optgroup key={group} label={group}>
                    {TRIGGER_EVENTS.filter(t => t.group === group).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_EVENTS.find(t => t.value === triggerEvent)?.description}
              </p>
            </div>

            {triggerEvent === 'lead_stage_change' && (
              <div className="grid gap-2">
                <Label>Estágio destino</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={triggerValue}
                  onChange={e => setTriggerValue(e.target.value)}
                >
                  {Object.entries(STAGE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {triggerEvent === 'company_status_change' && (
              <div className="grid gap-2">
                <Label>Novo status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={triggerValue}
                  onChange={e => setTriggerValue(e.target.value)}
                >
                  {Object.entries(COMPANY_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {(triggerEvent === 'task_due_soon' || triggerEvent === 'transaction_due_soon') && (
              <div className="grid gap-2">
                <Label>Quantos dias antes do vencimento</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={triggerValue}
                  onChange={e => setTriggerValue(e.target.value)}
                >
                  {[1, 2, 3, 5, 7, 10, 15].map(d => (
                    <option key={d} value={String(d)}>{d} dia{d > 1 ? 's' : ''} antes</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  O sistema verifica diariamente às 08h e dispara a ação para os itens que vencem exatamente nessa data.
                </p>
              </div>
            )}
          </div>

          {/* Ação */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ação — Então fazer isso</p>

            <div className="grid gap-2">
              <Label>Tipo de ação</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACTION_TYPES.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setActionType(a.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      actionType === a.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <a.icon className="h-4 w-4" />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {actionType === 'create_task' && (
              <>
                <div className="grid gap-2">
                  <Label>Título da Tarefa *</Label>
                  <Input
                    value={taskName}
                    onChange={e => setTaskName(e.target.value)}
                    placeholder="Ex: Preparar proposta para {lead_name}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {(templateVars[triggerEvent] ?? []).map(v => (
                      <code key={v} className="bg-muted px-1 rounded mr-1">{v}</code>
                    ))}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value)}
                    >
                      {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Vencimento (dias)</Label>
                    <Input type="number" min={1} max={90} value={dueInDays} onChange={e => setDueInDays(Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Descrição (opcional)</Label>
                  <Input value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Detalhes adicionais..." />
                </div>
              </>
            )}

            {actionType === 'send_whatsapp' && (
              <div className="grid gap-2">
                <Label>Mensagem *</Label>
                <Textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  placeholder="Ex: Olá! Seu lead {lead_name} avançou no funil. Precisamos de atenção."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {(templateVars[triggerEvent] ?? []).map(v => (
                    <code key={v} className="bg-muted px-1 rounded mr-1">{v}</code>
                  ))}
                  · Enviado para o WhatsApp da empresa vinculada.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit">Criar Regra</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Rule card helpers ──────────────────────────────────────────────────────

function triggerSummary(rule: AutomationRule): string {
  const ev = TRIGGER_EVENTS.find(t => t.value === rule.trigger_event || (rule.trigger_event === 'lead_stage_change' && t.value === 'lead_closed' && rule.trigger_value === 'closed'));
  switch (rule.trigger_event) {
    case 'lead_stage_change':
      return rule.trigger_value === 'closed'
        ? 'Quando lead for fechado (ganho)'
        : `Quando lead mover para "${STAGE_LABELS[rule.trigger_value] ?? rule.trigger_value}"`;
    case 'new_lead_created':      return 'Quando um novo lead for criado';
    case 'task_completed':        return 'Quando uma tarefa for concluída';
    case 'task_created':          return 'Quando uma nova tarefa for criada';
    case 'new_company_created':   return 'Quando uma nova empresa for cadastrada';
    case 'company_status_change': return `Quando status da empresa mudar para "${COMPANY_STATUS_LABELS[rule.trigger_value] ?? rule.trigger_value}"`;
    case 'transaction_paid':        return 'Quando um pagamento for recebido';
    case 'new_transaction_created': return 'Quando uma nova transação for criada';
    case 'task_due_soon':           return `${rule.trigger_value} dia(s) antes do vencimento de tarefas`;
    case 'task_due_today':          return 'No dia do vencimento de tarefas';
    case 'transaction_due_soon':    return `${rule.trigger_value} dia(s) antes do vencimento de cobranças`;
    case 'transaction_due_today':   return 'No dia do vencimento de cobranças';
    default: return ev?.label ?? rule.trigger_event;
  }
}

function actionSummary(rule: AutomationRule): string {
  if (rule.action_type === 'create_task') {
    const ad = rule.action_data;
    return `Criar tarefa "${ad.task_name}" · prioridade ${PRIORITY_LABELS[ad.task_priority ?? 'normal'] ?? ad.task_priority}${ad.due_in_days ? ` · vence em ${ad.due_in_days} dia(s)` : ''}`;
  }
  if (rule.action_type === 'send_whatsapp') {
    const preview = (rule.action_data.message_template ?? '').substring(0, 60);
    return `Enviar WhatsApp: "${preview}${preview.length === 60 ? '…' : ''}"`;
  }
  return rule.action_type;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Automation() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createRule = useMutation({
    mutationFn: async (rule: Omit<AutomationRule, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('automation_rules').insert(rule);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); toast.success('Regra criada!'); },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('automation_rules').update({ enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); toast.success('Regra removida.'); },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automação</h1>
          <p className="text-muted-foreground text-sm mt-1">Regras automáticas disparadas por eventos no CRM e no financeiro</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Regra
        </Button>
      </div>

      {/* Gatilhos disponíveis */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Gatilhos disponíveis</p>
        <div className="space-y-3">
          {['CRM', 'Tarefas', 'Empresas', 'Financeiro', 'Agendado'].map(group => (
            <div key={group}>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{group}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {TRIGGER_EVENTS.filter(t => t.group === group).map(t => (
                  <div key={t.value} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
                    <Zap className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${group === 'Agendado' ? 'text-blue-500' : 'text-amber-500'}`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{t.label}</p>
                      {group === 'Agendado' && (
                        <p className="text-xs text-muted-foreground mt-0.5">via cron diário 08h</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações disponíveis */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ações disponíveis</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTION_TYPES.map(a => (
            <div key={a.value} className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <a.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {a.value === 'create_task' ? 'Cria uma tarefa vinculada ao lead e à empresa.' : 'Envia mensagem pelo WhatsApp da empresa vinculada ao lead.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RuleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={rule => createRule.mutate(rule)} />

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Zap className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Nenhuma regra criada</p>
          <p className="text-sm text-muted-foreground">Crie sua primeira automação para economizar tempo no fluxo do CRM.</p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}</p>
          {rules.map(rule => {
            const ActionIcon = ACTION_TYPES.find(a => a.value === rule.action_type)?.icon ?? Zap;
            return (
              <div key={rule.id} className={`rounded-xl border p-4 transition-opacity ${rule.enabled ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${rule.enabled ? 'bg-amber-500/10' : 'bg-muted'}`}>
                      <Zap className={`h-4 w-4 ${rule.enabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-sm text-foreground">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">Gatilho:</span> {triggerSummary(rule)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ActionIcon className="h-3 w-3 shrink-0" />
                        {actionSummary(rule)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={enabled => toggleRule.mutate({ id: rule.id, enabled })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => deleteRule.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
