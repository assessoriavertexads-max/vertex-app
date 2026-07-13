import {
  DollarSign, Target, Activity, ArrowUpRight, TrendingUp,
  AlertTriangle, CalendarClock, Eye, EyeOff,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

const PRIVACY_KEY = 'vertex_privacy_mode';

// ── Types ─────────────────────────────────────────────────────────────────────
type Company     = { id: string; status: string };
type Lead        = { id: string; estimated_value: number | null; funnel_stage: string };
type Task        = { id: string; status: string; due_date: string | null };
type Transaction = {
  id: string; type: string; amount: number; status: string;
  created_at?: string; due_date?: string; category?: string;
};

interface DashboardData {
  companies: Company[];
  leads: Lead[];
  tasks: Task[];
  transactions: Transaction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatDueLabel(date: string): string {
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  if (date === today)    return 'Hoje';
  if (date === tomorrow) return 'Amanhã';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const tooltipStyle = {
  borderRadius: '8px', border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  background: 'hsl(var(--card))',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [privacy, setPrivacy] = useState<boolean>(() =>
    localStorage.getItem(PRIVACY_KEY) === 'true'
  );

  const togglePrivacy = () => {
    setPrivacy(p => {
      localStorage.setItem(PRIVACY_KEY, String(!p));
      return !p;
    });
  };

  // Mascara valores sensíveis quando modo privacidade está ativo
  const m = (value: string | number) => privacy ? '••••' : String(value);
  const mR = (value: number, opts?: Intl.NumberFormatOptions) =>
    privacy ? '••••' : value.toLocaleString('pt-BR', opts);

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [companiesRes, leadsRes, tasksRes, transactionsRes] = await Promise.all([
        supabase.from('companies').select('id, status'),
        supabase.from('leads').select('id, estimated_value, funnel_stage'),
        supabase.from('tasks').select('id, status, due_date'),
        supabase.from('financial_transactions')
          .select('id, type, amount, status, created_at, due_date, category'),
      ]);
      if (companiesRes.error)    throw companiesRes.error;
      if (leadsRes.error)        throw leadsRes.error;
      if (tasksRes.error)        throw tasksRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      return {
        companies:    companiesRes.data    ?? [],
        leads:        leadsRes.data        ?? [],
        tasks:        tasksRes.data        ?? [],
        transactions: transactionsRes.data ?? [],
      };
    },
    staleTime: 30_000,
  });

  const companies    = data?.companies    ?? [];
  const leads        = data?.leads        ?? [];
  const tasks        = data?.tasks        ?? [];
  const transactions = data?.transactions ?? [];

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const now          = new Date();
    const thisMonth    = now.toISOString().substring(0, 7);
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);
    const today        = now.toISOString().split('T')[0];
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000).toISOString().split('T')[0];

    const activeCompanies = companies.filter(c => c.status === 'ativo' || c.status === 'active').length;
    const pipelineTotal   = leads.reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);
    const activeLeads     = leads.filter(l => l.funnel_stage !== 'closed').length;
    const closedLeads     = leads.filter(l => l.funnel_stage === 'closed').length;
    const closeRate       = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;

    const pendingTasks    = tasks.filter(t => t.status !== 'concluido').length;
    const overdueTasks    = tasks.filter(t => t.status !== 'concluido' && t.due_date && t.due_date < today).length;
    const tasksDone       = tasks.filter(t => t.status === 'concluido').length;
    const tasksInProgress = tasks.filter(t => t.status === 'em_progresso').length;
    const tasksPending    = tasks.filter(t => t.status === 'a_receber').length;

    const paidIncome  = transactions.filter(t => t.type === 'income'  && t.status === 'paid');
    const paidExpense = transactions.filter(t => t.type === 'expense' && t.status === 'paid');

    // Agrupa pelo due_date (competência) — não pelo created_at (data de importação)
    const thisMonthRevenue = paidIncome
      .filter(t => (t.due_date ?? '').substring(0, 7) === thisMonth)
      .reduce((a, t) => a + Number(t.amount), 0);
    const lastMonthRevenue = paidIncome
      .filter(t => (t.due_date ?? '').substring(0, 7) === lastMonth)
      .reduce((a, t) => a + Number(t.amount), 0);

    const thisMonthExpense = paidExpense
      .filter(t => (t.due_date ?? '').substring(0, 7) === thisMonth)
      .reduce((a, t) => a + Number(t.amount), 0);

    const monthlyRevenue = thisMonthRevenue;
    const monthlyExpense = thisMonthExpense;
    const grossProfit    = monthlyRevenue - monthlyExpense;
    const momGrowth = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

    const upcomingDue = transactions
      .filter(t => t.status !== 'paid' && t.due_date && t.due_date >= today && t.due_date <= sevenDaysOut)
      .sort((a, b) => (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1)
      .slice(0, 5);
    const upcomingTotal = upcomingDue.reduce((a, t) => a + Number(t.amount), 0);

    return {
      activeCompanies, pipelineTotal, activeLeads, closeRate,
      pendingTasks, overdueTasks, monthlyRevenue, grossProfit, momGrowth,
      tasksDone, tasksInProgress, tasksPending,
      upcomingDue, upcomingTotal,
    };
  }, [companies, leads, tasks, transactions]);

  // ── Chart Data ─────────────────────────────────────────────────────────────
  const funnelData = useMemo(() => [
    { name: 'Prospecção', quantidade: leads.filter(l => l.funnel_stage === 'prospect').length },
    { name: 'Negociação', quantidade: leads.filter(l => l.funnel_stage === 'negotiation').length },
    { name: 'Jurídico',   quantidade: leads.filter(l => l.funnel_stage === 'legal').length },
    { name: 'Fechado',    quantidade: leads.filter(l => l.funnel_stage === 'closed').length },
  ], [leads]);

  const revenueData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mk = d.toISOString().substring(0, 7);
      const mt = transactions.filter(t => (t.due_date ?? '').substring(0, 7) === mk);
      return {
        name:    MONTHS[d.getMonth()],
        receita: mt.filter(t => t.type === 'income'  && t.status === 'paid').reduce((a, t) => a + Number(t.amount), 0),
        despesa: mt.filter(t => t.type === 'expense' && t.status === 'paid').reduce((a, t) => a + Number(t.amount), 0),
      };
    });
  }, [transactions]);

  const tasksStatusData = useMemo(() => [
    { name: 'A Fazer',      value: metrics.tasksPending,    fill: '#f59e0b' },
    { name: 'Em Progresso', value: metrics.tasksInProgress, fill: '#3b82f6' },
    { name: 'Concluído',    value: metrics.tasksDone,       fill: '#10b981' },
  ], [metrics]);

  const {
    activeCompanies, pipelineTotal, activeLeads, closeRate,
    pendingTasks, overdueTasks, monthlyRevenue, grossProfit, momGrowth,
    tasksPending, tasksInProgress, tasksDone,
    upcomingDue, upcomingTotal,
  } = metrics;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao Vertos Workspace. Aqui está o resumo da sua operação hoje.
          </p>
        </div>
        <button
          onClick={togglePrivacy}
          title={privacy ? 'Mostrar valores' : 'Ocultar valores'}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-2 bg-card hover:bg-muted/50 shrink-0 mt-1"
        >
          {privacy
            ? <><Eye className="w-4 h-4" /> Mostrar</>
            : <><EyeOff className="w-4 h-4" /> Ocultar</>
          }
        </button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Alguns dados não puderam ser carregados. Verifique sua conexão ou recarregue a página.
        </div>
      )}

      {/* ── Row 1: KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Receita Total */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Receita Total</h3>
            <div className="p-2 bg-primary/10 text-primary rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            R$ {mR(monthlyRevenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h2>
          <p className="text-xs mt-1">
            {!privacy && momGrowth !== null ? (
              <span className={momGrowth >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {momGrowth >= 0 ? '▲' : '▼'} {Math.abs(momGrowth)}% vs mês anterior
              </span>
            ) : (
              <span className="text-muted-foreground">Entradas pagas acumuladas</span>
            )}
          </p>
        </div>

        {/* Lucro Bruto */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Lucro Bruto</h3>
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
          </div>
          <h2 className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            R$ {mR(Math.abs(grossProfit), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {grossProfit >= 0 ? 'Receita − despesas pagas' : 'Despesas excedem receita'}
          </p>
        </div>

        {/* Pipeline */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Pipeline (CRM)</h3>
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg"><Target className="w-5 h-5" /></div>
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            R$ {mR(pipelineTotal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {m(activeLeads)} abertos · taxa {m(closeRate + '%')}
          </p>
        </div>

        {/* Clientes / Tarefas */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Clientes / Tarefas</h3>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Activity className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">{m(activeCompanies)}</h2>
            <span className="flex items-center text-sm font-medium text-green-500">
              <ArrowUpRight className="w-4 h-4" /> {m(companies.length)} total
            </span>
          </div>
          <p className="text-xs mt-1">
            <span className="text-muted-foreground">{m(pendingTasks)} tarefas</span>
            {!privacy && overdueTasks > 0 && (
              <span className="text-red-500 font-medium ml-1">· {overdueTasks} atrasadas</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Row 2: Gráficos principais ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Fluxo de Caixa */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm lg:col-span-2">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" /> Fluxo de Caixa (6 Meses)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={val => `R$${val / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, undefined]} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="Receita" dataKey="receita"
                  stroke="#059669" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Despesa" dataKey="despesa"
                  stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funil Comercial */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-yellow-500" /> Funil Comercial
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical"
                margin={{ top: 0, right: 0, bottom: 0, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false}
                  stroke="hsl(var(--border))" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="quantidade" fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 3: Novos Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Tarefas Atrasadas */}
        <div className={`bg-card p-5 rounded-xl border shadow-sm ${
          overdueTasks > 0 ? 'border-red-200 dark:border-red-900/60' : 'border-border'
        }`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${overdueTasks > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              Tarefas Atrasadas
            </h3>
            {overdueTasks > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {overdueTasks} atrasada{overdueTasks !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-emerald-600 font-medium">Em dia</span>
            )}
          </div>
          <div className="space-y-3">
            {([
              { label: 'A Fazer',      value: tasksPending,    color: 'bg-amber-400' },
              { label: 'Em Progresso', value: tasksInProgress, color: 'bg-emerald-500'  },
              { label: 'Concluído',    value: tasksDone,       color: 'bg-emerald-500' },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${color}`}
                    style={{ width: tasks.length > 0 ? `${(value / tasks.length) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground w-5 text-right tabular-nums">
                  {m(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximos Vencimentos */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-orange-500" />
              Próximos Vencimentos
            </h3>
            {upcomingDue.length > 0 && (
              <span className="text-xs text-muted-foreground">
                R$ {mR(upcomingTotal, { minimumFractionDigits: 0 })} / 7 dias
              </span>
            )}
          </div>
          {upcomingDue.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              Nenhum vencimento nos próximos 7 dias.
            </p>
          ) : (
            <div className="space-y-2.5">
              {upcomingDue.map(t => {
                const label   = formatDueLabel(t.due_date ?? '');
                const isToday = label === 'Hoje';
                const isTomorrow = label === 'Amanhã';
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isToday ? 'bg-red-500' : isTomorrow ? 'bg-orange-400' : 'bg-muted-foreground/30'
                      }`} />
                      <span className="text-sm truncate text-foreground">
                        {t.category ?? 'Cobrança'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium ${
                        isToday ? 'text-red-500' : isTomorrow ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        R$ {mR(Number(t.amount), { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tarefas por Status — BarChart */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-500" />
            Tarefas por Status
          </h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksStatusData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} contentStyle={tooltipStyle}
                  formatter={(value: number) => [value, 'Tarefas']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {tasksStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
