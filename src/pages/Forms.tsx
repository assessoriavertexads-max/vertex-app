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
  Calendar, ImagePlus, Palette, LayoutTemplate, CheckSquare, Radio,
  BarChart2, EyeOff,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleSettings {
  available_days: number[];
  time_slots: string[];
  duration_minutes: number;
}

interface Question {
  id: string;
  type: 'short_text' | 'email' | 'tel' | 'long_text' | 'choice' | 'schedule';
  label: string;
  placeholder?: string;
  required: boolean;
  choices?: string[];
  maps_to?: 'name' | 'email' | 'phone' | 'notes' | '';
  schedule_settings?: ScheduleSettings;
  image_url?: string;
  image_position?: 'left' | 'right';
}

interface FormSettings {
  // Cores
  accent_color?: string;
  bg_color?: string;
  // Tela Inicial
  welcome_show_title?: boolean;
  welcome_custom_title?: string;
  welcome_subtitle?: string;
  welcome_image_url?: string;
  welcome_image_position?: 'top' | 'left' | 'right' | 'background';
  welcome_button_text?: string;
  // Tela de Obrigado
  thank_you_title?: string;
  thank_you_message?: string;
  thank_you_image_url?: string;
  // Rastreamento
  meta_pixel_id?: string;
  // Exibição
  show_progress_bar?: boolean;
  show_branding?: boolean;
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
  return { id: crypto.randomUUID(), type: 'short_text', label: '', required: false, maps_to: '' };
}

function defaultScheduleSettings(): ScheduleSettings {
  return {
    available_days: [1, 2, 3, 4, 5],
    time_slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
    duration_minutes: 30,
  };
}

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'email',      label: 'E-mail' },
  { value: 'tel',        label: 'Telefone' },
  { value: 'long_text',  label: 'Texto longo' },
  { value: 'choice',     label: 'Múltipla escolha' },
  { value: 'schedule',   label: 'Agendamento (Calendly)' },
] as const;

const MAPS_TO_OPTIONS = [
  { value: '',      label: 'Nenhum (campo extra)' },
  { value: 'name',  label: 'Nome do lead' },
  { value: 'email', label: 'E-mail do lead' },
  { value: 'phone', label: 'Telefone do lead' },
  { value: 'notes', label: 'Observações' },
];

const DAY_LABELS  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DURATIONS   = [15, 30, 45, 60, 90];

// ── Settings Section Card ─────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// ── Color Row ─────────────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-input cursor-pointer p-0.5" />
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono text-sm flex-1" />
      </div>
    </div>
  );
}

