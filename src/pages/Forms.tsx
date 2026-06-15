import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus, Trash2, GripVertical, ExternalLink, Copy, Check,
  ClipboardList, ArrowLeft, Settings, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  type: 'short_text' | 'email' | 'tel' | 'long_text' | 'choice';
  label: string;
  placeholder?: string;
  required: boolean;
  choices?: string[];
  maps_to?: 'name' | 'email' | 'phone' | 'notes' | '';
}

interface FormSettings {
  thank_you_title?: string;
  thank_you_message?: string;
  accent_color?: string;
  bg_color?: string;
}

interface LeadForm {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions: Question[];
  settings: FormSettings;
  is_active: boolean;
  response_count: number;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: 'short_text',
    label: '',
    required: false,
    maps_to: '',
  };
}

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'email',      label: 'E-mail' },
  { value: 'tel',        label: 'Telefone' },
  { value: 'long_text',  label: 'Texto longo' },
  { value: 'choice',     label: 'Múltipla escolha' },
] as const;

const MAPS_TO_OPTIONS = [
  { value: '',      label: 'Nenhum (campo extra)' },
  { value: 'name',  label: 'Nome do lead' },
  { value: 'email', label: 'E-mail do lead' },
  { value: 'phone', label: 'Telefone do lead' },
  { value: 'notes', label: 'Observações' },
];

