import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const statusConfig = {
  a_receber: { label: "A Receber", icon: Circle, color: "text-muted-foreground" },
  em_progresso: { label: "Em Progresso", icon: Clock, color: "text-amber-500" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-emerald-500" },
};

const priorityColors: Record<string, "destructive" | "default" | "secondary"> = {
  alta: "destructive",
  media: "default",
  baixa: "secondary",
  normal: "secondary",
};

interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  company_id: string | null;
}

interface CompanyItem { id: string; name: string; }

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: {
    name: string; description: string; priority: string;
    due_date: string | null; company_id: string | null;
    recurrence?: { frequency: string; occurrences: number };
  }) => void;
  companies: CompanyItem[];
}

function NewTaskModal({ isOpen, onClose, onSave, companies }: NewTaskModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [occurrences, setOccurrences] = useState(3);

  useEffect(() => {
    if (!isOpen) {
      setName(''); setDescription(''); setPriority('normal');
      setDueDate(''); setCompanyId(''); setRecurrence('none'); setOccurrences(3);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('Informe um título para a tarefa.'); return; }
    if (recurrence !== 'none' && !dueDate) {
      alert('Para tarefas recorrentes, informe uma data de vencimento inicial.'); return;
    }
    onSave({
      name: name.trim(), description: description.trim(), priority,
      due_date: dueDate || null, company_id: companyId || null,
      recurrence: recurrence !== 'none' ? { frequency: recurrence, occurrences } : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Adicione uma tarefa e acompanhe seu progresso.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Título *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Preparar relatório mensal" autoFocus required />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes adicionais" />
          </div>
          <div className="grid gap-2">
            <Label>Empresa / Cliente</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId} onChange={e => setCompanyId(e.target.value)}
            >
              <option value="">Nenhuma empresa</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={priority} onChange={e => setPriority(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Data de vencimento</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Recorrência</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={recurrence} onChange={e => setRecurrence(e.target.value)}
              >
                <option value="none">Nenhuma</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </div>
            {recurrence !== 'none' && (
              <div className="grid gap-2">
                <Label>Ocorrências</Label>
                <Input type="number" min={2} max={12} value={occurrences} onChange={e => setOccurrences(Number(e.target.value))} />
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Gera datas para tarefas recorrentes
function getRecurringDates(baseDate: string, frequency: string, count: number): string[] {
  const base = new Date(baseDate);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    if (frequency === 'daily') d.setDate(d.getDate() + i);
    else if (frequency === 'weekly') d.setDate(d.getDate() + i * 7);
    else if (frequency === 'biweekly') d.setDate(d.getDate() + i * 14);
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + i);
    else if (frequency === 'quarterly') d.setMonth(d.getMonth() + i * 3);
    return d.toISOString();
  });
}

export default function Processes() {
  const queryClient = useQueryClient();
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Busca empresas sempre (usado tanto no dropdown quanto para resolver nomes nas tarefas)
  const { data: companies = [] } = useQuery<CompanyItem[]>({
    queryKey: ['companies-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Busca todas as tarefas sem join para evitar problemas de RLS
  const { data: tasks = [], isLoading, isError, error: tasksError } = useQuery<TaskItem[]>({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, name, description, status, priority, due_date, company_id')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[Processes] Erro ao buscar tarefas:', error);
        throw error;
      }
      return (data || []) as unknown as TaskItem[];
    },
    retry: 1,
  });

  // Obtém ou cria lista padrão "Geral" para o usuário
  const getOrCreateDefaultList = async (): Promise<string> => {
    // Tenta encontrar uma lista existente
    const { data: existing } = await supabase
      .from('lists')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;

    // Precisa de um space primeiro
    const { data: space, error: spaceErr } = await supabase
      .from('spaces')
      .insert({ name: 'Operacional' })
      .select('id')
      .single();
    if (spaceErr) throw spaceErr;

    const { data: list, error: listErr } = await supabase
      .from('lists')
      .insert({ name: 'Geral', space_id: space.id })
      .select('id')
      .single();
    if (listErr) throw listErr;
    return list.id;
  };

  const createTask = useMutation({
    mutationFn: async (newTask: {
      name: string; description: string; priority: string;
      due_date: string | null; company_id: string | null;
      recurrence?: { frequency: string; occurrences: number };
    }) => {
      const listId = await getOrCreateDefaultList();

      const tasksToInsert = newTask.recurrence?.frequency && newTask.due_date
        ? getRecurringDates(newTask.due_date, newTask.recurrence.frequency, newTask.recurrence.occurrences)
            .map(dueDate => ({
              name: newTask.name, description: newTask.description, priority: newTask.priority,
              due_date: dueDate, company_id: newTask.company_id || null,
              list_id: listId, status: 'a_receber' as const,
            }))
        : [{
            name: newTask.name, description: newTask.description, priority: newTask.priority,
            due_date: newTask.due_date, company_id: newTask.company_id || null,
            list_id: listId, status: 'a_receber' as const,
          }];

      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast.success('Tarefa criada!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { status?: string; priority?: string } }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-tasks'] }),
  });

  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

  const grouped = useMemo(() => ({
    a_receber: tasks.filter(t => t.status === 'a_receber'),
    em_progresso: tasks.filter(t => t.status === 'em_progresso'),
    concluido: tasks.filter(t => t.status === 'concluido'),
  }), [tasks]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando tarefas...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">Erro ao carregar tarefas.</p>
        {tasksError instanceof Error && (
          <p className="text-xs text-muted-foreground max-w-sm text-center">{tasksError.message}</p>
        )}
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['all-tasks'] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A Fazeres</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''} — {grouped.concluido.length} concluída{grouped.concluido.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsNewTaskOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
        </Button>
      </div>

      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSave={task => createTask.mutate(task)}
        companies={companies}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map(status => {
          const config = statusConfig[status];
          const Icon = config.icon;
          const items = grouped[status];

          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <h3 className="font-medium text-sm text-foreground">{config.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
                  Nenhuma tarefa
                </div>
              ) : (
                items.map(task => (
                  <div key={task.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground leading-tight">{task.name}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          {task.company_id && companyMap.get(task.company_id) && (
                            <p className="text-xs text-primary mt-1 font-medium">
                              {companyMap.get(task.company_id)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2">Mover</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {Object.entries(statusConfig).map(([s, cfg]) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={task.status === s}
                                onSelect={() => updateTask.mutate({ id: task.id, updates: { status: s } })}
                              >
                                {cfg.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => deleteTask.mutate(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 gap-2">
                      <Badge variant={priorityColors[task.priority] ?? 'secondary'} className="text-xs capitalize">
                        {task.priority ?? 'normal'}
                      </Badge>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
