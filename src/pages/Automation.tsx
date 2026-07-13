import { useState, useEffect } from 'react';
import {
  Plus, Zap, Trash2, Loader2, MessageSquare, ClipboardList, Mail, Share2, Pencil,
  Play, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
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
  prospect:    'Prospecção',
  negotiation: 'Negociação',
  legal:       'Análise Jurídica',
  closed:      'Fechado (Ganho)',
};

const COMPANY_STATUS_LABELS: Record<string, string> = {
  ativo:      'Ativo',
  'stand-by': 'Stand-by',
  inativo:    'Inativo',
  cancelado:  'Cancelado',
  churn:      'Churn',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta:   'Alta',
  media:  'Média',
  baixa:  'Baixa',
  normal: 'Normal',
};

const ACTION_TYPES: { value: string; label: string; icon: React.ElementType; soon?: boolean }[] = [
  { value: 'create_task',    label: 'Criar Tarefa',      icon: ClipboardList },
  { value: 'send_whatsapp',  label: 'Enviar WhatsApp',   icon: MessageSquare },
  { value: 'send_email',     label: 'Enviar E-mail',     icon: Mail },
  { value: 'post_social',    label: 'Postar nas Redes',  icon: Share2, soon: true },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface ActionData {
  // create_task
  task_name?:        string;
  task_priority?:    string;
  task_description?: string;
  due_in_days?:      number;
  // send_whatsapp
  message_template?: string;
  // send_email
  email_to?:   string;
  email_body?: string;
}

interface AutomationRule {
  id:            string;
  name:          string;
  trigger_event: string;
  trigger_value: string;
  action_type:   string;
  action_data:   ActionData;
  email_subject: string | null;
  enabled:       boolean;
  run_count:     number;
  last_run_at:   string | null;
  last_error:    string | null;
  created_at:    string;
}

// ── Template variable hints ────────────────────────────────────────────────

const templateVars: Record<string, string[]> = {
  lead_stage_change:        ['{lead_name}', '{company_name}'],
  new_lead_created:         ['{lead_name}', '{company_name}'],
  lead_closed:              ['{lead_name}', '{company_name}'],
  task_completed:           ['{task_name}', '{company_name}'],
  task_created:             ['{task_name}', '{company_name}'],
  new_company_created:      ['{company_name}'],
  company_status_change:    ['{company_name}'],
  transaction_paid:         ['{company_name}', '{description}', '{amount}', '{due_date}', '{payment_link}'],
  new_transaction_created:  ['{company_name}', '{description}', '{amount}', '{due_date}', '{payment_link}'],
  task_due_soon:            ['{task_name}', '{company_name}', '{due_date}'],
  task_due_today:           ['{task_name}', '{company_name}'],
  transaction_due_soon:     ['{company_name}', '{description}', '{amount}', '{due_date}', '{payment_link}'],
  transaction_due_today:    ['{company_name}', '{description}', '{amount}', '{due_date}', '{payment_link}'],
};

function VarHints({ event }: { event: string }) {
  const vars = templateVars[event] ?? [];
  if (!vars.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Variáveis:{' '}
      {vars.map((v) => (
        <code key={v} className="bg-muted px-1 rounded mr-1">{v}</code>
      ))}
    </p>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

function RuleModal({ isOpen, onClose, onSave, editingRule }: {
  isOpen:       boolean;
  onClose:      () => void;
  onSave:       (rule: Omit<AutomationRule, 'id' | 'created_at' | 'run_count' | 'last_run_at' | 'last_error'>) => void;
  editingRule?: AutomationRule | null;
}) {
  // Resolve initial values from editingRule (or defaults)
  const initTriggerEvent = () => {
    if (!editingRule) return 'lead_stage_change';
    if (editingRule.trigger_event === 'lead_stage_change' && editingRule.trigger_value === 'closed') return 'lead_closed';
    return editingRule.trigger_event;
  };

  const [name,         setName]         = useState(editingRule?.name ?? '');
  const [triggerEvent, setTriggerEvent] = useState(initTriggerEvent);
  const [triggerValue, setTriggerValue] = useState(() => {
    if (!editingRule) return 'negotiation';
    if (editingRule.trigger_value === 'closed') return 'negotiation';
    return editingRule.trigger_value ?? 'any';
  });
  const [actionType,   setActionType]   = useState(editingRule?.action_type ?? 'create_task');
  const [taskName,     setTaskName]     = useState(editingRule?.action_data?.task_name ?? '');
  const [taskPriority, setTaskPriority] = useState(editingRule?.action_data?.task_priority ?? 'normal');
  const [taskDesc,     setTaskDesc]     = useState(editingRule?.action_data?.task_description ?? '');
  const [dueInDays,    setDueInDays]    = useState(editingRule?.action_data?.due_in_days ?? 3);
  const [msgTemplate,  setMsgTemplate]  = useState(editingRule?.action_data?.message_template ?? '');
  const [emailSubject, setEmailSubject] = useState(editingRule?.email_subject ?? '');
  const [emailBody,    setEmailBody]    = useState(editingRule?.action_data?.email_body ?? '');

  // Preenche o formulário quando uma regra for passada para edição
  useEffect(() => {
    if (!editingRule) return;
    setName(editingRule.name ?? '');
    setTriggerEvent(initTriggerEvent());
    setTriggerValue(editingRule.trigger_value ?? 'any');
    setActionType(editingRule.action_type ?? 'create_task');
    setTaskName(editingRule.action_data?.task_name ?? '');
    setTaskPriority(editingRule.action_data?.task_priority ?? 'normal');
    setTaskDesc(editingRule.action_data?.task_description ?? '');
    setDueInDays(editingRule.action_data?.due_in_days ?? 3);
    setMsgTemplate(editingRule.action_data?.message_template ?? '');
    setEmailSubject(editingRule.email_subject ?? '');
    setEmailBody(editingRule.action_data?.email_body ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRule?.id]);

  const reset = () => {
    setName(''); setTriggerEvent('lead_stage_change'); setTriggerValue('negotiation');
    setActionType('create_task'); setTaskName(''); setTaskPriority('normal');
    setTaskDesc(''); setDueInDays(3); setMsgTemplate('');
    setEmailSubject(''); setEmailBody('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe um nome para a regra.'); return; }
    if (actionType === 'create_task'   && !taskName.trim())    { toast.error('Informe o título da tarefa.'); return; }
    if (actionType === 'send_whatsapp' && !msgTemplate.trim()) { toast.error('Informe o template da mensagem.'); return; }
    if (actionType === 'send_email'    && !emailBody.trim())   { toast.error('Informe o corpo do e-mail.'); return; }

    const resolvedTriggerValue =
      triggerEvent === 'lead_stage_change'     ? triggerValue :
      triggerEvent === 'lead_closed'           ? 'closed' :
      triggerEvent === 'company_status_change' ? triggerValue :
      triggerEvent === 'task_due_soon'         ? triggerValue :
      triggerEvent === 'transaction_due_soon'  ? triggerValue :
      triggerEvent === 'task_due_today'        ? 'today' :
      triggerEvent === 'transaction_due_today' ? 'today' :
      'any';

    const resolvedEvent = triggerEvent === 'lead_closed' ? 'lead_stage_change' : triggerEvent;

    const actionData: ActionData =
      actionType === 'create_task'
        ? { task_name: taskName.trim(), task_priority: taskPriority, task_description: taskDesc.trim() || undefined, due_in_days: dueInDays }
        : actionType === 'send_whatsapp'
        ? { message_template: msgTemplate.trim() }
        : actionType === 'send_email'
        ? { email_body: emailBody.trim() }
        : {};

    onSave({
      name:           name.trim(),
      trigger_event:  resolvedEvent,
      trigger_value:  resolvedTriggerValue,
      action_type:    actionType,
      action_data:    actionData,
      email_subject:  actionType === 'send_email' ? (emailSubject.trim() || null) : null,
      enabled:        true,
    });
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {editingRule ? 'Editar Regra de Automação' : 'Nova Regra de Automação'}
          </DialogTitle>
          <DialogDescription>Configure um gatilho e a ação que será executada automaticamente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* Nome */}
          <div className="grid gap-2">
            <Label>Nome da Regra *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lembrar cobrança 2 dias antes"
              autoFocus
            />
          </div>

          {/* ── Gatilho ─────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Gatilho — Quando isso acontecer
            </p>

            <div className="grid gap-2">
              <Label>Tipo de evento</Label>
              <Select
                value={triggerEvent}
                onValueChange={(ev) => {
                  setTriggerEvent(ev);
                  if (ev === 'lead_stage_change')     setTriggerValue('negotiation');
                  else if (ev === 'company_status_change') setTriggerValue('ativo');
                  else if (ev === 'task_due_soon' || ev === 'transaction_due_soon') setTriggerValue('5');
                  else setTriggerValue('any');
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['CRM', 'Tarefas', 'Empresas', 'Financeiro', 'Agendado'].map((group) => (
                    <div key={group}>
                      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group}</p>
                      {TRIGGER_EVENTS.filter((t) => t.group === group).map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_EVENTS.find((t) => t.value === triggerEvent)?.description}
              </p>
            </div>

            {triggerEvent === 'lead_stage_change' && (
              <div className="grid gap-2">
                <Label>Estágio destino</Label>
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {triggerEvent === 'company_status_change' && (
              <div className="grid gap-2">
                <Label>Novo status</Label>
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPANY_STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(triggerEvent === 'task_due_soon' || triggerEvent === 'transaction_due_soon') && (
              <div className="grid gap-2">
                <Label>Quantos dias antes do vencimento</Label>
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 10, 15].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} dia{d > 1 ? 's' : ''} antes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O sistema verifica diariamente às 08h e dispara para os itens que vencem exatamente nessa data.
                </p>
              </div>
            )}
          </div>

          {/* ── Ação ────────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Ação — Então fazer isso
            </p>

            <div className="grid gap-2">
              <Label>Tipo de ação</Label>
              <div className="grid grid-cols-2 gap-2">
                {ACTION_TYPES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    disabled={!!a.soon}
                    onClick={() => !a.soon && setActionType(a.value)}
                    className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      a.soon
                        ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60'
                        : actionType === a.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <a.icon className="h-4 w-4" />
                    {a.label}
                    {a.soon && (
                      <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0">
                        em breve
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* create_task fields */}
            {actionType === 'create_task' && (
              <>
                <div className="grid gap-2">
                  <Label>Título da Tarefa *</Label>
                  <Input
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="Ex: Preparar proposta para {lead_name}"
                  />
                  <VarHints event={triggerEvent} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <Select value={taskPriority} onValueChange={setTaskPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Vencimento (dias)</Label>
                    <Input
                      type="number" min={1} max={90}
                      value={dueInDays}
                      onChange={(e) => setDueInDays(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Detalhes adicionais..."
                  />
                </div>
              </>
            )}

            {/* send_whatsapp fields */}
            {actionType === 'send_whatsapp' && (
              <div className="grid gap-2">
                <Label>Mensagem *</Label>
                <Textarea
                  value={msgTemplate}
                  onChange={(e) => setMsgTemplate(e.target.value)}
                  placeholder="Ex: Olá! A cobrança {entity_name} vence em {due_date}. Entre em contato."
                  rows={4}
                />
                <VarHints event={triggerEvent} />
                <p className="text-xs text-muted-foreground">
                  Enviado para o WhatsApp da empresa vinculada.
                </p>
              </div>
            )}

            {/* send_email fields */}
            {actionType === 'send_email' && (
              <>
                <div className="grid gap-2">
                  <Label>Assunto do e-mail</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Ex: Lembrete: {entity_name} vence em {due_date}"
                  />
                  <VarHints event={triggerEvent} />
                </div>
                <div className="grid gap-2">
                  <Label>Corpo do e-mail *</Label>
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder={`Ex: Olá {company_name},\n\nEste é um lembrete de que a cobrança "{entity_name}" vence em {due_date}.\n\nEquipe Vertos`}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enviado para o e-mail da empresa vinculada. Quebras de linha são convertidas automaticamente.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit">{editingRule ? 'Salvar Alterações' : 'Criar Regra'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Rule card helpers ──────────────────────────────────────────────────────

function triggerSummary(rule: AutomationRule): string {
  switch (rule.trigger_event) {
    case 'lead_stage_change':
      return rule.trigger_value === 'closed'
        ? 'Quando lead for fechado (ganho)'
        : `Quando lead mover para "${STAGE_LABELS[rule.trigger_value] ?? rule.trigger_value}"`;
    case 'new_lead_created':        return 'Quando um novo lead for criado';
    case 'task_completed':          return 'Quando uma tarefa for concluída';
    case 'task_created':            return 'Quando uma nova tarefa for criada';
    case 'new_company_created':     return 'Quando uma nova empresa for cadastrada';
    case 'company_status_change':   return `Quando status da empresa mudar para "${COMPANY_STATUS_LABELS[rule.trigger_value] ?? rule.trigger_value}"`;
    case 'transaction_paid':        return 'Quando um pagamento for recebido';
    case 'new_transaction_created': return 'Quando uma nova transação for criada';
    case 'task_due_soon':           return `${rule.trigger_value} dia(s) antes do vencimento de tarefas`;
    case 'task_due_today':          return 'No dia do vencimento de tarefas';
    case 'transaction_due_soon':    return `${rule.trigger_value} dia(s) antes do vencimento de cobranças`;
    case 'transaction_due_today':   return 'No dia do vencimento de cobranças';
    default: return rule.trigger_event;
  }
}

function actionSummary(rule: AutomationRule): string {
  const ad = rule.action_data;
  if (rule.action_type === 'create_task') {
    return `Criar tarefa "${ad.task_name}" · prioridade ${PRIORITY_LABELS[ad.task_priority ?? 'normal'] ?? ad.task_priority}${ad.due_in_days ? ` · vence em ${ad.due_in_days} dia(s)` : ''}`;
  }
  if (rule.action_type === 'send_whatsapp') {
    const preview = (ad.message_template ?? '').substring(0, 60);
    return `Enviar WhatsApp: "${preview}${preview.length === 60 ? '…' : ''}"`;
  }
  if (rule.action_type === 'send_email') {
    const subj = rule.email_subject ?? ad.email_body?.substring(0, 40) ?? '';
    return `Enviar e-mail: "${subj}${subj.length >= 40 ? '…' : ''}"`;
  }
  return rule.action_type;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Automation() {
  const queryClient = useQueryClient();
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [editingRule,   setEditingRule]   = useState<AutomationRule | null>(null);

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
    mutationFn: async (rule: Omit<AutomationRule, 'id' | 'created_at' | 'run_count' | 'last_run_at' | 'last_error'>) => {
      const { error } = await supabase.from('automation_rules').insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Regra criada!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, rule }: { id: string; rule: Omit<AutomationRule, 'id' | 'created_at' | 'run_count' | 'last_run_at' | 'last_error'> }) => {
      const { error } = await supabase.from('automation_rules').update(rule).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setEditingRule(null);
      toast.success('Regra atualizada!');
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Regra removida.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const [cronRunning,  setCronRunning]  = useState(false);
  const [cronResult,   setCronResult]   = useState<{ ok: boolean; data: unknown } | null>(null);

  const handleRunCronNow = async () => {
    setCronRunning(true);
    setCronResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/check-due-dates`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setCronResult({ ok: res.ok, data });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
        toast.success(`Cron disparado: ${(data as { executed?: number }).executed ?? 0} ação(ões) executada(s)`);
      } else {
        toast.error('Cron retornou erro — veja o resultado abaixo');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCronResult({ ok: false, data: { error: msg } });
      toast.error('Falha ao chamar a função: ' + msg);
    } finally {
      setCronRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automação</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Regras automáticas disparadas por eventos no CRM, financeiro e agendamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunCronNow} disabled={cronRunning}>
            {cronRunning
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Play className="h-4 w-4 mr-1" />
            }
            Disparar cron agora
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Resultado do disparo manual */}
      {cronResult && (
        <div className={`rounded-xl border p-4 text-sm ${cronResult.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}`}>
          <div className="flex items-center gap-2 font-medium mb-2">
            {cronResult.ok
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <AlertCircle className="h-4 w-4 text-red-600" />
            }
            <span className={cronResult.ok ? 'text-emerald-700' : 'text-red-700'}>
              {cronResult.ok ? 'Cron executado com sucesso' : 'Cron retornou erro'}
            </span>
          </div>
          <pre className="text-xs bg-white/80 rounded-lg p-3 overflow-x-auto border border-border text-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(cronResult.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Gatilhos disponíveis */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Gatilhos disponíveis
        </p>
        <div className="space-y-3">
          {['CRM', 'Tarefas', 'Empresas', 'Financeiro', 'Agendado'].map((group) => (
            <div key={group}>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{group}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {TRIGGER_EVENTS.filter((t) => t.group === group).map((t) => (
                  <div key={t.value} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
                    <Zap className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${group === 'Agendado' ? 'text-blue-500' : 'text-amber-500'}`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{t.label}</p>
                      {group === 'Agendado' && (
                        <p className="text-xs text-muted-foreground mt-0.5">via cron diário 12h</p>
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Ações disponíveis
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTION_TYPES.map((a) => (
            <div key={a.value} className={`flex items-start gap-2 rounded-lg bg-muted/40 p-3 ${a.soon ? 'opacity-60' : ''}`}>
              <a.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{a.label}</p>
                  {a.soon && <Badge variant="secondary" className="text-[10px] px-1 py-0">em breve</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {a.value === 'create_task'   && 'Cria uma tarefa vinculada ao lead e à empresa.'}
                  {a.value === 'send_whatsapp' && 'Envia mensagem pelo WhatsApp da empresa vinculada.'}
                  {a.value === 'send_email'    && 'Envia e-mail para o endereço cadastrado na empresa (via Resend / SendGrid).'}
                  {a.value === 'post_social'   && 'Publicação automática no Instagram, LinkedIn ou X.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RuleModal
        isOpen={isModalOpen}
        editingRule={editingRule}
        onClose={() => { setIsModalOpen(false); setEditingRule(null); }}
        onSave={(rule) => {
          if (editingRule) {
            updateRule.mutate({ id: editingRule.id, rule });
            setIsModalOpen(false);
          } else {
            createRule.mutate(rule);
          }
        }}
      />

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
          <p className="text-sm text-muted-foreground">
            Crie sua primeira automação para economizar tempo no fluxo do CRM.
          </p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
          </p>
          {rules.map((rule) => {
            const ActionIcon = ACTION_TYPES.find((a) => a.value === rule.action_type)?.icon ?? Zap;
            return (
              <div
                key={rule.id}
                className={`rounded-xl border p-4 transition-opacity ${rule.enabled ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${rule.enabled ? 'bg-amber-500/10' : 'bg-muted'}`}>
                      <Zap className={`h-4 w-4 ${rule.enabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground">{rule.name}</p>
                        {rule.run_count > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {rule.run_count}× executada{rule.run_count !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {rule.last_error && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            erro
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">Gatilho:</span>{' '}
                        {triggerSummary(rule)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ActionIcon className="h-3 w-3 shrink-0" />
                        {actionSummary(rule)}
                      </p>
                      {rule.last_error && (
                        <p className="text-xs text-red-500 break-words max-w-sm">
                          ⚠ {rule.last_error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => toggleRule.mutate({ id: rule.id, enabled })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                      onClick={() => { setEditingRule(rule); setIsModalOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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