// ── Question Editor ───────────────────────────────────────────────────────────
function QuestionEditor({
  q, index, total, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  q: Question; index: number; total: number;
  onChange: (q: Question) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {q.label || <span className="text-muted-foreground italic">Pergunta sem título</span>}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">{QUESTION_TYPES.find(t => t.value === q.type)?.label}</Badge>
        {q.required && <Badge className="text-[10px] shrink-0">obrigatório</Badge>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Pergunta</Label>
              <Input
                value={q.label}
                onChange={(e) => onChange({ ...q, label: e.target.value })}
                placeholder="Ex: Qual é o seu nome?"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <select
                value={q.type}
                onChange={(e) => onChange({ ...q, type: e.target.value as Question['type'], choices: e.target.value === 'choice' ? ['Opção 1', 'Opção 2'] : undefined })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mapear para campo de lead</Label>
              <select
                value={q.maps_to ?? ''}
                onChange={(e) => onChange({ ...q, maps_to: e.target.value as Question['maps_to'] })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {MAPS_TO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Placeholder (opcional)</Label>
              <Input
                value={q.placeholder ?? ''}
                onChange={(e) => onChange({ ...q, placeholder: e.target.value })}
                placeholder="Digite aqui..."
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Switch
                checked={q.required}
                onCheckedChange={(v) => onChange({ ...q, required: v })}
                id={`req-${q.id}`}
              />
              <Label htmlFor={`req-${q.id}`} className="text-xs cursor-pointer">Obrigatório</Label>
            </div>
          </div>

          {/* Choices */}
          {q.type === 'choice' && (
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {(q.choices ?? []).map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={c}
                    onChange={(e) => {
                      const ch = [...(q.choices ?? [])];
                      ch[i] = e.target.value;
                      onChange({ ...q, choices: ch });
                    }}
                    className="h-8 text-sm"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => onChange({ ...q, choices: (q.choices ?? []).filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => onChange({ ...q, choices: [...(q.choices ?? []), ''] })}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar opção
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={onMoveUp}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={onMoveDown}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onRemove}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Builder ──────────────────────────────────────────────────────────────
function FormBuilder({
  initial, onSave, onCancel, isSaving,
}: {
  initial?: Partial<LeadForm>;
  onSave: (data: Omit<LeadForm, 'id' | 'response_count' | 'created_at'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle]           = useState(initial?.title ?? '');
  const [slug, setSlug]             = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [questions, setQuestions]   = useState<Question[]>(initial?.questions ?? [newQuestion()]);
  const [settings, setSettings]     = useState<FormSettings>(initial?.settings ?? {
    accent_color: '#3b82f6',
    bg_color: '#0f172a',
    thank_you_title: 'Recebemos suas respostas!',
    thank_you_message: 'Obrigado pelo contato. Entraremos em breve!',
  });
  const [isActive, setIsActive]     = useState(initial?.is_active ?? true);
  const [tab, setTab]               = useState<'questions' | 'settings'>('questions');
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const updateQuestion = (i: number, q: Question) => {
    setQuestions((qs) => qs.map((x, j) => (j === i ? q : x)));
  };
  const removeQuestion = (i: number) => {
    setQuestions((qs) => qs.filter((_, j) => j !== i));
  };
  const moveUp = (i: number) => {
    if (i === 0) return;
    setQuestions((qs) => { const a = [...qs]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
  };
  const moveDown = (i: number) => {
    setQuestions((qs) => {
      if (i === qs.length - 1) return qs;
      const a = [...qs]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a;
    });
  };

  const handleSave = () => {
    if (!title.trim()) { toast.error('Dê um título ao formulário'); return; }
    if (!slug.trim())  { toast.error('Slug é obrigatório'); return; }
    if (questions.some((q) => !q.label.trim())) { toast.error('Todas as perguntas precisam de um texto'); return; }
    onSave({ title: title.trim(), slug: slug.trim(), description, questions, settings, is_active: isActive });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{initial?.id ? 'Editar formulário' : 'Novo formulário'}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} id="form-active" />
          <Label htmlFor="form-active" className="text-xs">Ativo</Label>
          <Button onClick={handleSave} disabled={isSaving} className="ml-2">
            {isSaving ? 'Salvando...' : 'Salvar formulário'}
          </Button>
        </div>
      </div>

      {/* Title + Slug */}
      <div className="stat-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Título do formulário</Label>
            <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Ex: Fale conosco" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug (URL pública)</Label>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground shrink-0">/f/</span>
              <Input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                placeholder="fale-conosco"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Uma breve descrição exibida na tela inicial do formulário" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['questions', 'settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'questions' ? 'Perguntas' : 'Configurações'}
          </button>
        ))}
      </div>

      {/* Questions */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id} q={q} index={i} total={questions.length}
              onChange={(nq) => updateQuestion(i, nq)}
              onRemove={() => removeQuestion(i)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
          <Button variant="outline" className="w-full" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar pergunta
          </Button>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="stat-card space-y-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Aparência & Mensagens
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Cor de destaque</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.accent_color ?? '#3b82f6'}
                  onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                  className="h-9 w-12 rounded border border-input cursor-pointer" />
                <Input value={settings.accent_color ?? '#3b82f6'}
                  onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
                  className="h-9 font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.bg_color ?? '#0f172a'}
                  onChange={(e) => setSettings((s) => ({ ...s, bg_color: e.target.value }))}
                  className="h-9 w-12 rounded border border-input cursor-pointer" />
                <Input value={settings.bg_color ?? '#0f172a'}
                  onChange={(e) => setSettings((s) => ({ ...s, bg_color: e.target.value }))}
                  className="h-9 font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título da tela de obrigado</Label>
              <Input value={settings.thank_you_title ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, thank_you_title: e.target.value }))}
                placeholder="Recebemos suas respostas!" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem de obrigado</Label>
              <Input value={settings.thank_you_message ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, thank_you_message: e.target.value }))}
                placeholder="Entraremos em contato em breve!" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Forms() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LeadForm | null | 'new'>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useQuery<LeadForm[]>({
    queryKey: ['lead-forms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_forms')
        .select('id, title, slug, description, questions, settings, is_active, response_count, created_at')
        .eq('auth_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveForm = useMutation({
    mutationFn: async (data: Omit<LeadForm, 'id' | 'response_count' | 'created_at'> & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase.from('lead_forms')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', data.id).eq('auth_user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lead_forms')
          .insert({ ...data, auth_user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-forms', user?.id] });
      setEditing(null);
      toast.success('Formulário salvo!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_forms').delete().eq('id', id).eq('auth_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-forms', user?.id] });
      toast.success('Formulário excluído');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

  const copyUrl = (slug: string, id: string) => {
    navigator.clipboard.writeText(formUrl(slug));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (editing) {
    const isEdit = editing !== 'new';
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <FormBuilder
          initial={isEdit ? (editing as LeadForm) : undefined}
          onSave={(data) => saveForm.mutate(isEdit ? { ...data, id: (editing as LeadForm).id } : data)}
          onCancel={() => setEditing(null)}
          isSaving={saveForm.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Formulários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie formulários públicos estilo Typeform para captar leads
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" /> Novo formulário
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Nenhum formulário criado ainda.</p>
          <Button variant="outline" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro formulário
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <div key={f.id} className="stat-card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{f.title}</span>
                  <Badge variant={f.is_active ? 'default' : 'secondary'} className="text-[10px] h-4">
                    {f.is_active ? 'ativo' : 'inativo'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {f.questions?.length ?? 0} perguntas
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {f.response_count ?? 0} respostas
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">/f/{f.slug}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar link"
                  onClick={() => copyUrl(f.slug, f.id)}>
                  {copiedId === f.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir formulário"
                  onClick={() => window.open(formUrl(f.slug), '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Pré-visualizar"
                  onClick={() => window.open(formUrl(f.slug), '_blank')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => setEditing(f)}>
                  Editar
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Excluir formulário?')) deleteForm.mutate(f.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
