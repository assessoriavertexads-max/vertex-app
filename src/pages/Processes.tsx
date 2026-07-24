import { useEffect, useRef, useState, useMemo } from "react";
import {
  CheckCircle2, Circle, Clock, Plus, Trash2, Search, LayoutList, Columns3,
  AlertCircle, CalendarClock, CalendarCheck, ChevronDown, ChevronRight,
  Building2, RefreshCw, X, Lock, Tag, User, Timer, GripVertical,
  CheckSquare, MoreHorizontal, Pencil,
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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { runAutomations } from "@/lib/automation";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChecklistItem { id: string; text: string; done: boolean; }

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
  checklist: ChecklistItem[];
  tags: string[];
  assigned_to: string | null;
  estimated_hours: number | null;
  blocked_by_ids: string[];
}

interface CompanyItem { id: string; name: string; }

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  alta:   { label: "Alta",   dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200"         },
  media:  { label: "Média",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200"   },
  baixa:  { label: "Baixa",  dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  normal: { label: "Normal", dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200"   },
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diária", weekly: "Semanal", biweekly: "Quinzenal",
  monthly: "Mensal", quarterly: "Trimestral",
};

function recurrenceLabel(pattern: string | null): string {
  if (!pattern) return "";
  if (RECURRENCE_LABELS[pattern]) return RECURRENCE_LABELS[pattern];
  if (pattern.startsWith("custom_")) {
    const suffix = pattern.slice(7);
    const unit   = suffix.slice(-1);
    const count  = parseInt(suffix.slice(0, -1), 10);
    if (isNaN(count)) return pattern;
    const lbl = { d: count === 1 ? "dia" : "dias", w: count === 1 ? "semana" : "semanas", m: count === 1 ? "mês" : "meses" }[unit] ?? unit;
    return `A cada ${count} ${lbl}`;
  }
  return pattern;
}

// ── RecurrencePicker ───────────────────────────────────────────────────────
function RecurrencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = value.startsWith("custom_");

  const parseCustom = () => {
    if (!isCustom) return { count: 1, unit: "d" };
    const suffix = value.slice(7);
    const unit   = suffix.slice(-1);
    const count  = parseInt(suffix.slice(0, -1), 10);
    return { count: isNaN(count) ? 1 : count, unit };
  };

  const { count: customCount, unit: customUnit } = parseCustom();

  const setCustom = (c: number, u: string) => onChange(`custom_${Math.max(1, c)}${u}`);

  return (
    <div className="grid gap-2">
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={isCustom ? "custom" : value}
        onChange={e => e.target.value === "custom" ? onChange("custom_1d") : onChange(e.target.value)}
      >
        <option value="none">Nenhuma</option>
        <option value="daily">Diária</option>
        <option value="weekly">Semanal (7 dias)</option>
        <option value="biweekly">Quinzenal (14 dias)</option>
        <option value="monthly">Mensal</option>
        <option value="quarterly">Trimestral</option>
        <option value="custom">Personalizado...</option>
      </select>

      {isCustom && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">A cada</span>
          <Input
            type="number" min={1} max={365}
            className="w-20 h-9 text-center"
            value={customCount}
            onChange={e => setCustom(parseInt(e.target.value) || 1, customUnit)}
          />
          <select
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={customUnit}
            onChange={e => setCustom(customCount, e.target.value)}
          >
            <option value="d">dias</option>
            <option value="w">semanas</option>
            <option value="m">meses</option>
          </select>
        </div>
      )}
    </div>
  );
}

const TAG_COLORS = [
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700", "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700", "bg-pink-100 text-pink-700",
];

function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Retorna data local YYYY-MM-DD (evita bug UTC do toISOString)
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDate7Days(): string {
  return localDateStr(new Date(Date.now() + 7 * 86_400_000));
}

function dueDateInfo(dateStr: string | null, status: string) {
  if (!dateStr || status === "concluido") return { label: "", color: "", urgent: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr + "T00:00:00");
  const diff  = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)   return { label: `Venceu há ${Math.abs(diff)}d`,    color: "text-red-600 bg-red-50 border-red-200",          urgent: true  };
  if (diff === 0) return { label: "Vence hoje",                       color: "text-orange-600 bg-orange-50 border-orange-200", urgent: true  };
  if (diff === 1) return { label: "Amanhã",                           color: "text-amber-600 bg-amber-50 border-amber-200",    urgent: false };
  if (diff <= 7)  return { label: due.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }), color: "text-amber-600 bg-amber-50 border-amber-200", urgent: false };
  return { label: due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), color: "text-muted-foreground bg-muted border-border", urgent: false };
}

