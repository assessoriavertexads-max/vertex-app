import { useEffect, useMemo, useState } from "react";
import { BookOpen, Circle, Clock, CheckCircle2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TaskCreateInput, TaskUpdate } from '@/lib/backend-types';

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

interface SpaceItem {
  id: string;
  name: string;
}

interface ListItem {
  id: string;
  name: string;
  space_id: string;
}

interface CompanyItem {
  id: string;
  name: string;
}

interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  companies?: { name: string };
}

function CreateSpaceModal({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!isOpen) setName('');
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Novo espaço</DialogTitle>
          <DialogDescription>Organize processos em espaços como Jurídico, Comercial ou Operações.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              toast.error('Informe o nome do espaço.');
              return;
            }
            onSave(name.trim());
            onClose();
          }}
          className="grid gap-4 py-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="space-name">Nome do espaço</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Jurídico"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Criar espaço</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateListModal({
  isOpen,
  onClose,
  onSave,
  spaces,
}: {
  isOpen: boolean;
  onClose: () => void;
  spaces: SpaceItem[];
  onSave: (name: string, spaceId: string) => void;
}) {
  const [name, setName] = useState('');
  const [spaceId, setSpaceId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setSpaceId(spaces[0]?.id ?? '');
    }
  }, [isOpen, spaces]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Nova lista</DialogTitle>
          <DialogDescription>Crie uma lista dentro de um espaço para agrupar seus processos.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !spaceId) {
              toast.error('Informe o nome da lista e um espaço.');
              return;
            }
            onSave(name.trim(), spaceId);
            onClose();
          }}
          className="grid gap-4 py-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="list-name">Nome da lista</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Prazos processuais"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="list-space">Espaço</Label>
            <select
              id="list-space"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={spaceId}
              onChange={(event) => setSpaceId(event.target.value)}
              required
            >
              <option value="">Selecione um espaço</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Criar lista</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskModal({
  isOpen,
  onClose,
  onSave,
  companies,
}: {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyItem[];
  onSave: (task: { name: string; description: string; priority: string; due_date: string | null; company_id: string | null }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setPriority('normal');
      setDueDate('');
      setCompanyId('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Registre um processo ou tarefa dentro da lista selecionada.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              toast.error('Informe o título da tarefa.');
              return;
            }
            onSave({
              name: name.trim(),
              description: description.trim(),
              priority,
              due_date: dueDate || null,
              company_id: companyId || null,
            });
            onClose();
          }}
          className="grid gap-4 py-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="task-name">Título</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Preparar petição inicial"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Instruções, documentos ou observações relevantes"
            />
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

          <div className="grid gap-2">
            <Label htmlFor="task-company">Empresa / Cliente</Label>
            <select
              id="task-company"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">Nenhuma</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
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

export default function Docs() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'processos' | 'docs'>('processos');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: spaces = [], isLoading: isLoadingSpaces, isError: isErrorSpaces } = useQuery<SpaceItem[]>({
    queryKey: ['spaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('spaces').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lists = [], isLoading: isLoadingLists, isError: isErrorLists } = useQuery<ListItem[]>({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lists').select('id, name, space_id').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedSpaceId && spaces.length > 0) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces, selectedSpaceId]);

  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    if (selectedSpaceId) {
      const listInSpace = lists.find((list) => list.space_id === selectedSpaceId);
      if (listInSpace && (!selectedListId || !lists.some((list) => list.id === selectedListId))) {
        setSelectedListId(listInSpace.id);
      }
    }
  }, [selectedSpaceId, lists, selectedListId]);

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

  const createSpace = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('spaces').insert([{ name }]).select('id, name');
      if (error) throw error;
      return data?.[0] as SpaceItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  const createList = useMutation({
    mutationFn: async ({ name, space_id }: { name: string; space_id: string }) => {
      const { data, error } = await supabase.from('lists').insert([{ name, space_id }]).select('id, name, space_id');
      if (error) throw error;
      return data?.[0] as ListItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });

  const createTask = useMutation({
    mutationFn: async (newTask: TaskCreateInput) => {
      if (!selectedListId) throw new Error('Selecione uma lista antes de criar a tarefa.');
      const { data, error } = await supabase.from('tasks').insert([
        {
          ...newTask,
          list_id: selectedListId,
          status: 'a_receber',
        },
      ]).select('*');
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', selectedListId] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdate }) => {
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

  const selectedList = lists.find((list) => list.id === selectedListId);
  const listsInSpace = lists.filter((list) => list.space_id === selectedSpaceId);

  const groupedTasks = useMemo(
    () => ({
      a_receber: tasks.filter((task) => task.status === 'a_receber'),
      em_progresso: tasks.filter((task) => task.status === 'em_progresso'),
      concluido: tasks.filter((task) => task.status === 'concluido'),
    }),
    [tasks],
  );

  const filteredDocs = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter(
      (task) =>
        task.name.toLowerCase().includes(value) ||
        (task.description?.toLowerCase().includes(value) ?? false) ||
        (task.companies?.name.toLowerCase().includes(value) ?? false),
    );
  }, [search, tasks]);

  const isLoading = isLoadingSpaces || isLoadingLists || isLoadingTasks;
  const hasError = isErrorSpaces || isErrorLists || isErrorTasks;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando Processos & Docs...</div>;
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">Erro ao carregar Processos & Docs.</p>
        <p className="text-muted-foreground text-xs max-w-sm text-center">
          Verifique se a migração <code className="bg-muted px-1 rounded">20260414_safe_ensure_schema.sql</code> foi aplicada no Supabase.
        </p>
        <Button variant="outline" size="sm" onClick={() => {
          queryClient.invalidateQueries({ queryKey: ['spaces'] });
          queryClient.invalidateQueries({ queryKey: ['lists'] });
        }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm uppercase tracking-[0.2em] font-semibold">Processos & Docs</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-2">Gerencie seus processos e documentos em um só lugar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie espaços, listas e tarefas. A aba Docs mostra registros e instruções relevantes por lista.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={() => setIsNewSpaceOpen(true)}>
            Novo espaço
          </Button>
          <Button variant="outline" onClick={() => setIsNewListOpen(true)} disabled={!selectedSpaceId}>
            Nova lista
          </Button>
          <Button onClick={() => setIsNewTaskOpen(true)} disabled={!selectedListId}>
            Nova tarefa
          </Button>
        </div>
      </div>

      <CreateSpaceModal
        isOpen={isNewSpaceOpen}
        onClose={() => setIsNewSpaceOpen(false)}
        onSave={(name) => createSpace.mutate(name)}
      />
      <CreateListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        spaces={spaces}
        onSave={(name, spaceId) => createList.mutate({ name, space_id: spaceId })}
      />
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        companies={companies}
        onSave={(task) => createTask.mutate(task)}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Espaços</p>
          <p className="text-3xl font-semibold text-foreground mt-3">{spaces.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Listas</p>
          <p className="text-3xl font-semibold text-foreground mt-3">{lists.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Tarefas</p>
          <p className="text-3xl font-semibold text-foreground mt-3">{tasks.length}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <Label htmlFor="space-select">Espaço</Label>
          <select
            id="space-select"
            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedSpaceId ?? ''}
            onChange={(event) => setSelectedSpaceId(event.target.value)}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <Label htmlFor="list-select">Lista</Label>
          <select
            id="list-select"
            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedListId ?? ''}
            onChange={(event) => setSelectedListId(event.target.value)}
          >
            {listsInSpace.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Lista ativa</p>
          <p className="text-lg font-semibold text-foreground mt-2">{selectedList?.name || 'Nenhuma lista selecionada'}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'processos' | 'docs')}>
        <TabsList>
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="processos">
          <div className="grid gap-6 lg:grid-cols-3">
            {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => {
              const config = statusConfig[status];
              const Icon = config.icon;
              const items = groupedTasks[status];

              return (
                <div key={status} className="space-y-4 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{items.length} tarefa(s)</p>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Sem processos nesta fase.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-border p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-sm text-foreground">{task.name}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                              )}
                              {task.companies?.name && (
                                <p className="text-xs text-muted-foreground mt-1">{task.companies.name}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {status !== 'concluido' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateTask.mutate({ id: task.id, updates: { status: status === 'a_receber' ? 'em_progresso' : 'concluido' } })
                                  }
                                >
                                  Próximo
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteTask.mutate(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 mt-3">
                            <Badge variant={priorityColors[task.priority] ?? 'secondary'} className="text-xs capitalize">
                              {task.priority ?? 'normal'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem prazo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="docs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Documentos da lista</p>
              <h2 className="text-lg font-semibold text-foreground">{selectedList?.name || 'Selecione uma lista'}</h2>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar documentos..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum documento encontrado. Tente outro termo ou crie uma nova tarefa.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDocs.map((task) => (
                <div key={task.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{task.name}</p>
                      {task.description ? (
                        <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">Sem descrição.</p>
                      )}
                    </div>
                    <Badge variant={priorityColors[task.priority] ?? 'secondary'} className="text-xs capitalize">
                      {task.priority ?? 'normal'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{task.companies?.name ?? 'Sem empresa'}</span>
                    <span>•</span>
                    <span>{task.status}</span>
                    <span>•</span>
                    <span>{task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem prazo'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
