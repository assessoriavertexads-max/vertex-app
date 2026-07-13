import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Check, Loader2, ChevronDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleSettings {
  available_days?: number[];
  time_slots?: string[];
  duration_minutes?: number;
}

interface Question {
  id: string;
  type: 'short_text' | 'email' | 'tel' | 'long_text' | 'choice' | 'schedule';
  label: string;
  placeholder?: string;
  required: boolean;
  choices?: string[];
  maps_to?: string;
  schedule_settings?: ScheduleSettings;
  image_url?: string;
  image_position?: 'left' | 'right';
}

interface FormSettings {
  accent_color?: string;
  bg_color?: string;
  welcome_show_title?: boolean;
  welcome_custom_title?: string;
  welcome_subtitle?: string;
  welcome_image_url?: string;
  welcome_image_position?: 'top' | 'left' | 'right' | 'background';
  welcome_button_text?: string;
  thank_you_title?: string;
  thank_you_message?: string;
  thank_you_image_url?: string;
  meta_pixel_id?: string;
  show_progress_bar?: boolean;
  show_branding?: boolean;
}

interface LeadForm {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  settings: FormSettings;
}

// ── Answer interpolation ──────────────────────────────────────────────────────
function interpolate(text: string, questions: Question[], answers: Record<string, string>): string {
  let out = text;
  for (const q of questions) {
    const val = (answers[q.id] ?? '').trim();
    if (!val) continue;
    if (q.maps_to === 'name') {
      out = out.replaceAll('{{nome}}', val);
      out = out.replaceAll('{{primeiro_nome}}', val.split(' ')[0]);
    }
    if (q.maps_to === 'email')  out = out.replaceAll('{{email}}', val);
    if (q.maps_to === 'phone')  out = out.replaceAll('{{telefone}}', val);
  }
  questions.forEach((q, i) => {
    const val = (answers[q.id] ?? '').trim();
    if (val) out = out.replaceAll(`{{q${i + 1}}}`, val);
  });
  return out;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
      <div className="h-full transition-all duration-500 ease-out"
        style={{ width: `${total > 0 ? Math.round((current / total) * 100) : 0}%`, backgroundColor: color }} />
    </div>
  );
}