function checklistProgress(items: ChecklistItem[]) {
  if (!items.length) return null;
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
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
  name: string; description: string; priority: string;
  due_date: string; company_id: string; recurrence: string;
  assigned_to: string; estimated_hours: string;
  tags: string[]; checklist: ChecklistItem[]; blocked_by_ids: string[];
}

const EMPTY_FORM: TaskFormData = {
  name: "", description: "", priority: "normal", due_date: "",
  company_id: "", recurrence: "none", assigned_to: "", estimated_hours: "",
  tags: [], checklist: [], blocked_by_ids: [],
};

// ── ChecklistEditor ─────────────────────────────────────────────────────────

function ChecklistEditor({
  items, onChange,
}: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [newText, setNewText] = useState("");

  const add = () => {
    const t = newText.trim();
    if (!t) return;
    onChange([...items, { id: nanoid(), text: t, done: false }]);
    setNewText("");
  };

  const toggle = (id: string) =>
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i));

  const remove = (id: string) => onChange(items.filter(i => i.id !== id));

  const updateText = (id: string, text: string) =>
    onChange(items.map(i => i.id === id ? { ...i, text } : i));

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group/cl">
          <Checkbox
            checked={item.done}
            onCheckedChange={() => toggle(item.id)}
            className="shrink-0"
          />
          <input
            value={item.text}
            onChange={e => updateText(item.id, e.target.value)}
            className={`flex-1 text-sm bg-transparent border-none outline-none ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}
          />
          <button
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover/cl:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-4 h-4 rounded border border-dashed border-muted-foreground/40 shrink-0" />
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Adicionar item..."
          className="flex-1 text-sm bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground"
        />
        {newText && (
          <button onClick={add} className="text-xs text-primary font-medium">OK</button>
        )}
      </div>
    </div>
  );
}

// ── TagEditor ──────────────────────────────────────────────────────────────

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim().toLowerCase();
    if (!t || tags.includes(t)) { setInput(""); return; }
    onChange([...tags, t]);
    setInput("");
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span key={tag} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tagColor(tag)}`}>
          {tag}
          <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:opacity-60">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? "Adicionar tag..." : "+"}
        className="text-xs bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/40 min-w-[80px] max-w-[120px]"
      />
    </div>
  );
}

// ── TaskDetailSheet ────────────────────────────────────────────────────────

