import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Check, Loader2, ChevronDown } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  type: 'short_text' | 'email' | 'tel' | 'long_text' | 'choice';
  label: string;
  placeholder?: string;
  required: boolean;
  choices?: string[];
  maps_to?: 'name' | 'email' | 'phone' | 'notes';
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
  description?: string;
  questions: Question[];
  settings: FormSettings;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Question Step ─────────────────────────────────────────────────────────────
interface StepProps {
  question: Question;
  index: number;
  total: number;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  accentColor: string;
  animKey: number;
}

function QuestionStep({
  question, index, total, value, onChange, onNext, onBack,
  canGoBack, isLast, isSubmitting, accentColor, animKey,
}: StepProps) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [animKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && question.type !== 'long_text') {
      e.preventDefault();
      onNext();
    }
  };

  const canAdvance = !question.required || value.trim().length > 0;

  const inputClass =
    "w-full bg-transparent border-0 border-b-2 border-white/30 focus:border-white/80 focus:outline-none " +
    "text-white text-2xl md:text-3xl py-3 placeholder:text-white/30 transition-colors resize-none";

  return (
    <div key={animKey} className="tf-enter w-full max-w-2xl mx-auto px-6 md:px-0">
      {/* Question number */}
      <p className="text-white/50 text-sm font-medium mb-6 flex items-center gap-2">
        <span className="font-bold text-white/80">{index + 1}</span>
        <ArrowRight className="w-3 h-3" />
        <span>{total} perguntas</span>
      </p>

      {/* Question label */}
      <h2 className="text-white text-2xl md:text-4xl font-semibold leading-snug mb-8">
        {question.label}
        {question.required && <span style={{ color: accentColor }} className="ml-1">*</span>}
      </h2>

      {/* Input */}
      {question.type === 'choice' ? (
        <div className="space-y-3 mb-8">
          {(question.choices ?? []).map((choice, i) => (
            <button
              key={choice}
              onClick={() => { onChange(choice); setTimeout(onNext, 300); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border transition-all text-white text-lg
                ${value === choice
                  ? 'border-white bg-white/20'
                  : 'border-white/20 hover:border-white/50 hover:bg-white/10'
                }`}
            >
              <span className="w-7 h-7 rounded border border-white/40 flex items-center justify-center text-xs font-bold shrink-0"
                style={value === choice ? { backgroundColor: accentColor, borderColor: accentColor } : {}}>
                {value === choice ? <Check className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              {choice}
            </button>
          ))}
        </div>
      ) : question.type === 'long_text' ? (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? 'Escreva aqui...'}
          rows={4}
          className={inputClass}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) onNext(); }}
        />
      ) : (
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={question.type === 'email' ? 'email' : question.type === 'tel' ? 'tel' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? 'Digite aqui...'}
          className={inputClass}
          onKeyDown={handleKeyDown}
          autoComplete={question.type === 'email' ? 'email' : question.type === 'tel' ? 'tel' : 'off'}
        />
      )}

      {/* Hint for textarea */}
      {question.type === 'long_text' && (
        <p className="text-white/30 text-xs mt-2">⌘ + Enter para avançar</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-8">
        <Button
          onClick={onNext}
          disabled={!canAdvance || isSubmitting}
          className="text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all"
          style={{ backgroundColor: canAdvance ? accentColor : 'rgba(255,255,255,0.15)' }}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLast ? (
            <><Check className="w-4 h-4" /> Enviar</>
          ) : (
            <><span>OK</span> <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>

        {canGoBack && (
          <button onClick={onBack} className="text-white/50 hover:text-white/80 transition-colors p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {question.type !== 'choice' && (
          <span className="text-white/30 text-xs ml-1">
            pressione <kbd className="bg-white/10 rounded px-1.5 py-0.5 text-white/50">Enter ↵</kbd>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Welcome Screen ────────────────────────────────────────────────────────────
function WelcomeScreen({
  title, description, onStart, accentColor, animKey,
}: { title: string; description?: string; onStart: () => void; accentColor: string; animKey: number }) {
  return (
    <div key={animKey} className="tf-enter w-full max-w-2xl mx-auto px-6 md:px-0">
      <h1 className="text-white text-4xl md:text-6xl font-bold leading-tight mb-4">{title}</h1>
      {description && (
        <p className="text-white/60 text-lg md:text-xl mb-10 leading-relaxed">{description}</p>
      )}
      <Button
        onClick={onStart}
        className="text-white font-semibold px-8 py-3 text-lg rounded-xl flex items-center gap-2"
        style={{ backgroundColor: accentColor }}
      >
        Começar <ArrowRight className="w-5 h-5" />
      </Button>
      <p className="text-white/30 text-xs mt-4">
        pressione <kbd className="bg-white/10 rounded px-1.5 py-0.5">Enter ↵</kbd> para iniciar
      </p>
    </div>
  );
}

// ── Thank You Screen ──────────────────────────────────────────────────────────
function ThankYouScreen({ settings, accentColor }: { settings: FormSettings; accentColor: string }) {
  return (
    <div className="tf-enter w-full max-w-2xl mx-auto px-6 md:px-0 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: accentColor }}>
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-white text-4xl font-bold mb-4">
        {settings.thank_you_title ?? 'Recebemos suas respostas!'}
      </h2>
      <p className="text-white/60 text-xl leading-relaxed">
        {settings.thank_you_message ?? 'Obrigado pelo seu contato. Entraremos em breve!'}
      </p>
    </div>
  );
}

// ── Scroll hint ───────────────────────────────────────────────────────────────
function ScrollHint({ color }: { color: string }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-center gap-1 text-white/30">
      <span className="text-[10px] font-medium tracking-wider uppercase">scroll</span>
      <ChevronDown className="w-4 h-4 animate-bounce" style={{ color }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(-1); // -1=welcome, 0..n-1=questions, n=thanks
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [animKey, setAnimKey] = useState(0);

  const { data: form, isLoading, isError } = useQuery<LeadForm>({
    queryKey: ['public-form', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_forms')
        .select('id, title, description, questions, settings')
        .eq('slug', slug!)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) throw new Error('Formulário não encontrado');
      return data as LeadForm;
    },
    enabled: !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('submit-form', {
        body: { slug, answers },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setStep((form?.questions.length ?? 0));
      setAnimKey((k) => k + 1);
    },
  });

  const questions = form?.questions ?? [];
  const accentColor = form?.settings?.accent_color ?? '#3b82f6';
  const bgColor = form?.settings?.bg_color ?? '#0f172a';

  const goNext = useCallback(() => {
    if (step === -1) {
      setStep(0);
      setAnimKey((k) => k + 1);
      return;
    }
    const q = questions[step];
    if (q?.required && !answers[q.id]?.trim()) return;

    if (step >= questions.length - 1) {
      submitMutation.mutate();
    } else {
      setStep((s) => s + 1);
      setAnimKey((k) => k + 1);
    }
  }, [step, questions, answers, submitMutation]);

  const goBack = useCallback(() => {
    if (step <= 0) { setStep(-1); setAnimKey((k) => k + 1); return; }
    setStep((s) => s - 1);
    setAnimKey((k) => k + 1);
  }, [step]);

  // Keyboard: Enter on welcome screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (step === -1 && e.key === 'Enter') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, goNext]);

  // Update page title
  useEffect(() => {
    if (form?.title) document.title = form.title;
    return () => { document.title = 'Vertex'; };
  }, [form?.title]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center">
          <p className="text-white text-2xl font-semibold mb-2">Formulário não encontrado</p>
          <p className="text-white/40">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const isDone = step >= questions.length;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Progress */}
      {step >= 0 && !isDone && (
        <ProgressBar current={step + 1} total={questions.length} color={accentColor} />
      )}

      {/* Content */}
      <div className="w-full flex items-center justify-center flex-1">
        {step === -1 && (
          <WelcomeScreen
            key={animKey}
            title={form.title}
            description={form.description}
            onStart={goNext}
            accentColor={accentColor}
            animKey={animKey}
          />
        )}

        {step >= 0 && !isDone && questions[step] && (
          <QuestionStep
            key={animKey}
            question={questions[step]}
            index={step}
            total={questions.length}
            value={answers[questions[step].id] ?? ''}
            onChange={(v) => setAnswers((a) => ({ ...a, [questions[step].id]: v }))}
            onNext={goNext}
            onBack={goBack}
            canGoBack={step > 0}
            isLast={step === questions.length - 1}
            isSubmitting={submitMutation.isPending}
            accentColor={accentColor}
            animKey={animKey}
          />
        )}

        {isDone && (
          <ThankYouScreen key={animKey} settings={form.settings} accentColor={accentColor} />
        )}
      </div>

      {/* Scroll hint on welcome */}
      {step === -1 && <ScrollHint color={accentColor} />}

      {/* Branding */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
        <span className="text-white/20 text-xs">powered by Vertex</span>
      </div>
    </div>
  );
}
