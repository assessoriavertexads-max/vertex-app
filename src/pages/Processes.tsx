import { useMemo, useState } from "react";
import {
  CheckCircle2, Circle, Clock, Plus, Trash2, Pencil, Search,
  LayoutList, Columns3, AlertCircle, CalendarClock, CalendarCheck,
  ChevronDown, ChevronRight, Building2, Flag, X, RefreshCw,
} from "lucide-react";
import {
  DndContext, DragStartEvent, DragEndEvent, DragOverlay,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { runAutomations } from "@/lib/automation";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  company_id: string | null;
  recurrence_pattern: string | null;
  parent_task_id: string | null;
}

interface CompanyItem { id: string; name: string; }

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  alta:   { label: "Alta",   dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200" },
  media:  { label: "Média",  dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-700 border-amber-200" },
  baixa:  { label: "Baixa",  dot: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-200" },
  normal: { label: "Normal", dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily:     "Diária",
  weekly:    "Semanal",
  biweekly:  "Quinzenal",
  monthly:   "Mensal",
  quarterly: "Trimestral",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function dueDateInfo(dateStr: string | null, status: string): {
  label: string; color: string; urgent: boolean;
} {
  if (!dateStr || status === "concluido") return { label: "", color: "", urgent: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `Venceu há ${Math.abs(diff)}d`,    color: "text-red-600 bg-red-50 border-red-200",        urgent: true  };
  if (diff === 0) return { label: "Vence hoje",                      color: "text-orange-600 bg-orange-50 border-orange-200", urgent: true  };
  if (diff === 1) return { label: "Amanhã",                          color: "text-amber-600 bg-amber-50 border-amber-200",   urgent: false };
  if (diff <= 7)  return { label: due.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }), color: "text-amber-600 bg-amber-50 border-amber-200", urgent: false };
  return { label: due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), color: "text-muted-foreground bg-muted border-border", urgent: false };
}

async function getOrCreateDefaultList(): Promise<string | null> {
  try {
    const { data } = await supabase.from("lists").select("id").limit(1).maybeSingle();
    if (data?.id) return data.id as string;
    const { data: space } = await supabase.from("spaces").insert({ name: "Operacional" }).select("id").single();
    if (!space) return null;
    const { data: list } = await supabase.from("lists").insert({ name: "Geral", space_id: space.id }).select("id").single();
    return list?.id ?? null;
  } catch { return null; }
}

// ── Form types ─────────────────────────────────────────────────────────────

interface TaskFormData {
  name: string;
  description: string;
  priority: string;
  due_date: string;
  company_id: string;
  recurrence: string;
}

function TaskFormFields({
  data, onChange, companies, showRecurrence = true,
}: {
  data: TaskFormData;
  onChange: (patch: Partial<TaskFormData>) => void;
  companies: CompanyItem[];
  showRecurrence?: boolean;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Título *</Label>
        <Input value={data.name} onChange={e => onChange({ name: e.target.value })}
          placeholder="Ex: Preparar relatório mensal" autoFocus required />
      </div>
      <div className="grid gap-2">
        <Label>Descrição</Label>
        <Textarea value={data.description} onChange={e => onChange({ description: e.target.value })}
          placeholder="Detalhes adicionais" rows={2} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Empresa / Cliente</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.company_id} onChange={e => onChange({ company_id: e.target.value })}>
            <option value="">Nenhuma empresa</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Prioridade</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.priority} onChange={e => onChange({ priority: e.target.value })}>
            <option value="normal">Normal</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Data de vencimento</Label>
        <Input type="date" value={data.due_date} onChange={e => onChange({ due_date: e.target.value })} />
      </div>
      {showRecurrence && (
        <div className="grid gap-2">
          <Label>Recorrência</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.recurrence} onChange={e => onChange({ recurrence: e.target.value })}>
            <option value="none">Nenhuma</option>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quinzenal</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
          </select>
          {data.recurrence !== "none" && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              A próxima ocorrência é criada automaticamente quando esta for concluída.
              {!data.due_date && <span className="font-semibold ml-1">Informe uma data de vencimento.</span>}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── New Task Modal ─────────────────────────────────────────────────────────

function NewTaskModal({ isOpen, onClose, onSave, companies }: {
  isOpen: boolean; onClose: () => void;
  onSave: (t: TaskFormData) => void;
  companies: CompanyItem[];
}) {
  const empty: TaskFormData = { name: "", description: "", priority: "normal", due_date: "", company_id: "", recurrence: "none" };
  const [data, setData] = useState<TaskFormData>(empty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) { toast.error("Informe um título para a tarefa."); return; }
    if (data.recurrence !== "none" && !data.due_date) {
      toast.error("Para tarefas recorrentes, informe uma data de vencimento."); return;
    }
    onSave(data);
    setData(empty);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { setData(empty); onClose(); } }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>Adicione e acompanhe o progresso da tarefa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <TaskFormFields data={data} onChange={p => setData(prev => ({ ...prev, ...p }))} companies={companies} />
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => { setData(empty); onClose(); }}>Cancelar</Button>
            <Button type="submit">Criar Tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Task Modal ────────────────────────────────────────────────────────

function EditTaskModal({ task, companies, onClose, onSave }: {
  task: TaskItem | null; companies: CompanyItem[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<TaskItem>) => void;
}) {
  const [data, setData] = useState<TaskFormData>({
    name: "", description: "", priority: "normal", due_date: "", company_id: "", recurrence: "none",
  });

  useMemo(() => {
    if (task) setData({
      name: task.name, description: task.description ?? "",
      priority: task.priority, due_date: task.due_date ?? "",
      company_id: task.company_id ?? "", recurrence: "none",
    });
  }, [task]);

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) { toast.error("Informe um título."); return; }
    onSave(task.id, {
      name: data.name.trim(),
      description: data.description.trim() || null,
      priority: data.priority,
      due_date: data.due_date || null,
      company_id: data.company_id || null,
    });
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <TaskFormFields data={data} onChange={p => setData(prev => ({ ...prev, ...p }))} companies={companies} showRecurrence={false} />
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Row (List View) ───────────────────────────────────────────────────

function TaskRow({ task, companies, onToggle, onEdit, onDelete }: {
  task: TaskItem; companies: CompanyItem[];
  onToggle: (t: TaskItem) => void;
  onEdit: (t: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = task.status === "concluido";
  const inProgress = task.status === "em_progresso";
  const pCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
  const dd = dueDateInfo(task.due_date, task.status);
  const companyName = task.company_id ? companies.find(c => c.id === task.company_id)?.name : null;

  return (
    <div className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors ${isDone ? "opacity-60" : ""}`}>
      <button
        onClick={() => onToggle(task)}
        className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
      >
        {isDone
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : inProgress
            ? <Clock className="w-5 h-5 text-amber-500" />
            : <Circle className="w-5 h-5" />}
      </button>

      <div className={`w-2 h-2 rounded-full shrink-0 ${pCfg.dot}`} title={pCfg.label} />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.name}
        </span>
        {task.recurrence_pattern && (
          <span title={`Recorrente: ${RECURRENCE_LABELS[task.recurrence_pattern] ?? task.recurrence_pattern}`}>
            <RefreshCw className="w-3 h-3 text-blue-500 shrink-0" />
          </span>
        )}
        {task.description && (
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline truncate">{task.description}</span>
        )}
      </div>

      {companyName && (
        <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          <Building2 className="w-3 h-3" />{companyName}
        </span>
      )}

      <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${pCfg.badge}`}>
        {pCfg.label}
      </span>

      {dd.label && (
        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${dd.color}`}>
          {dd.label}
        </span>
      )}

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
        <button onClick={() => onEdit(task)} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(task.id)} className="p-1 text-muted-foreground hover:text-red-600 rounded transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Task Card (Board View) ─────────────────────────────────────────────────

function TaskCard({ task, companies, onToggle, onEdit, onDelete }: {
  task: TaskItem; companies: CompanyItem[];
  onToggle: (t: TaskItem) => void;
  onEdit: (t: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const pCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
  const dd = dueDateInfo(task.due_date, task.status);
  const companyName = task.company_id ? companies.find(c => c.id === task.company_id)?.name : null;

  return (
    <div className="bg-card rounded-xl border border-border p-3.5 group hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pCfg.dot}`} />
          <span className="text-sm font-medium text-foreground leading-snug">{task.name}</span>
          {task.recurrence_pattern && (
            <RefreshCw
              className="w-3 h-3 text-blue-500 shrink-0 mt-1"
              title={`Recorrente: ${RECURRENCE_LABELS[task.recurrence_pattern] ?? task.recurrence_pattern}`}
            />
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0 transition-opacity">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onEdit(task)}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onDelete(task.id)}
            className="p-1 text-muted-foreground hover:text-red-600 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-4">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 ml-4">
        <div className="flex items-center gap-1.5">
          {companyName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" />{companyName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {dd.label && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${dd.color}`}>{dd.label}</span>
          )}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onToggle(task)}
            className="text-muted-foreground hover:text-emerald-500 transition-colors"
          >
            {task.status === "concluido"
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <Circle className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sortable Task Card wrapper (Board DnD) ─────────────────────────────────

function SortableTaskCard(props: React.ComponentProps<typeof TaskCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-0" : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} />
    </div>
  );
}

// ── Board Column (with Droppable + SortableContext) ────────────────────────

function BoardColumn({ status, group, companies, onToggle, onEdit, onDelete }: {
  status: string;
  group: { label: string; color: string; headerColor: string; items: TaskItem[] };
  companies: CompanyItem[];
  onToggle: (t: TaskItem) => void;
  onEdit: (t: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between px-1 py-2 rounded-lg border-b-2 ${group.color.split(" ")[0]}`}>
        <span className={`text-sm font-semibold ${group.headerColor}`}>{group.label}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.items.length}</span>
      </div>
      <SortableContext items={group.items.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`rounded-xl border-2 border-dashed p-2 space-y-2 min-h-[400px] transition-colors ${
            isOver ? "border-primary/60 bg-primary/5" : group.color
          }`}
        >
          {group.items.map(task => (
            <SortableTaskCard
              key={task.id}
              task={task}
              companies={companies}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {group.items.length === 0 && !isOver && (
            <p className="text-center text-xs text-muted-foreground pt-6">Nenhuma tarefa</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ label, count, color, icon: Icon, open, onToggle }: {
  label: string; count: number; color: string;
  icon: React.ElementType; open: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 py-1.5 px-1 text-left group">
      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-sm font-semibold ${color}`}>{label}</span>
      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-1">{count}</span>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Processes() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "board">("list");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [activeDragTask, setActiveDragTask] = useState<TaskItem | null>(null);
  const [openSections, setOpenSections] = useState({
    overdue: true, today: true, week: true, later: true, noDate: true, done: false,
  });

  // DnD sensors: pointer with 8px threshold prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: companies = [] } = useQuery<CompanyItem[]>({
    queryKey: ["companies-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks = [], isLoading, isError } = useQuery<TaskItem[]>({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id:                 String(r.id ?? ""),
          name:               String(r.name ?? ""),
          description:        r.description ? String(r.description) : null,
          status:             String(r.status ?? "a_receber"),
          priority:           String(r.priority ?? "normal"),
          due_date:           r.due_date ? String(r.due_date) : null,
          company_id:         r.company_id ? String(r.company_id) : null,
          recurrence_pattern: r.recurrence_pattern ? String(r.recurrence_pattern) : null,
          parent_task_id:     r.parent_task_id ? String(r.parent_task_id) : null,
        } satisfies TaskItem;
      });
    },
    retry: 1,
  });

  // Create: single task with recurrence_pattern — trigger generates next on completion
  const createTask = useMutation({
    mutationFn: async (form: TaskFormData) => {
      const listId = await getOrCreateDefaultList();
      const payload = {
        name:        form.name,
        description: form.description || null,
        priority:    form.priority,
        company_id:  form.company_id || null,
        status:      "a_receber",
        due_date:    form.due_date || null,
        ...(listId ? { list_id: listId } : {}),
        ...(form.recurrence !== "none" ? { recurrence_pattern: form.recurrence } : {}),
      };
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      return { name: form.name, company_id: form.company_id || null };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast.success("Tarefa criada!");
      runAutomations("task_created", "any", { entityTitle: data.name, companyId: data.company_id }).catch(() => {});
    },
    onError: (err: Error) => toast.error(`Erro ao criar tarefa: ${err.message}`),
  });

  // Update: optimistic update before server confirmation — UI never waits
  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskItem> }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["all-tasks"] });
      const previousTasks = queryClient.getQueryData<TaskItem[]>(["all-tasks"]);
      queryClient.setQueryData(["all-tasks"], (old: TaskItem[] | undefined) =>
        old?.map(t => t.id === id ? { ...t, ...updates } : t) ?? []
      );
      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) queryClient.setQueryData(["all-tasks"], context.previousTasks);
      toast.error("Erro ao atualizar tarefa.");
    },
    onSuccess: async ({ updates, id }) => {
      if (updates.status === "concluido") {
        const task = tasks.find(t => t.id === id);
        if (task?.recurrence_pattern) {
          toast.success(`Concluída! Próxima ocorrência (${RECURRENCE_LABELS[task.recurrence_pattern]}) criada automaticamente.`);
        }
        if (task) {
          runAutomations("task_completed", "any", { entityTitle: task.name, companyId: task.company_id }).catch(() => {});
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast.success("Tarefa removida.");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const handleToggle = (task: TaskItem) => {
    const nextStatus = task.status === "concluido" ? "a_receber" : "concluido";
    updateTask.mutate({ id: task.id, updates: { status: nextStatus } });
  };

  // Board DnD handlers
  const handleBoardDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find(t => t.id === String(active.id));
    setActiveDragTask(task ?? null);
  };

  const handleBoardDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragTask(null);
    if (!over || active.id === over.id) return;
    const draggedTask = tasks.find(t => t.id === String(active.id));
    if (!draggedTask) return;
    const overId = String(over.id);
    const overTask = tasks.find(t => t.id === overId);
    const targetStatus = overTask ? overTask.status : overId;
    if (draggedTask.status !== targetStatus) {
      updateTask.mutate({ id: draggedTask.id, updates: { status: targetStatus } });
    }
  };

  // Filtered tasks
  const filtered = useMemo(() => {
    let list = tasks;
    if (search)         list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase()));
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterCompany)  list = list.filter(t => t.company_id === filterCompany);
    return list;
  }, [tasks, search, filterPriority, filterCompany]);

  // List view sections
  const sections = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr  = today.toISOString().slice(0, 10);
    const next7Str  = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const active = filtered.filter(t => t.status !== "concluido");
    return {
      overdue: active.filter(t => t.due_date && t.due_date < todayStr),
      today:   active.filter(t => t.due_date === todayStr),
      week:    active.filter(t => t.due_date && t.due_date > todayStr && t.due_date <= next7Str),
      later:   active.filter(t => t.due_date && t.due_date > next7Str),
      noDate:  active.filter(t => !t.due_date),
      done:    filtered.filter(t => t.status === "concluido"),
    };
  }, [filtered]);

  // Board groups (derives from filtered, so optimistic updates reflect instantly)
  const boardGroups = useMemo(() => ({
    a_receber:    { label: "A Fazer",       color: "border-slate-300 bg-slate-50/60",    headerColor: "text-slate-600",   items: filtered.filter(t => t.status === "a_receber")    },
    em_progresso: { label: "Em Progresso",  color: "border-amber-200 bg-amber-50/60",    headerColor: "text-amber-600",   items: filtered.filter(t => t.status === "em_progresso") },
    concluido:    { label: "Concluído",     color: "border-emerald-200 bg-emerald-50/60", headerColor: "text-emerald-600", items: filtered.filter(t => t.status === "concluido")    },
  }), [filtered]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgo  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return {
      total:    tasks.filter(t => t.status !== "concluido").length,
      overdue:  tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== "concluido").length,
      today:    tasks.filter(t => t.due_date === todayStr && t.status !== "concluido").length,
      doneWeek: tasks.filter(t => t.status === "concluido" && t.due_date && t.due_date >= weekAgo).length,
    };
  }, [tasks]);

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const hasFilters = search || filterPriority || filterCompany;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando tarefas...</div>;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm font-medium">Erro ao carregar tarefas.</p>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["all-tasks"] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A Fazeres</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie tarefas da agência por cliente, prazo e prioridade.</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Em aberto</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${stats.overdue > 0 ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
          <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600" : "text-foreground"}`}>{stats.overdue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Atrasadas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${stats.today > 0 ? "border-orange-200 bg-orange-50" : "border-border bg-card"}`}>
          <p className={`text-2xl font-bold ${stats.today > 0 ? "text-orange-600" : "text-foreground"}`}>{stats.today}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Vencem hoje</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.doneWeek}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Concluídas (7d)</p>
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar tarefas..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-40"
          value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">Todas prioridades</option>
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-48"
          value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex border border-input rounded-md overflow-hidden h-10 shrink-0">
          <button
            onClick={() => setView("list")}
            className={`px-3 flex items-center gap-1.5 text-sm transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutList className="h-4 w-4" /> Lista
          </button>
          <button
            onClick={() => setView("board")}
            className={`px-3 flex items-center gap-1.5 text-sm transition-colors ${view === "board" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            <Columns3 className="h-4 w-4" /> Board
          </button>
        </div>
      </div>

      {hasFilters && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa encontrada com os filtros aplicados.
        </div>
      )}

      {/* Modals */}
      <NewTaskModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} onSave={form => createTask.mutate(form)} companies={companies} />
      <EditTaskModal task={editingTask} companies={companies} onClose={() => setEditingTask(null)}
        onSave={(id, updates) => updateTask.mutate({ id, updates })} />

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="space-y-4">
          {[
            { key: "overdue" as const, label: "Atrasadas",    icon: AlertCircle,   color: "text-red-600"          },
            { key: "today"   as const, label: "Hoje",         icon: CalendarClock, color: "text-orange-600"       },
            { key: "week"    as const, label: "Esta semana",  icon: CalendarCheck, color: "text-amber-600"        },
            { key: "later"   as const, label: "Mais tarde",   icon: Clock,         color: "text-blue-500"         },
            { key: "noDate"  as const, label: "Sem data",     icon: Circle,        color: "text-muted-foreground" },
            { key: "done"    as const, label: "Concluídas",   icon: CheckCircle2,  color: "text-emerald-500"      },
          ].map(sec => {
            const items = sections[sec.key];
            if (items.length === 0 && sec.key !== "noDate") return null;
            return (
              <div key={sec.key} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-3 pt-1">
                  <SectionHeader
                    label={sec.label} count={items.length}
                    color={sec.color} icon={sec.icon}
                    open={openSections[sec.key]} onToggle={() => toggleSection(sec.key)}
                  />
                </div>
                {openSections[sec.key] && items.length > 0 && (
                  <div className="px-2 pb-2 space-y-0.5">
                    {items.map(task => (
                      <TaskRow key={task.id} task={task} companies={companies}
                        onToggle={handleToggle} onEdit={setEditingTask}
                        onDelete={id => deleteTask.mutate(id)} />
                    ))}
                  </div>
                )}
                {openSections[sec.key] && items.length === 0 && (
                  <p className="px-4 pb-3 text-xs text-muted-foreground">Nenhuma tarefa</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── BOARD VIEW (DnD) ── */}
      {view === "board" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleBoardDragStart}
          onDragEnd={handleBoardDragEnd}
          onDragCancel={() => setActiveDragTask(null)}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(boardGroups).map(([status, group]) => (
              <BoardColumn
                key={status}
                status={status}
                group={group}
                companies={companies}
                onToggle={handleToggle}
                onEdit={setEditingTask}
                onDelete={id => deleteTask.mutate(id)}
              />
            ))}
          </div>

          {/* Ghost card rendered outside columns to avoid layout shift */}
          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeDragTask ? (
              <div className="rotate-1 shadow-2xl ring-2 ring-primary/40 rounded-xl pointer-events-none opacity-95">
                <TaskCard
                  task={activeDragTask}
                  companies={companies}
                  onToggle={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Empty state */}
      {!hasFilters && tasks.length === 0 && !isLoading && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="font-medium text-foreground">Nenhuma tarefa criada</p>
          <p className="text-sm text-muted-foreground">Crie tarefas para organizar as entregas da agência por cliente e prazo.</p>
          <Button variant="outline" onClick={() => setIsNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar Primeira Tarefa
          </Button>
        </div>
      )}
    </div>
  );
}
