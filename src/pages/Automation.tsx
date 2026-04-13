import { useState } from 'react';
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospecção',
  negotiation: 'Negociação',
  legal: 'Análise Jurídica',
  closed: 'Fechado (Ganho)',
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  normal: 'Normal',
};

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_value: string;
  action_type: string;
  action_data: {
    task_name: string;
    task_priority: string;
    task_description?: string;
    due_in_days?: number;
  };
  enabled: boolean;
  created_at: string;
}

function RuleModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<AutomationRule, 'id' | 'created_at'>) => void;
}) {
  const [name, setName] = useState('');
  const [triggerValue, setTriggerValue] = useState('negotiation');
  const [taskName, setTaskName] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDesc, setTaskDesc] = useState('');
  const [dueInDays, setDueInDays] = useState(3);

  const reset = () => {
    setName(''); setTriggerValue('negotiation'); setTaskName('');
    setTaskPriority('normal'); setTaskDesc(''); setDueInDays(3);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe um nome para a regra.'); return; }
    if (!taskName.trim()) { toast.error('Informe o título da tarefa.'); return; }
    onSave({
      name: name.trim(),
      trigger_event: 'lead_stage_change',
      trigger_value: triggerValue,
      action_type: 'create_task',
      action_data: {
        task_name: taskName.trim(),
        task_priority: taskPriority,
        task_description: taskDesc.trim() || undefined,
        due_in_days: dueInDays,
      },
      enabled: true,
    });
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Nova Regra de Automação
          </DialogTitle>
          <DialogDescription>
            Crie uma ação automática que é executada quando um lead muda de estágio no CRM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome da Regra *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Criar proposta ao entrar em Negociação" autoFocus />
          </div>

          {/* Gatilho */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gatilho</p>
            <div className="grid gap-2">
              <Label>Quando lead mover para</Label>
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
          </div>

          {/* Ação */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ação — Criar Tarefa</p>
            <div className="grid gap-2">
              <Label>Título da Tarefa *</Label>
              <Input
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="Ex: Preparar proposta para {lead_name}"
              />
              <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{'{lead_name}'}</code> para incluir o nome do lead.</p>
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
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={dueInDays}
                  onChange={e => setDueInDays(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição da Tarefa (opcional)</Label>
              <Input value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Detalhes adicionais sobre a tarefa..." />
            </div>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Regra criada!');
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automação</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Regras automáticas disparadas por eventos no CRM
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Regra
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex gap-3">
        <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Como funciona</p>
          <p className="text-amber-700">Quando um lead mudar de estágio no CRM, a regra executa automaticamente a ação configurada (ex: criar uma tarefa). O <code className="bg-amber-100 px-1 rounded">{'{lead_name}'}</code> no título da tarefa é substituído pelo nome real do lead.</p>
        </div>
      </div>

      <RuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={rule => createRule.mutate(rule)}
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
          <p className="text-sm text-muted-foreground">Crie sua primeira automação para economizar tempo no fluxo do CRM.</p>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className={`rounded-xl border p-4 transition-opacity ${rule.enabled ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${rule.enabled ? 'bg-amber-500/10' : 'bg-muted'}`}>
                    <Zap className={`h-4 w-4 ${rule.enabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{rule.name}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Gatilho: lead move para <strong>{STAGE_LABELS[rule.trigger_value] ?? rule.trigger_value}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Ação: criar tarefa <strong>"{rule.action_data.task_name}"</strong>
                        {' '}· prioridade <strong>{PRIORITY_LABELS[rule.action_data.task_priority] ?? rule.action_data.task_priority}</strong>
                        {rule.action_data.due_in_days ? ` · vence em ${rule.action_data.due_in_days} dia(s)` : ''}
                      </span>
                    </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
