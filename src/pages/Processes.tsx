import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

const statusConfig = {
  a_receber: { label: "A Receber", icon: Circle, color: "text-muted-foreground" },
  em_progresso: { label: "Em Progresso", icon: Clock, color: "text-warning" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-success" },
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
  companies?: { name: string };
}

interface CompanyItem {
  id: string;
  name: string;
}

interface ListItem {
  id: string;
  name: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: {
    name: string;
    description: string;
    priority: string;
    due_date: string | null;
    company_id: string | null;
    recurrence?: {
      frequency: string;
      occurrences: number;
    };
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
      setName('');
      setDescription('');
      setPriority('normal');
      setDueDate('');
      setCompanyId('');
      setRecurrence('none');
      setOccurrences(3);
    }
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      alert('Informe um título para a tarefa.');
      return;
    }

    if (recurrence !== 'none' && !dueDate) {
      alert('Para tarefas recorrentes, informe uma data de vencimento inicial.');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate || null,
      company_id: companyId || null,
      recurrence: recurrence !== 'none' ? { frequency: recurrence, occurrences } : undefined,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Adicione uma tarefa e acompanhe seu progresso.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="task-name">Título</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Preparar minuta do contrato"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Detalhes adicionais da tarefa"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-company">Empresa / Cliente</Label>
            <select
              id="task-company"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">Nenhuma empresa selecionada</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="task-priority">Prioridade</Label>
              <select
                id="task-priority"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-due-date">Data de vencimento</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-recurrence">Recorrência</Label>
              <select
                id="task-recurrence"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value)}
              >
                <option value="none">Nenhuma</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-occurrences">Ocorrências</Label>
              <Input
                id="task-occurrences"
                type="number"
                min={2}
                max={12}
                value={occurrences}
                onChange={(event) => setOccurrences(Number(event.target.value))}
                disabled={recurrence === 'none'}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Processes() {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const { data: lists = [], isLoading: isLoadingLists, isError: isErrorLists } = useQuery<ListItem[]>({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lists').select('id, name').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  const { data: tasks = [], isLoading: isLoadingTasks, isError: isErrorTasks } = useQuery<TaskItem[]>({
    queryKey: ['tasks', selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*, companies(name)')
        .eq('list_id', selectedListId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedListId,
  });

  const { data: companies = [] } = useQuery<CompanyItem[]>({
    queryKey: ['companies-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isNewTaskOpen,
  });

  const getRecurringDueDates = (baseDate: string, frequency: string, count: number) => {
    const base = new Date(baseDate);
    const dates: string[] = [];

    for (let index = 0; index < count; index += 1) {
      const due = new Date(base);
      switch (frequency) {
        case 'daily':
          due.setDate(due.getDate() + index);
          break;
        case 'weekly':
          due.setDate(due.getDate() + index * 7);
          break;
        case 'biweekly':
          due.setDate(due.getDate() + index * 14);
          break;
        case 'monthly':
          due.setMonth(due.getMonth() + index);
          break;
        case 'quarterly':
          due.setMonth(due.getMonth() + index * 3);
          break;
        default:
          break;
      }
      dates.push(due.toISOString());
    }

    return dates;
  };

  const createTask = useMutation({
    mutationFn: async (newTask: Omit<TablesInsert<'tasks'>, 'list_id' | 'status'>) => {
      if (!selectedListId) throw new Error('Nenhuma lista selecionada');

      const tasksToInsert: TablesInsert<'tasks'>[] = [];

      if (newTask.recurrence?.frequency && newTask.recurrence.frequency !== 'none' && newTask.due_date) {
        const dates = getRecurringDueDates(newTask.due_date, newTask.recurrence.frequency, newTask.recurrence.occurrences);

        dates.forEach((dueDate) => {
          tasksToInsert.push({
            name: newTask.name,
            description: newTask.description,
            priority: newTask.priority,
            due_date: dueDate,
            company_id: newTask.company_id || null,
            list_id: selectedListId,
            status: 'a_receber',
          });
        });
      } else {
        tasksToInsert.push({
          name: newTask.name,
          description: newTask.description,
          priority: newTask.priority,
          due_date: newTask.due_date,
          company_id: newTask.company_id || null,
          list_id: selectedListId,
          status: 'a_receber',
        });
      }

      const { data, error } = await supabase.from('tasks').insert(tasksToInsert).select('*');
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'tasks'> }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  const grouped = useMemo(() => ({
    a_receber: tasks.filter((task) => task.status === 'a_receber'),
    em_progresso: tasks.filter((task) => task.status === 'em_progresso'),
    concluido: tasks.filter((task) => task.status === 'concluido'),
  }), [tasks]);

  const isLoading = isLoadingLists || isLoadingTasks;
  const hasError = isErrorLists || isErrorTasks;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando tarefas...</div>;
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Erro ao carregar a página de tarefas. Tente novamente.
      </div>
    );
  }

  if (!lists.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A Fazeres</h1>
          <p className="text-muted-foreground text-sm mt-1">Ainda não há listas de trabalho criadas.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Crie ao menos uma lista no banco de dados para começar a organizar suas tarefas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A Fazeres</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize suas tarefas e acompanhe o progresso.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {lists.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="task-list">Lista</Label>
              <select
                id="task-list"
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedListId ?? ''}
                onChange={(event) => setSelectedListId(event.target.value)}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={() => setIsNewTaskOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSave={(task) => createTask.mutate(task)}
        companies={companies}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((status) => {
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
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nenhuma tarefa nesta fase.
                </div>
              ) : (
                items.map((task) => (
                  <div key={task.id} className="stat-card !p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-sm text-foreground">{task.name}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                          )}
                          {task.companies?.name && (
                            <p className="text-xs text-muted-foreground mt-1">{task.companies.name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Atualizar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {Object.entries(statusConfig).map(([nextStatus, nextConfig]) => (
                              <DropdownMenuItem
                                key={nextStatus}
                                disabled={task.status === nextStatus}
                                onSelect={() => updateTask.mutate({ id: task.id, updates: { status: nextStatus } })}
                              >
                                {nextConfig.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteTask.mutate(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 gap-3">
                      <Badge variant={priorityColors[task.priority] ?? 'secondary'} className="text-xs capitalize">
                        {task.priority ?? 'normal'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem prazo'}
                      </span>
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
