import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'task' | 'transaction' | 'milestone' | 'meeting';
  color: string;
  badge: string;
  path: string;
  meta?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const EVENT_STYLES: Record<CalendarEvent['type'], { dot: string; chip: string }> = {
  task:        { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  transaction: { dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200'   },
  milestone:   { dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200'          },
  meeting:     { dot: 'bg-violet-500',  chip: 'bg-violet-50 text-violet-700 border-violet-200'    },
};

const TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  task: 'Tarefa', transaction: 'Cobrança', milestone: 'Marco', meeting: 'Reunião',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function CalendarView() {
  const navigate = useNavigate();
  const today = localToday();
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { year, month } = cursor;

  const prevMonth = () => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  const nextMonth = () => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  const goToday = () => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); };

  // ── Data queries ────────────────────────────────────────────────────────

  const rangeStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const rangeEnd   = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const { data: tasks = [] } = useQuery({
    queryKey: ['cal-tasks', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, name, status, due_date')
        .gte('due_date', rangeStart)
        .lte('due_date', rangeEnd)
        .neq('status', 'concluido');
      return data ?? [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['cal-transactions', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_transactions')
        .select('id, category, amount, due_date, status')
        .gte('due_date', rangeStart)
        .lte('due_date', rangeEnd)
        .neq('status', 'paid');
      return data ?? [];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['cal-milestones', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_milestones')
        .select('id, name, due_date, status, projects(name)')
        .gte('due_date', rangeStart)
        .lte('due_date', rangeEnd)
        .neq('status', 'done');
      return data ?? [];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['cal-meetings', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_interactions')
        .select('id, description, created_at, companies(name)')
        .eq('type', 'meeting')
        .gte('created_at', `${rangeStart}T00:00:00`)
        .lte('created_at', `${rangeEnd}T23:59:59`);
      return data ?? [];
    },
  });

  // Agendamentos criados via formulários (tabela meetings)
  const { data: formMeetings = [] } = useQuery({
    queryKey: ['cal-form-meetings', rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, scheduled_at, duration_minutes, status')
        .gte('scheduled_at', `${rangeStart}T00:00:00`)
        .lte('scheduled_at', `${rangeEnd}T23:59:59`)
        .neq('status', 'cancelled');
      return data ?? [];
    },
  });

  // ── Build event map ─────────────────────────────────────────────────────

  const eventsByDay = useMemo<Record<string, CalendarEvent[]>>(() => {
    const map: Record<string, CalendarEvent[]> = {};

    const add = (date: string, evt: CalendarEvent) => {
      if (!map[date]) map[date] = [];
      map[date].push(evt);
    };

    for (const t of tasks as Array<{ id: string; name: string; status: string; due_date: string }>) {
      if (!t.due_date) continue;
      add(t.due_date, {
        id: t.id, title: t.name, date: t.due_date,
        type: 'task', color: 'emerald', badge: 'Tarefa', path: '/tasks',
      });
    }

    for (const tx of transactions as Array<{ id: string; category: string; amount: number; due_date: string; status: string }>) {
      if (!tx.due_date) continue;
      add(tx.due_date, {
        id: tx.id,
        title: tx.category ?? 'Cobrança',
        date: tx.due_date,
        type: 'transaction',
        color: 'orange',
        badge: 'Cobrança',
        path: '/finance',
        meta: `R$ ${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      });
    }

    for (const m of milestones as Array<{ id: string; name: string; due_date: string; projects: { name: string } | null }>) {
      if (!m.due_date) continue;
      add(m.due_date, {
        id: m.id,
        title: m.name,
        date: m.due_date,
        type: 'milestone',
        color: 'blue',
        badge: 'Marco',
        path: '/projects',
        meta: (m.projects as { name?: string } | null)?.name,
      });
    }

    for (const mt of meetings as Array<{ id: string; description: string; created_at: string; companies: { name: string } | null }>) {
      const date = mt.created_at.slice(0, 10);
      add(date, {
        id: mt.id,
        title: mt.description.slice(0, 60),
        date,
        type: 'meeting',
        color: 'violet',
        badge: 'Reunião',
        path: '/companies',
        meta: (mt.companies as { name?: string } | null)?.name,
      });
    }

    for (const fm of formMeetings as Array<{ id: string; title: string; scheduled_at: string; duration_minutes: number }>) {
      if (!fm.scheduled_at) continue;
      const date = fm.scheduled_at.slice(0, 10);
      const time = fm.scheduled_at.slice(11, 16); // HH:MM
      add(date, {
        id: fm.id,
        title: fm.title ?? 'Reunião agendada',
        date,
        type: 'meeting',
        color: 'violet',
        badge: 'Reunião',
        path: '/calendar',
        meta: time ? `${time} · ${fm.duration_minutes ?? 30}min` : undefined,
      });
    }

    return map;
  }, [tasks, transactions, milestones, meetings, formMeetings]);

  // ── Calendar grid ───────────────────────────────────────────────────────

  const totalDays = daysInMonth(year, month);
  const startPad  = firstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad end to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground text-sm mt-1">Tarefas, cobranças e marcos num só lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {(Object.entries(EVENT_STYLES) as [CalendarEvent['type'], { dot: string; chip: string }][]).map(([type, s]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar grid */}
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`pad-${idx}`} className="h-24 bg-muted/20 p-1" />;
              }
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const events = eventsByDay[dateStr] ?? [];
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDay;
              const MAX_VISIBLE = 3;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`h-24 p-1.5 cursor-pointer transition-colors flex flex-col gap-0.5 ${
                    isSelected ? 'bg-primary/5 border border-primary/20' :
                    isToday    ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  }`}>
                    {day}
                  </div>
                  {events.slice(0, MAX_VISIBLE).map(evt => (
                    <div
                      key={evt.id}
                      onClick={e => { e.stopPropagation(); navigate(evt.path); }}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate cursor-pointer ${EVENT_STYLES[evt.type].chip}`}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {events.length > MAX_VISIBLE && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{events.length - MAX_VISIBLE} mais
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="lg:w-72 shrink-0">
          {selectedDay ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 sticky top-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum evento neste dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(evt => (
                    <button
                      key={evt.id}
                      onClick={() => navigate(evt.path)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors hover:opacity-80 ${EVENT_STYLES[evt.type].chip}`}
                    >
                      <div className="font-medium truncate">{evt.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 opacity-70">
                        <span>{TYPE_LABELS[evt.type]}</span>
                        {evt.meta && <span>· {evt.meta}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center sticky top-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Clique em um dia para ver os eventos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