// ── Schedule Settings Editor ──────────────────────────────────────────────────
function ScheduleSettingsEditor({ settings, onChange }: { settings: ScheduleSettings; onChange: (s: ScheduleSettings) => void }) {
  const toggleDay = (day: number) => {
    const days = settings.available_days.includes(day)
      ? settings.available_days.filter((d) => d !== day)
      : [...settings.available_days, day].sort();
    onChange({ ...settings, available_days: days });
  };

  return (
    <div className="space-y-4 p-3 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" /> Configurações de Agendamento
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Dias disponíveis</Label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, idx) => (
            <button key={idx} type="button" onClick={() => toggleDay(idx)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                settings.available_days.includes(idx)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Duração da reunião</Label>
        <select value={settings.duration_minutes}
          onChange={(e) => onChange({ ...settings, duration_minutes: Number(e.target.value) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          {DURATIONS.map((d) => <option key={d} value={d}>{d} minutos</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Horários disponíveis</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {settings.time_slots.map((slot, i) => (
            <div key={i} className="flex gap-1">
              <input type="time" value={slot}
                onChange={(e) => {
                  const s = [...settings.time_slots]; s[i] = e.target.value;
                  onChange({ ...settings, time_slots: s });
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => onChange({ ...settings, time_slots: settings.time_slots.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs mt-1"
          onClick={() => onChange({ ...settings, time_slots: [...settings.time_slots, '09:00'] })}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar horário
        </Button>
      </div>
    </div>
  );
}

// ── Question Editor ───────────────────────────────────────────────────────────
function QuestionEditor({ q, index, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  q: Question; index: number; total: number;
  onChange: (q: Question) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);

  const handleTypeChange = (type: Question['type']) => {
    if (type === 'choice')
      onChange({ ...q, type, choices: q.choices ?? ['Opção 1', 'Opção 2'], schedule_settings: undefined });
    else if (type === 'schedule')
      onChange({ ...q, type, choices: undefined, maps_to: '', schedule_settings: q.schedule_settings ?? defaultScheduleSettings() });
    else
      onChange({ ...q, type, choices: undefined, schedule_settings: undefined });
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}>
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        {q.type === 'schedule' && <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />}
        {q.image_url && <ImagePlus className="h-3.5 w-3.5 text-primary/60 shrink-0" />}
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {q.label || <span className="text-muted-foreground italic">Pergunta sem título</span>}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {QUESTION_TYPES.find((t) => t.value === q.type)?.label}
        </Badge>
        {q.required && <Badge className="text-[10px] shrink-0">obrigatório</Badge>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Pergunta</Label>
              <Input value={q.label}
                onChange={(e) => onChange({ ...q, label: e.target.value })}
                placeholder={q.type === 'schedule' ? 'Ex: Escolha uma data para a reunião' : 'Ex: Qual é o seu nome?'}
                className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <select value={q.type} onChange={(e) => handleTypeChange(e.target.value as Question['type'])}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {q.type !== 'schedule' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Mapear para campo de lead</Label>
                <select value={q.maps_to ?? ''} onChange={(e) => onChange({ ...q, maps_to: e.target.value as Question['maps_to'] })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {MAPS_TO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}

            {q.type !== 'schedule' && q.type !== 'choice' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder (opcional)</Label>
                <Input value={q.placeholder ?? ''} onChange={(e) => onChange({ ...q, placeholder: e.target.value })}
                  placeholder="Digite aqui..." className="h-9" />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Switch checked={q.required} onCheckedChange={(v) => onChange({ ...q, required: v })} id={`req-${q.id}`} />
              <Label htmlFor={`req-${q.id}`} className="text-xs cursor-pointer">Obrigatório</Label>
            </div>
          </div>

          {/* Choices */}
          {q.type === 'choice' && (
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {(q.choices ?? []).map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={c}
                    onChange={(e) => { const ch = [...(q.choices ?? [])]; ch[i] = e.target.value; onChange({ ...q, choices: ch }); }}
                    className="h-8 text-sm" />
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

          {/* Schedule settings */}
          {q.type === 'schedule' && (
            <ScheduleSettingsEditor
              settings={q.schedule_settings ?? defaultScheduleSettings()}
              onChange={(s) => onChange({ ...q, schedule_settings: s })}
            />
          )}

          {/* Image option */}
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch id={`img-${q.id}`}
                checked={q.image_url !== undefined}
                onCheckedChange={(v) => onChange({ ...q, image_url: v ? '' : undefined, image_position: v ? 'right' : undefined })}
              />
              <Label htmlFor={`img-${q.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> Imagem nesta pergunta (divisão)
              </Label>
            </div>

            {q.image_url !== undefined && (
              <div className="ml-8 space-y-2">
                <Input value={q.image_url}
                  onChange={(e) => onChange({ ...q, image_url: e.target.value })}
                  placeholder="https://... URL da imagem" className="h-8 text-sm" />
                <div className="flex gap-2">
                  {(['left', 'right'] as const).map((pos) => (
                    <button key={pos} type="button" onClick={() => onChange({ ...q, image_position: pos })}
                      className={`flex-1 py-1.5 px-3 text-xs rounded-md border transition-colors ${
                        (q.image_position ?? 'right') === pos
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}>
                      {pos === 'left' ? '◀ Imagem à esquerda' : 'Imagem à direita ▶'}
                    </button>
                  ))}
                </div>
                {q.image_url && (
                  <img src={q.image_url} alt="preview" className="h-24 w-auto rounded border border-border object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            )}
          </div>

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
function FormBuilder({ initial, onSave, onCancel, isSaving }: {
  initial?: Partial<LeadForm>;
  onSave: (data: Omit<LeadForm, 'id' | 'response_count' | 'created_at'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle]             = useState(initial?.title ?? '');
  const [slug, setSlug]               = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [questions, setQuestions]     = useState<Question[]>(initial?.questions ?? [newQuestion()]);
  const [settings, setSettings]       = useState<FormSettings>(initial?.settings ?? {
    accent_color: '#3b82f6',
    bg_color: '#0f172a',
    welcome_show_title: true,
    welcome_button_text: 'Começar',
    thank_you_title: 'Recebemos suas respostas!',
    thank_you_message: 'Obrigado pelo contato. Entraremos em breve!',
    show_progress_bar: true,
    show_branding: true,
  });
  const [isActive, setIsActive]       = useState(initial?.is_active ?? true);
  const [tab, setTab]                 = useState<'questions' | 'settings'>('questions');
  const [slugEdited, setSlugEdited]   = useState(!!initial?.slug);

  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleTitleChange = (v: string) => { setTitle(v); if (!slugEdited) setSlug(slugify(v)); };
  const updateQ  = (i: number, q: Question) => setQuestions((qs) => qs.map((x, j) => j === i ? q : x));
  const removeQ  = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));
  const moveUp   = (i: number) => { if (i === 0) return; setQuestions((qs) => { const a = [...qs]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; }); };
  const moveDown = (i: number) => setQuestions((qs) => { if (i === qs.length - 1) return qs; const a = [...qs]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });

  const handleSave = () => {
    if (!title.trim()) { toast.error('Dê um título ao formulário'); return; }
    if (!slug.trim())  { toast.error('Slug é obrigatório'); return; }
    if (questions.some((q) => !q.label.trim())) { toast.error('Todas as perguntas precisam de um texto'); return; }
    onSave({ title: title.trim(), slug: slug.trim(), description, questions, settings, is_active: isActive });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="h-4 w-4" /></Button>
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
              <Input value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                placeholder="fale-conosco" className="font-mono text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição exibida na tela inicial do formulário" />
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

      {/* ── Questions Tab ── */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {/* Variáveis de piping */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs space-y-2">
            <p className="font-semibold text-primary">💡 Insira respostas anteriores no texto das perguntas:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { code: '{{primeiro_nome}}', desc: 'Primeiro nome' },
                { code: '{{nome}}',          desc: 'Nome completo' },
                { code: '{{email}}',         desc: 'E-mail' },
                { code: '{{telefone}}',      desc: 'Telefone' },
                { code: '{{q1}}',            desc: 'Resposta da pergunta 1' },
                { code: '{{q2}}',            desc: 'Resposta da pergunta 2' },
              ].map(({ code, desc }) => (
                <span key={code} className="inline-flex items-center gap-1 bg-background border border-border rounded-md px-2 py-0.5 text-[11px]">
                  <code className="text-primary font-mono">{code}</code>
                  <span className="text-muted-foreground">→ {desc}</span>
                </span>
              ))}
            </div>
            <p className="text-muted-foreground/70 italic">
              Ex: <span className="text-foreground/60 not-italic">{'{{primeiro_nome}}'}</span>, qual o seu melhor e-mail?
            </p>
          </div>

          {questions.map((q, i) => (
            <QuestionEditor key={q.id} q={q} index={i} total={questions.length}
              onChange={(nq) => updateQ(i, nq)}
              onRemove={() => removeQ(i)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)} />
          ))}
          <Button variant="outline" className="w-full"
            onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar pergunta
          </Button>
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <div className="space-y-4">

          {/* Cores */}
          <Section title="Cores" icon={<Palette className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorRow label="Cor de destaque"
                value={settings.accent_color ?? '#3b82f6'}
                onChange={(v) => set('accent_color', v)} />
              <ColorRow label="Cor de fundo"
                value={settings.bg_color ?? '#0f172a'}
                onChange={(v) => set('bg_color', v)} />
            </div>
          </Section>

          {/* Tela Inicial */}
          <Section title="Tela Inicial" icon={<LayoutTemplate className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Show title toggle */}
              <div className="sm:col-span-2 flex items-center gap-3">
                <Switch id="show-title"
                  checked={settings.welcome_show_title ?? true}
                  onCheckedChange={(v) => set('welcome_show_title', v)} />
                <Label htmlFor="show-title" className="text-sm cursor-pointer">
                  Mostrar título na tela inicial
                </Label>
              </div>

              {(settings.welcome_show_title ?? true) && (
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Título personalizado (deixe vazio para usar o título do formulário)</Label>
                  <Input value={settings.welcome_custom_title ?? ''}
                    onChange={(e) => set('welcome_custom_title', e.target.value)}
                    placeholder={title || 'Título do formulário'} />
                </div>
              )}

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Subtítulo / Descrição</Label>
                <Input value={settings.welcome_subtitle ?? ''}
                  onChange={(e) => set('welcome_subtitle', e.target.value)}
                  placeholder="Uma breve descrição exibida abaixo do título" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Texto do botão</Label>
                <Input value={settings.welcome_button_text ?? 'Começar'}
                  onChange={(e) => set('welcome_button_text', e.target.value)}
                  placeholder="Começar" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Posição da imagem</Label>
                <select value={settings.welcome_image_position ?? 'top'}
                  onChange={(e) => set('welcome_image_position', e.target.value as FormSettings['welcome_image_position'])}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="top">Topo (logo)</option>
                  <option value="left">Divisão — Esquerda</option>
                  <option value="right">Divisão — Direita</option>
                  <option value="background">Fundo (background)</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">URL da imagem / logo</Label>
                <Input value={settings.welcome_image_url ?? ''}
                  onChange={(e) => set('welcome_image_url', e.target.value)}
                  placeholder="https://... (logo, banner ou foto)" />
                {settings.welcome_image_url && (
                  <img src={settings.welcome_image_url} alt="preview"
                    className="mt-2 h-28 w-auto rounded border border-border object-contain bg-muted/20"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
            </div>
          </Section>

          {/* Tela de Obrigado */}
          <Section title="Tela de Obrigado" icon={<CheckSquare className="h-4 w-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={settings.thank_you_title ?? ''}
                  onChange={(e) => set('thank_you_title', e.target.value)}
                  placeholder="Recebemos suas respostas!" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem</Label>
                <Input value={settings.thank_you_message ?? ''}
                  onChange={(e) => set('thank_you_message', e.target.value)}
                  placeholder="Entraremos em contato em breve!" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">URL da imagem (opcional)</Label>
                <Input value={settings.thank_you_image_url ?? ''}
                  onChange={(e) => set('thank_you_image_url', e.target.value)}
                  placeholder="https://..." />
              </div>
            </div>
          </Section>

          {/* Rastreamento */}
          <Section title="Rastreamento" icon={<BarChart2 className="h-4 w-4" />}>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta Pixel ID</Label>
              <Input value={settings.meta_pixel_id ?? ''}
                onChange={(e) => set('meta_pixel_id', e.target.value)}
                placeholder="Ex: 1234567890123456"
                className="font-mono" />
              <p className="text-[11px] text-muted-foreground">
                O pixel dispara <code className="bg-muted px-1 rounded">PageView</code> ao abrir e <code className="bg-muted px-1 rounded">Lead</code> ao enviar o formulário.
              </p>
            </div>
          </Section>

          {/* Exibição */}
          <Section title="Exibição" icon={<EyeOff className="h-4 w-4" />}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch id="show-progress"
                  checked={settings.show_progress_bar ?? true}
                  onCheckedChange={(v) => set('show_progress_bar', v)} />
                <Label htmlFor="show-progress" className="text-sm cursor-pointer">
                  Mostrar barra de progresso
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="show-branding"
                  checked={settings.show_branding ?? true}
                  onCheckedChange={(v) => set('show_branding', v)} />
                <Label htmlFor="show-branding" className="text-sm cursor-pointer">
                  Mostrar "powered by Vertex"
                </Label>
              </div>
            </div>
          </Section>
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
        const { error } = await supabase.from('lead_forms').insert({ ...data, auth_user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-forms', user?.id] }); setEditing(null); toast.success('Formulário salvo!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_forms').delete().eq('id', id).eq('auth_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-forms', user?.id] }); toast.success('Formulário excluído'); },
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
          isSaving={saveForm.isPending} />
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
                  {f.questions?.some((q) => q.type === 'schedule') && (
                    <Badge variant="outline" className="text-[10px] h-4 text-primary border-primary/30">
                      <Calendar className="h-2.5 w-2.5 mr-1" /> agendamento
                    </Badge>
                  )}
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
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => window.open(formUrl(f.slug), '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => window.open(formUrl(f.slug), '_blank')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(f)}>
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