// ── Schedule Picker ───────────────────────────────────────────────────────────
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function SchedulePicker({ schedSettings, value, onChange, onAdvance, accentColor }: {
  schedSettings?: ScheduleSettings;
  value: string; onChange: (v: string) => void; onAdvance: () => void; accentColor: string;
}) {
  const availableDays = schedSettings?.available_days ?? [1,2,3,4,5];
  const timeSlots     = schedSettings?.time_slots     ?? ['09:00','10:00','11:00','14:00','15:00','16:00'];
  const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const initDateStr   = value.includes('T') ? value.split('T')[0] : (value.length === 10 ? value : null);
  const initMonth     = initDateStr ? new Date(initDateStr + 'T12:00:00') : new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), 1);

  const [currentMonth, setCurrentMonth]       = useState(() => new Date(initMonth.getFullYear(), initMonth.getMonth(), 1));
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(initDateStr);
  const selectedTimeStr = value.includes('T') ? value.split('T')[1]?.slice(0,5) : null;

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const startOffset    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first

  const isAvailable = (day: number) => {
    const d = new Date(year, month, day);
    if (d <= todayMidnight) return false;
    return availableDays.includes(d.getDay());
  };

  const toDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const handleDayClick = (day: number) => {
    if (!isAvailable(day)) return;
    const ds = toDateStr(day);
    setSelectedDateStr(ds);
    if (selectedTimeStr) onChange(`${ds}T${selectedTimeStr}`);
  };

  const handleTimeClick = (time: string) => {
    if (!selectedDateStr) return;
    onChange(`${selectedDateStr}T${time}`);
    setTimeout(onAdvance, 350);
  };

  const formatDisplay = (ds: string) =>
    new Date(ds + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="w-full mt-2">
      <div className="flex flex-col sm:flex-row gap-6 lg:gap-10">
        {/* Calendar */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white font-semibold">{MONTH_NAMES[month]} {year}</span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d) => (
              <div key={d} className="text-center text-white/30 text-xs py-1 w-10">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} className="w-10 h-10" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds  = toDateStr(day);
              const avail    = isAvailable(day);
              const selected = selectedDateStr === ds;
              return (
                <button key={day} onClick={() => handleDayClick(day)} disabled={!avail}
                  className={['w-10 h-10 flex items-center justify-center rounded-full text-sm font-medium transition-all',
                    !avail   && 'text-white/15 cursor-not-allowed',
                    avail && !selected && 'text-white/80 hover:bg-white/15 hover:text-white cursor-pointer',
                    selected && 'text-white font-bold cursor-pointer',
                  ].filter(Boolean).join(' ')}
                  style={selected ? { backgroundColor: accentColor } : {}}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        {selectedDateStr && (
          <div className="flex-1 sm:border-l sm:border-white/10 sm:pl-6">
            <p className="text-white/60 text-sm mb-4 capitalize font-medium">
              <Calendar className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />{formatDisplay(selectedDateStr)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {timeSlots.map((time) => {
                const sel = selectedTimeStr === time && value.startsWith(selectedDateStr);
                return (
                  <button key={time} onClick={() => handleTimeClick(time)}
                    className={['py-2.5 px-5 rounded-lg text-sm font-medium border transition-all text-left',
                      sel ? 'text-white border-transparent' : 'text-white/70 border-white/20 hover:border-white/50 hover:text-white hover:bg-white/10',
                    ].join(' ')}
                    style={sel ? { backgroundColor: accentColor, borderColor: accentColor } : {}}>
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {!selectedDateStr && <p className="text-white/25 text-sm mt-5">Clique em uma data disponível para ver os horários</p>}
      {selectedDateStr && !value.includes('T') && <p className="text-white/25 text-sm mt-4">Selecione um horário →</p>}
      {value.includes('T') && (
        <p className="text-white/50 text-sm mt-4">
          <Check className="w-3.5 h-3.5 inline mr-1" style={{ color: accentColor }} />
          {formatDisplay(value.split('T')[0])} às {value.split('T')[1]?.slice(0,5)}
        </p>
      )}
    </div>
  );
}

// ── Question Content (inner) ──────────────────────────────────────────────────
function QuestionContent({ question, index, total, value, onChange, onNext, onBack, canGoBack, isLast, isSubmitting, accentColor, animKey }: {
  question: Question; index: number; total: number; value: string;
  onChange: (v: string) => void; onNext: () => void; onBack: () => void;
  canGoBack: boolean; isLast: boolean; isSubmitting: boolean; accentColor: string; animKey: number;
}) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (question.type !== 'schedule') {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [animKey, question.type]);

  const canAdvance = !question.required || (
    question.type === 'schedule' ? value.includes('T') : value.trim().length > 0
  );

  const inputClass = 'w-full bg-transparent border-0 border-b-2 border-white/30 focus:border-white/80 focus:outline-none text-white text-2xl md:text-3xl py-3 placeholder:text-white/30 transition-colors resize-none';

  return (
    <>
      <p className="text-white/50 text-sm font-medium mb-6 flex items-center gap-2">
        <span className="font-bold text-white/80">{index + 1}</span>
        <ArrowRight className="w-3 h-3" />
        <span>{total} perguntas</span>
      </p>

      <h2 className="text-white text-2xl md:text-4xl font-semibold leading-snug mb-8">
        {question.label}
        {question.required && <span style={{ color: accentColor }} className="ml-1">*</span>}
      </h2>

      {question.type === 'schedule' ? (
        <SchedulePicker schedSettings={question.schedule_settings} value={value}
          onChange={onChange} onAdvance={onNext} accentColor={accentColor} />
      ) : question.type === 'choice' ? (
        <div className="space-y-3 mb-8">
          {(question.choices ?? []).map((choice, i) => (
            <button key={choice}
              onClick={() => { onChange(choice); setTimeout(onNext, 300); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border transition-all text-white text-lg ${
                value === choice ? 'border-white bg-white/20' : 'border-white/20 hover:border-white/50 hover:bg-white/10'
              }`}>
              <span className="w-7 h-7 rounded border border-white/40 flex items-center justify-center text-xs font-bold shrink-0"
                style={value === choice ? { backgroundColor: accentColor, borderColor: accentColor } : {}}>
                {value === choice ? <Check className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              {choice}
            </button>
          ))}
        </div>
      ) : question.type === 'long_text' ? (
        <>
          <textarea ref={inputRef as React.Ref<HTMLTextAreaElement>} value={value}
            onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder ?? 'Escreva aqui...'}
            rows={4} className={inputClass}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) onNext(); }} />
          <p className="text-white/30 text-xs mt-2">⌘ + Enter para avançar</p>
        </>
      ) : (
        <input ref={inputRef as React.Ref<HTMLInputElement>}
          type={question.type === 'email' ? 'email' : question.type === 'tel' ? 'tel' : 'text'}
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? 'Digite aqui...'} className={inputClass}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } }}
          autoComplete={question.type === 'email' ? 'email' : question.type === 'tel' ? 'tel' : 'off'} />
      )}

      <div className="flex items-center gap-3 mt-8">
        <Button onClick={onNext} disabled={!canAdvance || isSubmitting}
          className="text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: canAdvance ? accentColor : 'rgba(255,255,255,0.15)' }}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" />
            : isLast ? <><Check className="w-4 h-4" /> Enviar</>
            : <><span>OK</span><ArrowRight className="w-4 h-4" /></>}
        </Button>
        {canGoBack && (
          <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {question.type !== 'choice' && question.type !== 'schedule' && (
          <span className="text-white/30 text-xs ml-1">
            pressione <kbd className="bg-white/10 rounded px-1.5 py-0.5 text-white/50">Enter ↵</kbd>
          </span>
        )}
      </div>
    </>
  );
}

// ── Question Step (handles split layout) ─────────────────────────────────────
function QuestionStep(props: {
  question: Question; index: number; total: number; value: string;
  onChange: (v: string) => void; onNext: () => void; onBack: () => void;
  canGoBack: boolean; isLast: boolean; isSubmitting: boolean; accentColor: string; animKey: number;
}) {
  const { question, animKey } = props;

  if (question.image_url) {
    const imgLeft = question.image_position === 'left';
    return (
      <div key={animKey} className="tf-enter w-full flex min-h-full">
        {imgLeft && (
          <div className="w-5/12 hidden md:block relative">
            <img src={question.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center px-8 md:px-16 py-16">
          <div className="w-full max-w-xl"><QuestionContent {...props} /></div>
        </div>
        {!imgLeft && (
          <div className="w-5/12 hidden md:block relative">
            <img src={question.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div key={animKey} className="tf-enter w-full max-w-2xl mx-auto px-6 md:px-0">
      <QuestionContent {...props} />
    </div>
  );
}

// ── Welcome Screen ────────────────────────────────────────────────────────────
function WelcomeScreen({ form, onStart, accentColor, animKey }: {
  form: LeadForm; onStart: () => void; accentColor: string; animKey: number;
}) {
  const s          = form.settings;
  const showTitle  = s.welcome_show_title ?? true;
  const title      = s.welcome_custom_title || form.title;
  const subtitle   = s.welcome_subtitle || form.description;
  const imageUrl   = s.welcome_image_url;
  const imagePos   = s.welcome_image_position ?? 'top';
  const buttonText = s.welcome_button_text ?? 'Começar';

  const textContent = (
    <div key={animKey} className="tf-enter">
      {imageUrl && imagePos === 'top' && (
        <img src={imageUrl} alt="logo" className="h-16 w-auto mb-8 object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
      {showTitle && title && (
        <h1 className="text-white text-4xl md:text-6xl font-bold leading-tight mb-4">{title}</h1>
      )}
      {subtitle && (
        <p className="text-white/60 text-lg md:text-xl mb-10 leading-relaxed">{subtitle}</p>
      )}
      <Button onClick={onStart}
        className="text-white font-semibold px-8 py-3 text-lg rounded-xl flex items-center gap-2"
        style={{ backgroundColor: accentColor }}>
        {buttonText} <ArrowRight className="w-5 h-5" />
      </Button>
      <p className="text-white/30 text-xs mt-4">
        pressione <kbd className="bg-white/10 rounded px-1.5 py-0.5">Enter ↵</kbd> para iniciar
      </p>
    </div>
  );

  if (imageUrl && imagePos === 'background') {
    return (
      <div className="w-full min-h-screen flex items-center justify-center relative">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full max-w-2xl mx-auto px-6">{textContent}</div>
      </div>
    );
  }

  if (imageUrl && (imagePos === 'left' || imagePos === 'right')) {
    return (
      <div className="w-full min-h-screen flex">
        {imagePos === 'left' && (
          <div className="w-5/12 hidden md:block relative">
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center px-8 md:px-20">
          <div className="w-full max-w-xl">{textContent}</div>
        </div>
        {imagePos === 'right' && (
          <div className="w-5/12 hidden md:block relative">
            <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
      </div>
    );
  }

  // Default: centered
  return (
    <div className="w-full max-w-2xl mx-auto px-6 md:px-0">{textContent}</div>
  );
}

// ── Thank You Screen ──────────────────────────────────────────────────────────
function ThankYouScreen({ settings, accentColor, scheduledAt }: {
  settings: FormSettings; accentColor: string; scheduledAt?: string;
}) {
  const formattedDate = scheduledAt
    ? new Date(scheduledAt).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="tf-enter w-full max-w-2xl mx-auto px-6 md:px-0 text-center">
      {settings.thank_you_image_url ? (
        <img src={settings.thank_you_image_url} alt=""
          className="h-20 w-auto mx-auto mb-6 object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: accentColor }}>
          <Check className="w-8 h-8 text-white" />
        </div>
      )}
      <h2 className="text-white text-4xl font-bold mb-4">
        {settings.thank_you_title ?? 'Recebemos suas respostas!'}
      </h2>
      <p className="text-white/60 text-xl leading-relaxed">
        {settings.thank_you_message ?? 'Obrigado pelo seu contato. Entraremos em breve!'}
      </p>
      {formattedDate && (
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm">
          <Calendar className="w-4 h-4" style={{ color: accentColor }} />
          Reunião agendada: {formattedDate}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicForm() {
  const { slug }      = useParams<{ slug: string }>();
  const [step, setStep]       = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [animKey, setAnimKey] = useState(0);

  const { data: form, isLoading, isError, error: formError } = useQuery<LeadForm>({
    queryKey: ['public-form', slug],
    queryFn: async () => {
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/submit-form?slug=${encodeURIComponent(slug!)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.error ?? 'Formulário não encontrado');
      return payload as LeadForm;
    },
    enabled: !!slug,
    retry: 1,
  });

  // Meta Pixel injection
  useEffect(() => {
    const pid = form?.settings?.meta_pixel_id;
    if (!pid) return;
    const s = document.createElement('script');
    s.id = 'fb-pixel';
    s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pid}');fbq('track','PageView');`;
    document.head.appendChild(s);
    return () => { document.getElementById('fb-pixel')?.remove(); };
  }, [form?.settings?.meta_pixel_id]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('submit-form', { body: { slug, answers } });
      if (error) throw error;
    },
    onSuccess: () => {
      const pid = form?.settings?.meta_pixel_id;
      if (pid && (window as { fbq?: (...a: unknown[]) => void }).fbq) {
        (window as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'Lead');
      }
      setStep(form?.questions.length ?? 0);
      setAnimKey((k) => k + 1);
    },
  });

  const questions   = form?.questions ?? [];
  const s           = form?.settings ?? {};
  const accentColor = s.accent_color ?? '#3b82f6';
  const bgColor     = s.bg_color     ?? '#0f172a';

  const scheduledAt = (() => {
    for (const q of questions) {
      if (q.type === 'schedule' && answers[q.id]?.includes('T')) return answers[q.id];
    }
    return undefined;
  })();

  const goNext = useCallback(() => {
    if (step === -1) { setStep(0); setAnimKey((k) => k + 1); return; }
    const q = questions[step];
    if (q?.required) {
      const val = answers[q.id] ?? '';
      if (q.type === 'schedule' ? !val.includes('T') : !val.trim()) return;
    }
    if (step >= questions.length - 1) { submitMutation.mutate(); }
    else { setStep((p) => p + 1); setAnimKey((k) => k + 1); }
  }, [step, questions, answers, submitMutation]);

  const goBack = useCallback(() => {
    if (step <= 0) { setStep(-1); setAnimKey((k) => k + 1); return; }
    setStep((p) => p - 1); setAnimKey((k) => k + 1);
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (step === -1 && e.key === 'Enter') goNext(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, goNext]);

  useEffect(() => {
    if (form?.settings?.welcome_custom_title || form?.title)
      document.title = form.settings.welcome_custom_title || form.title;
    return () => { document.title = 'Vertos'; };
  }, [form?.title, form?.settings?.welcome_custom_title]);

  // Detect split layout for current step
  const currentQ     = step >= 0 && !isLoading && step < questions.length ? questions[step] : null;
  const isWelcomeSplit = step === -1 && !!s.welcome_image_url && (s.welcome_image_position === 'left' || s.welcome_image_position === 'right');
  const isQSplit       = !!currentQ?.image_url;
  const isSplit        = isWelcomeSplit || isQSplit;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (isError || !form) {
    const msg = (formError as Error)?.message ?? 'Formulário não encontrado';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center max-w-sm px-6">
          <p className="text-white text-2xl font-semibold mb-2">Oops!</p>
          <p className="text-white/60 mb-1">{msg}</p>
          <p className="text-white/30 text-sm">Verifique o link ou tente novamente.</p>
        </div>
      </div>
    );
  }

  const isDone = step >= questions.length;

  return (
    <div className={['min-h-screen relative overflow-hidden', isSplit ? 'flex' : 'flex flex-col items-center justify-center'].join(' ')}
      style={{ backgroundColor: bgColor }}>

      {/* Progress bar */}
      {step >= 0 && !isDone && (s.show_progress_bar ?? true) && (
        <ProgressBar current={step + 1} total={questions.length} color={accentColor} />
      )}

      {/* Content */}
      <div className={['w-full', isSplit ? 'flex flex-1 min-h-screen' : 'flex items-center justify-center flex-1 py-12'].join(' ')}>
        {step === -1 && (
          <WelcomeScreen key={animKey} form={form} onStart={goNext} accentColor={accentColor} animKey={animKey} />
        )}

        {step >= 0 && !isDone && questions[step] && (
          <QuestionStep
            key={animKey}
            question={{ ...questions[step], label: interpolate(questions[step].label, questions, answers) }}
            index={step} total={questions.length}
            value={answers[questions[step].id] ?? ''}
            onChange={(v) => setAnswers((a) => ({ ...a, [questions[step].id]: v }))}
            onNext={goNext} onBack={goBack}
            canGoBack={step > 0}
            isLast={step === questions.length - 1}
            isSubmitting={submitMutation.isPending}
            accentColor={accentColor} animKey={animKey} />
        )}

        {isDone && (
          <ThankYouScreen key={animKey} settings={form.settings} accentColor={accentColor} scheduledAt={scheduledAt} />
        )}
      </div>

      {/* Scroll hint on welcome */}
      {step === -1 && (
        <div className="fixed bottom-6 right-6 flex flex-col items-center gap-1 text-white/30">
          <span className="text-[10px] font-medium tracking-wider uppercase">scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" style={{ color: accentColor }} />
        </div>
      )}

      {/* Branding */}
      {(s.show_branding ?? true) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-white/20 text-xs">powered by Vertos</span>
        </div>
      )}
    </div>
  );
}