function TaskDetailSheet({
  task, tasks, companies, open, onClose, onSave, onDelete,
}: {
  task: TaskItem | null; tasks: TaskItem[]; companies: CompanyItem[];
  open: boolean; onClose: () => void;
  onSave: (id: string, updates: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<Partial<TaskItem>>({});
  const [dirty, setDirty] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setForm({ ...task });
      setDirty(false);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [task?.id]);

  if (!task) return null;

  const patch = (updates: Partial<TaskItem>) => {
    setForm(prev => ({ ...prev, ...updates }));
    setDirty(true);
  };

  const save = () => {
    if (!form.name?.trim()) { toast.error("Informe um título."); return; }
    onSave(task.id, {
      name:             form.name?.trim(),
      description:      form.description?.trim() || null,
      priority:         form.priority,
      due_date:         form.due_date || null,
      company_id:       form.company_id || null,
      assigned_to:      form.assigned_to?.trim() || null,
      estimated_hours:  form.estimated_hours ?? null,
      checklist:        form.checklist ?? [],
      tags:             form.tags ?? [],
      blocked_by_ids:   form.blocked_by_ids ?? [],
    });
    setDirty(false);
    toast.success("Tarefa salva!");
  };

  const handleClose = () => {
    if (dirty) save();
    onClose();
  };

  const prog = checklistProgress(form.checklist ?? []);
  const dd   = dueDateInfo(form.due_date ?? null, form.status ?? "a_receber");

  const blockers = (form.blocked_by_ids ?? [])
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as TaskItem[];

  const availableBlockers = tasks.filter(
    t => t.id !== task.id && t.status !== "concluido" && !(form.blocked_by_ids ?? []).includes(t.id)
  );

  const isBlocked = blockers.some(b => b.status !== "concluido");

  return (
    <Sheet open={open} onOpenChange={o => !o && handleClose()}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Status toggle */}
              <button
                onClick={() => patch({ status: form.status === "concluido" ? "a_receber" : "concluido" })}
                className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
              >
                {form.status === "concluido"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : form.status === "em_progresso"
                    ? <Clock className="w-5 h-5 text-amber-500" />
                    : <Circle className="w-5 h-5" />}
              </button>
              <input
                ref={titleRef}
                value={form.name ?? ""}
                onChange={e => patch({ name: e.target.value })}
                onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
                className={`font-semibold text-base bg-transparent border-none outline-none w-full ${
                  form.status === "concluido" ? "line-through text-muted-foreground" : "text-foreground"
                }`}
                placeholder="Título da tarefa"
              />
            </div>
            {isBlocked && (
              <span title="Bloqueada por outra tarefa">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              </span>
            )}
          </div>
          {/* Status pills */}
          <div className="flex gap-1.5 mt-2">
            {(["a_receber", "em_progresso", "concluido"] as const).map(s => {
              const labels = { a_receber: "A Fazer", em_progresso: "Em Progresso", concluido: "Concluído" };
              const colors = {
                a_receber:    form.status === s ? "bg-slate-200 text-slate-700"   : "hover:bg-slate-100 text-muted-foreground",
                em_progresso: form.status === s ? "bg-amber-200 text-amber-800"   : "hover:bg-amber-50 text-muted-foreground",
                concluido:    form.status === s ? "bg-emerald-200 text-emerald-800" : "hover:bg-emerald-50 text-muted-foreground",
              };
              return (
                <button
                  key={s}
                  onClick={() => patch({ status: s })}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${colors[s]}`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-5">

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Prioridade */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Prioridade</Label>
                <select
                  value={form.priority ?? "normal"}
                  onChange={e => patch({ priority: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
              {/* Vencimento */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date ?? ""}
                  onChange={e => patch({ due_date: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {/* Empresa */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Empresa</Label>
                <select
                  value={form.company_id ?? ""}
                  onChange={e => patch({ company_id: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Nenhuma</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Responsável */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Responsável</Label>
                <Input
                  value={form.assigned_to ?? ""}
                  onChange={e => patch({ assigned_to: e.target.value })}
                  placeholder="Nome..."
                  className="h-9 text-sm"
                />
              </div>
              {/* Estimativa */}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Estimativa (horas)</Label>
                <Input
                  type="number"
                  min="0" step="0.5"
                  value={form.estimated_hours ?? ""}
                  onChange={e => patch({ estimated_hours: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Ex: 2.5"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Due date alert */}
            {dd.label && (
              <div className={`text-xs font-medium px-3 py-2 rounded-lg border ${dd.color}`}>
                📅 {dd.label}
              </div>
            )}

            {/* Descrição */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={e => patch({ description: e.target.value })}
                placeholder="Adicione detalhes, contexto ou links..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" /> Checklist
                  {prog && <span className="font-normal normal-case">({prog.done}/{prog.total})</span>}
                </Label>
                {prog && (
                  <span className={`text-xs font-semibold ${prog.pct === 100 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {prog.pct}%
                  </span>
                )}
              </div>
              {prog && (
                <Progress value={prog.pct} className="h-1.5" />
              )}
              <ChecklistEditor
                items={form.checklist ?? []}
                onChange={items => patch({ checklist: items })}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </Label>
              <TagEditor
                tags={form.tags ?? []}
                onChange={tags => patch({ tags })}
              />
            </div>

            {/* Dependências */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Bloqueada por
              </Label>

              {blockers.length > 0 && (
                <div className="space-y-1">
                  {blockers.map(b => (
                    <div key={b.id} className="flex items-center gap-2 text-sm py-1 px-2.5 rounded-lg bg-muted/50">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${b.status === "concluido" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className="flex-1 text-foreground truncate">{b.name}</span>
                      {b.status === "concluido" && <span className="text-xs text-emerald-600">✓</span>}
                      <button
                        onClick={() => patch({ blocked_by_ids: (form.blocked_by_ids ?? []).filter(id => id !== b.id) })}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableBlockers.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) patch({ blocked_by_ids: [...(form.blocked_by_ids ?? []), e.target.value] });
                  }}
                  className="w-full h-9 rounded-md border border-dashed border-input bg-background px-2 text-sm text-muted-foreground"
                >
                  <option value="">+ Adicionar bloqueio...</option>
                  {availableBlockers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Recorrência info */}
            {task.recurrence_pattern && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                Recorrente: {recurrenceLabel(task.recurrence_pattern)}
              </div>
            )}

            {/* Bloqueio aviso */}
            {isBlocked && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Esta tarefa está bloqueada até que as dependências sejam concluídas.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => { onDelete(task.id); onClose(); }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── New Task Modal ─────────────────────────────────────────────────────────

function NewTaskModal({ isOpen, onClose, onSave, companies }: {
  isOpen: boolean; onClose: () => void;
  onSave: (t: TaskFormData) => void;
  companies: CompanyItem[];
}) {
  const [data, setData] = useState<TaskFormData>(EMPTY_FORM);
  const patch = (p: Partial<TaskFormData>) => setData(prev => ({ ...prev, ...p }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) { toast.error("Informe um título para a tarefa."); return; }
    if (data.recurrence !== "none" && !data.due_date) {
      toast.error("Para tarefas recorrentes, informe uma data de vencimento."); return;
    }
    onSave(data);
    setData(EMPTY_FORM);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { setData(EMPTY_FORM); onClose(); } }}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>Crie uma tarefa e complete os detalhes depois.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Título *</Label>
            <Input value={data.name} onChange={e => patch({ name: e.target.value })}
              placeholder="Ex: Preparar relatório mensal" autoFocus required />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={data.description} onChange={e => patch({ description: e.target.value })}
              placeholder="Detalhes adicionais" rows={2} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Empresa / Cliente</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={data.company_id} onChange={e => patch({ company_id: e.target.value })}>
                <option value="">Nenhuma empresa</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={data.priority} onChange={e => patch({ priority: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Data de vencimento</Label>
              <Input type="date" value={data.due_date} onChange={e => patch({ due_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Input value={data.assigned_to} onChange={e => patch({ assigned_to: e.target.value })}
                placeholder="Nome..." />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Recorrência</Label>
            <RecurrencePicker value={data.recurrence} onChange={v => patch({ recurrence: v })} />
          </div>
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => { setData(EMPTY_FORM); onClose(); }}>Cancelar</Button>
            <Button type="submit">Criar Tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── TaskRow (List view) ────────────────────────────────────────────────────

function TaskRow({ task, companies, allTasks, onToggle, onOpen, onDelete }: {
  task: TaskItem; companies: CompanyItem[]; allTasks: TaskItem[];
  onToggle: (t: TaskItem) => void;
  onOpen: (t: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const isDone     = task.status === "concluido";
  const inProgress = task.status === "em_progresso";
  const pCfg       = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
  const dd         = dueDateInfo(task.due_date, task.status);
  const prog       = checklistProgress(task.checklist);
  const company    = task.company_id ? companies.find(c => c.id === task.company_id)?.name : null;
  const isBlocked  = (task.blocked_by_ids ?? []).some(id => {
    const blocker = allTasks.find(t => t.id === id);
    return blocker && blocker.status !== "concluido";
  });

  return (
    <div
      className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer ${isDone ? "opacity-55" : ""}`}
      onClick={() => onOpen(task)}
    >
      {/* Toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(task); }}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors"
      >
        {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : inProgress ? <Clock className="w-5 h-5 text-amber-500" />
          : <Circle className="w-5 h-5" />}
      </button>

      {/* Priority dot */}
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${pCfg.dot}`} />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.name}
          </span>
          {isBlocked && <span title="Bloqueada"><Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>}
          {task.recurrence_pattern && (
            <span title={recurrenceLabel(task.recurrence_pattern)}><RefreshCw className="w-3 h-3 text-emerald-500 shrink-0" /></span>
          )}
        </div>

        {/* Tags + meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>{tag}</span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
          )}
          {company && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />{company}
            </span>
          )}
          {task.assigned_to && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />{task.assigned_to}
            </span>
          )}
          {task.estimated_hours && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />{task.estimated_hours}h
            </span>
          )}
        </div>

        {/* Checklist progress */}
        {prog && (
          <div className="flex items-center gap-2">
            <Progress value={prog.pct} className="h-1 w-20" />
            <span className="text-xs text-muted-foreground">{prog.done}/{prog.total}</span>
          </div>
        )}
      </div>

      {/* Right side: date + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {dd.label && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${dd.color}`}>
            {dd.label}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onOpen(task); }}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={e => { e.stopPropagation(); onDelete(task.id); }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────

function SectionHeader({
  label, count, icon: Icon, color, open, onToggle,
}: {
  label: string; count: number; icon: React.ElementType; color: string;
  open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-1.5 text-sm font-semibold hover:text-foreground transition-colors group/sh"
    >
      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={color}>{label}</span>
      <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
      <div className="flex-1" />
    </button>
  );
}

// ── Board Card (Kanban) ────────────────────────────────────────────────────

function BoardCard({ task, companies, allTasks, onOpen, onToggle }: {
  task: TaskItem; companies: CompanyItem[]; allTasks: TaskItem[];
  onOpen: (t: TaskItem) => void; onToggle: (t: TaskItem) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const pCfg    = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
  const dd      = dueDateInfo(task.due_date, task.status);
  const prog    = checklistProgress(task.checklist);
  const company = task.company_id ? companies.find(c => c.id === task.company_id)?.name : null;
  const isBlocked = (task.blocked_by_ids ?? []).some(id => {
    const blocker = allTasks.find(t => t.id === id);
    return blocker && blocker.status !== "concluido";
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all space-y-2"
      onClick={() => onOpen(task)}
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0" onClick={e => e.stopPropagation()}>
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isBlocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
            <span className="text-sm font-medium text-foreground leading-snug">{task.name}</span>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggle(task); }}
          className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
        >
          {task.status === "concluido"
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <Circle className="w-4 h-4" />}
        </button>
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>{tag}</span>
          ))}
          {task.tags.length > 2 && <span className="text-xs text-muted-foreground">+{task.tags.length - 2}</span>}
        </div>
      )}

      {prog && (
        <div className="flex items-center gap-2 pl-5">
          <Progress value={prog.pct} className="h-1 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">{prog.done}/{prog.total}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pl-5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border font-medium ${pCfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />{pCfg.label}
        </span>
        {dd.label && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${dd.color}`}>
            {dd.label}
          </span>
        )}
        {company && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">{company}</span>
        )}
        {task.assigned_to && (
          <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0" title={task.assigned_to}>
            {task.assigned_to.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── BoardColumn ────────────────────────────────────────────────────────────

function BoardColumn({
  id, label, color, headerColor, items, companies, allTasks, onOpen, onToggle,
}: {
  id: string; label: string; color: string; headerColor: string;
  items: TaskItem[]; companies: CompanyItem[]; allTasks: TaskItem[];
  onOpen: (t: TaskItem) => void; onToggle: (t: TaskItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 min-h-[200px] transition-colors ${color} ${isOver ? "border-primary/40 bg-primary/5" : ""}`}
    >
      <div className={`px-4 py-3 border-b border-border/50 flex items-center justify-between`}>
        <h3 className={`text-sm font-semibold ${headerColor}`}>{label}</h3>
        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-2">
          {items.map(task => (
            <BoardCard
              key={task.id}
              task={task}
              companies={companies}
              allTasks={allTasks}
              onOpen={onOpen}
              onToggle={onToggle}
            />
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-6">Arraste tarefas aqui</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Processes() {
  const queryClient = useQueryClient();
  const [isNewOpen,    setIsNewOpen]    = useState(false);
  const [detailTask,   setDetailTask]   = useState<TaskItem | null>(null);
  const [view,         setView]         = useState<"list" | "board">("list");
  const [search,       setSearch]       = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCompany,  setFilterCompany]  = useState("");
  const [activeDragTask, setActiveDragTask] = useState<TaskItem | null>(null);
  const [openSections, setOpenSections] = useState({
    overdue: true, today: true, week: true, later: false, noDate: false, done: false,
  });

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
          id:               String(r.id ?? ""),
          name:             String(r.name ?? ""),
          description:      r.description ? String(r.description) : null,
          status:           String(r.status ?? "a_receber"),
          priority:         String(r.priority ?? "normal"),
          due_date:         r.due_date ? String(r.due_date).slice(0, 10) : null,
          company_id:       r.company_id ? String(r.company_id) : null,
          recurrence_pattern: r.recurrence_pattern ? String(r.recurrence_pattern) : null,
          parent_task_id:   r.parent_task_id ? String(r.parent_task_id) : null,
          checklist:        Array.isArray(r.checklist) ? (r.checklist as ChecklistItem[]) : [],
          tags:             Array.isArray(r.tags) ? (r.tags as string[]) : [],
          assigned_to:      r.assigned_to ? String(r.assigned_to) : null,
          estimated_hours:  r.estimated_hours ? Number(r.estimated_hours) : null,
          blocked_by_ids:   Array.isArray(r.blocked_by_ids) ? (r.blocked_by_ids as string[]) : [],
        } satisfies TaskItem;
      });
    },
    retry: 1,
  });

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
        assigned_to: form.assigned_to || null,
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
    onError: (err: Error) => toast.error(`Erro ao criar: ${err.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskItem> }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["all-tasks"] });
      const prev = queryClient.getQueryData<TaskItem[]>(["all-tasks"]);
      queryClient.setQueryData(["all-tasks"], (old: TaskItem[] | undefined) =>
        old?.map(t => t.id === id ? { ...t, ...updates } : t) ?? []
      );
      // Sync detail panel if open
      if (detailTask?.id === id) setDetailTask(d => d ? { ...d, ...updates } : d);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["all-tasks"], context.prev);
      toast.error("Erro ao atualizar tarefa.");
    },
    onSuccess: async ({ updates, id }) => {
      if (updates.status === "concluido") {
        const task = tasks.find(t => t.id === id);
        if (task?.recurrence_pattern) {
          toast.success(`Concluída! Próxima (${recurrenceLabel(task.recurrence_pattern)}) criada.`);
        }
        if (task) runAutomations("task_completed", "any", { entityTitle: task.name, companyId: task.company_id }).catch(() => {});
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
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

  const handleBoardDragStart = ({ active }: DragStartEvent) => {
    setActiveDragTask(tasks.find(t => t.id === String(active.id)) ?? null);
  };

  const handleBoardDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragTask(null);
    if (!over || active.id === over.id) return;
    const dragged = tasks.find(t => t.id === String(active.id));
    if (!dragged) return;
    const overTask   = tasks.find(t => t.id === String(over.id));
    const targetStatus = overTask ? overTask.status : String(over.id);
    if (dragged.status !== targetStatus)
      updateTask.mutate({ id: dragged.id, updates: { status: targetStatus } });
  };

  // Filters
  const filtered = useMemo(() => {
    let list = tasks;
    if (search)          list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.includes(search.toLowerCase())));
    if (filterPriority)  list = list.filter(t => t.priority === filterPriority);
    if (filterCompany)   list = list.filter(t => t.company_id === filterCompany);
    return list;
  }, [tasks, search, filterPriority, filterCompany]);

  // Sections (usando data LOCAL, não UTC)
  const sections = useMemo(() => {
    const todayStr = localDateStr();
    const next7Str = localDate7Days();
    const active   = filtered.filter(t => t.status !== "concluido");
    return {
      overdue: active.filter(t => t.due_date && t.due_date < todayStr),
      today:   active.filter(t => t.due_date === todayStr),
      week:    active.filter(t => t.due_date && t.due_date > todayStr && t.due_date <= next7Str),
      later:   active.filter(t => t.due_date && t.due_date > next7Str),
      noDate:  active.filter(t => !t.due_date),
      done:    filtered.filter(t => t.status === "concluido"),
    };
  }, [filtered]);

  const boardGroups = useMemo(() => ({
    a_receber:    { label: "A Fazer",      color: "border-slate-200 bg-slate-50/60",    headerColor: "text-slate-600",   items: filtered.filter(t => t.status === "a_receber")    },
    em_progresso: { label: "Em Progresso", color: "border-amber-200 bg-amber-50/60",    headerColor: "text-amber-600",   items: filtered.filter(t => t.status === "em_progresso") },
    concluido:    { label: "Concluído",    color: "border-emerald-200 bg-emerald-50/60", headerColor: "text-emerald-600", items: filtered.filter(t => t.status === "concluido")    },
  }), [filtered]);

  const stats = useMemo(() => {
    const todayStr = localDateStr();
    const weekAgo  = localDateStr(new Date(Date.now() - 7 * 86_400_000));
    const active   = tasks.filter(t => t.status !== "concluido");
    const total    = active.length + tasks.filter(t => t.status === "concluido").length;
    const done     = tasks.filter(t => t.status === "concluido").length;
    return {
      total:    active.length,
      overdue:  active.filter(t => t.due_date && t.due_date < todayStr).length,
      today:    active.filter(t => t.due_date === todayStr).length,
      doneWeek: tasks.filter(t => t.status === "concluido" && t.due_date && t.due_date >= weekAgo).length,
      pct:      total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks]);

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground text-sm">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando tarefas...
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-red-500 text-sm font-medium">Erro ao carregar tarefas.</p>
      <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["all-tasks"] })}>
        Tentar novamente
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">A Fazeres</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie tarefas da agência por cliente, prazo e prioridade.</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Em aberto</p>
          <Progress value={stats.pct} className="h-1 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">{stats.pct}% concluídas</p>
        </div>
        <div className={`rounded-xl border p-4 ${stats.overdue > 0 ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
          <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600" : "text-foreground"}`}>{stats.overdue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Atrasadas</p>
          {stats.overdue > 0 && <p className="text-xs text-red-500 font-medium mt-1">⚠ Atenção imediata</p>}
        </div>
        <div className={`rounded-xl border p-4 ${stats.today > 0 ? "border-orange-200 bg-orange-50" : "border-border bg-card"}`}>
          <p className={`text-2xl font-bold ${stats.today > 0 ? "text-orange-600" : "text-foreground"}`}>{stats.today}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Vencem hoje</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.doneWeek}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Concluídas (7d)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, tag..." value={search} onChange={e => setSearch(e.target.value)} />
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

      {/* Modals / Sheet */}
      <NewTaskModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onSave={form => createTask.mutate(form)}
        companies={companies}
      />
      <TaskDetailSheet
        task={detailTask}
        tasks={tasks}
        companies={companies}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onSave={(id, updates) => updateTask.mutate({ id, updates })}
        onDelete={id => deleteTask.mutate(id)}
      />

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="space-y-3">
          {([
            { key: "overdue" as const, label: "Atrasadas",    icon: AlertCircle,   color: "text-red-600"    },
            { key: "today"   as const, label: "Hoje",         icon: CalendarClock, color: "text-orange-600" },
            { key: "week"    as const, label: "Esta semana",  icon: CalendarCheck, color: "text-amber-600"  },
            { key: "later"   as const, label: "Depois",       icon: ChevronDown,   color: "text-slate-500"  },
            { key: "noDate"  as const, label: "Sem data",     icon: Circle,        color: "text-slate-400"  },
            { key: "done"    as const, label: "Concluídas",   icon: CheckCircle2,  color: "text-emerald-600"},
          ] as const).map(({ key, label, icon, color }) => {
            const items = sections[key];
            if (items.length === 0 && key !== "today" && key !== "overdue") return null;
            const isOpen = openSections[key];
            return (
              <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30">
                  <SectionHeader
                    label={label}
                    count={items.length}
                    icon={icon}
                    color={color}
                    open={isOpen}
                    onToggle={() => toggleSection(key)}
                  />
                </div>
                {isOpen && (
                  <div className="py-1">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {key === "today" ? "Nenhuma tarefa para hoje 🎉" : "Nenhuma tarefa nesta seção."}
                      </p>
                    ) : (
                      items.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          companies={companies}
                          allTasks={tasks}
                          onToggle={handleToggle}
                          onOpen={setDetailTask}
                          onDelete={id => deleteTask.mutate(id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (search || filterPriority || filterCompany) && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhuma tarefa encontrada com os filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {view === "board" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleBoardDragStart}
          onDragEnd={handleBoardDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(boardGroups).map(([id, group]) => (
              <BoardColumn
                key={id}
                id={id}
                label={group.label}
                color={group.color}
                headerColor={group.headerColor}
                items={group.items}
                companies={companies}
                allTasks={tasks}
                onOpen={setDetailTask}
                onToggle={handleToggle}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragTask && (
              <div className="bg-card border border-primary/30 rounded-lg p-3 shadow-xl opacity-90 text-sm font-medium">
                {activeDragTask.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
