import { useState } from 'react';
import {
  Webhook, Plus, Trash2, X, Loader2, Download,
  Toggle, CheckCircle2, Circle, ExternalLink, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const AVAILABLE_EVENTS = [
  { id: 'new_company_created', label: 'Nova empresa cadastrada' },
  { id: 'task_created',        label: 'Tarefa criada'            },
  { id: 'task_completed',      label: 'Tarefa concluída'         },
  { id: 'transaction_paid',    label: 'Cobrança paga'            },
  { id: 'lead_created',        label: 'Lead criado'              },
  { id: 'lead_closed',         label: 'Lead fechado'             },
];

const COMING_SOON = [
  { name: 'Slack',        logo: '💬', desc: 'Receba notificações no seu canal' },
  { name: 'Google Drive', logo: '📁', desc: 'Salve arquivos automaticamente'   },
  { name: 'Notion',       logo: '📓', desc: 'Sincronize projetos e tarefas'    },
  { name: 'WhatsApp',     logo: '📱', desc: 'Disparo automático de mensagens'  },
];

// ── ICS Export ─────────────────────────────────────────────────────────────

async function exportICS() {
  const [{ data: tasks }, { data: txs }, { data: milestones }] = await Promise.all([
    supabase.from('tasks').select('name, due_date').not('due_date', 'is', null).neq('status', 'concluido'),
    supabase.from('financial_transactions').select('category, due_date').not('due_date', 'is', null).neq('status', 'paid'),
    supabase.from('project_milestones').select('name, due_date').not('due_date', 'is', null).neq('status', 'done'),
  ]);

  const events: { title: string; date: string }[] = [
    ...(tasks  ?? []).map(t => ({ title: `[Tarefa] ${t.name}`,                 date: String(t.due_date) })),
    ...(txs    ?? []).map(t => ({ title: `[Cobrança] ${t.category ?? 'Pagamento'}`, date: String(t.due_date) })),
    ...(milestones ?? []).map(m => ({ title: `[Marco] ${m.name}`,              date: String(m.due_date) })),
  ].filter(e => !!e.date);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vertos//Vertos Workspace//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const e of events) {
    const ds = e.date.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${ds}`,
      `DTEND;VALUE=DATE:${ds}`,
      `SUMMARY:${e.title.replace(/,/g, '\\,')}`,
      `UID:${Math.random().toString(36).slice(2)}@vertos.app`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `vertos-calendario-${new Date().toISOString().slice(0, 10)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${events.length} eventos exportados!`);
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function Integrations() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });

  const { data: webhooks = [], isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WebhookConfig[];
    },
  });

  const createWebhook = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from('webhook_configs').insert({
        name: f.name.trim(), url: f.url.trim(), events: f.events,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook criado!');
      setShowModal(false);
      setForm({ name: '', url: '', events: [] });
    },
    onError: () => toast.error('Erro ao criar webhook.'),
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('webhook_configs').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhook_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removido.');
    },
  });

  const testWebhook = async (wh: WebhookConfig) => {
    try {
      await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test',
          source: 'Vertos',
          timestamp: new Date().toISOString(),
          data: { message: 'Teste de webhook do Vertos Workspace' },
        }),
        mode: 'no-cors',
      });
      toast.success('Payload de teste enviado!');
    } catch {
      toast.error('Erro ao enviar teste. Verifique a URL.');
    }
  };

  const toggleEvent = (eventId: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(eventId)
        ? f.events.filter(e => e !== eventId)
        : [...f.events, eventId],
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportICS(); } finally { setExporting(false); }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte o Vertos com outras ferramentas.
        </p>
      </div>

      {/* ── Webhooks ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" /> Webhooks (Zapier / Make)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envie eventos do Vertos para qualquer URL quando ações acontecem.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Webhook
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            <Webhook className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Nenhum webhook configurado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map(wh => (
              <div key={wh.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full shrink-0 ${wh.active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{wh.name}</span>
                    {!wh.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {wh.events.map(e => (
                      <span key={e} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        {AVAILABLE_EVENTS.find(ev => ev.id === e)?.label ?? e}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => testWebhook(wh)}
                  >
                    Testar
                  </Button>
                  <button
                    onClick={() => toggleWebhook.mutate({ id: wh.id, active: !wh.active })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {wh.active
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <Circle className="h-4 w-4" />
                    }
                  </button>
                  <button
                    onClick={() => deleteWebhook.mutate(wh.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Exportar Calendário ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" /> Exportar Calendário
        </h2>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Exporte tarefas, cobranças e marcos como arquivo <strong>.ics</strong> compatível com Google Calendar, Outlook e Apple Calendar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Baixar .ics
            </Button>
            <div className="text-xs text-muted-foreground self-center">
              <p>Para Google Calendar: Configurações → Importar e exportar → Importar</p>
              <p>Para Outlook: Arquivo → Abrir e Exportar → Importar/Exportar</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Em breve ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Em breve
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMING_SOON.map(i => (
            <div key={i.name} className="bg-card border border-dashed border-border rounded-xl p-4 flex items-center gap-3 opacity-60">
              <span className="text-2xl">{i.logo}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{i.name}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground border border-dashed border-muted rounded px-2 py-0.5">Em breve</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modal: Novo Webhook ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" /> Novo Webhook
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Zapier — Nova tarefa"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label>URL do Webhook *</Label>
                <Input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://hooks.zapier.com/..."
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label>Eventos que disparam</Label>
                <div className="space-y-1.5">
                  {AVAILABLE_EVENTS.map(evt => (
                    <label key={evt.id} className="flex items-center gap-2 cursor-pointer group">
                      <div
                        onClick={() => toggleEvent(evt.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          form.events.includes(evt.id)
                            ? 'bg-primary border-primary'
                            : 'border-border group-hover:border-primary/50'
                        }`}
                      >
                        {form.events.includes(evt.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span
                        className="text-sm text-foreground"
                        onClick={() => toggleEvent(evt.id)}
                      >
                        {evt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={!form.name.trim() || !form.url.trim() || form.events.length === 0 || createWebhook.isPending}
                onClick={() => createWebhook.mutate(form)}
              >
                {createWebhook.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Criar Webhook
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
