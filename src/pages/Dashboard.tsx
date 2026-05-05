import {
  DollarSign, Target, Activity,
  ArrowUpRight, TrendingUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const { data: companies = [], isError: errCompanies } = useQuery({
    queryKey: ['dashboard-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, status');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: leads = [], isError: errLeads } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, estimated_value, funnel_stage');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: tasks = [], isError: errTasks } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('id, status, due_date');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: transactions = [], isError: errTransactions } = useQuery({
    queryKey: ['dashboard-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, type, amount, status, created_at, due_date');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const hasError = errCompanies || errLeads || errTasks || errTransactions;

  // Memoized calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    const activeCompanies = companies.filter((c: { status: string }) => c.status === 'ativo' || c.status === 'active').length;
    const pipelineTotal = leads.reduce((acc: number, l: { estimated_value: number | null }) => acc + Number(l.estimated_value ?? 0), 0);
    const activeLeads = leads.filter((l: { funnel_stage: string }) => l.funnel_stage !== 'closed').length;
    const closedLeads = leads.filter((l: { funnel_stage: string }) => l.funnel_stage === 'closed').length;
    const closeRate = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;
    const pendingTasks = tasks.filter((t: { status: string }) => t.status !== 'concluido').length;
    const today = now.toISOString().split('T')[0];
    const overdueTasks = tasks.filter((t: { status: string; due_date: string | null }) => t.status !== 'concluido' && t.due_date && t.due_date < today).length;

    const paidIncome = transactions.filter((t: { type: string; status: string }) => t.type === 'income' && t.status === 'paid');
    const paidExpense = transactions.filter((t: { type: string; status: string }) => t.type === 'expense' && t.status === 'paid');

    const monthlyRevenue = paidIncome.reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);
    const monthlyExpense = paidExpense.reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);
    const grossProfit = monthlyRevenue - monthlyExpense;

    const thisMonthRevenue = paidIncome
      .filter((t: { due_date?: string; created_at?: string }) => (t.due_date ?? t.created_at ?? '').substring(0, 7) === thisMonth)
      .reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);

    const lastMonthRevenue = paidIncome
      .filter((t: { due_date?: string; created_at?: string }) => (t.due_date ?? t.created_at ?? '').substring(0, 7) === lastMonth)
      .reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);

    const momGrowth = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

    return {
      activeCompanies,
      pipelineTotal,
      activeLeads,
      closedLeads,
      closeRate,
      pendingTasks,
      overdueTasks,
      monthlyRevenue,
      grossProfit,
      momGrowth,
    };
  }, [companies, leads, tasks, transactions]);

  const { activeCompanies, pipelineTotal, activeLeads, closeRate, pendingTasks, overdueTasks, monthlyRevenue, grossProfit, momGrowth } = metrics;

  // Memoized funnel data
  const funnelData = useMemo(() => [
    { name: 'Prospecção', quantidade: leads.filter((l: { funnel_stage: string }) => l.funnel_stage === 'prospect').length },
    { name: 'Negociação', quantidade: leads.filter((l: { funnel_stage: string }) => l.funnel_stage === 'negotiation').length },
    { name: 'Jurídico', quantidade: leads.filter((l: { funnel_stage: string }) => l.funnel_stage === 'legal').length },
    { name: 'Fechado', quantidade: leads.filter((l: { funnel_stage: string }) => l.funnel_stage === 'closed').length },
  ], [leads]);

  // Calculate revenue data from transactions
  const revenueData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const today = new Date();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM

      const monthTransactions = transactions.filter((t: { status: string; created_at?: string }) => {
        const tDate = t.created_at?.substring(0, 7);
        return tDate === monthKey;
      });

      const receita = monthTransactions
        .filter((t: { type: string; status: string }) => t.type === 'income' && t.status === 'paid')
        .reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);

      const despesa = monthTransactions
        .filter((t: { type: string; status: string }) => t.type === 'expense' && t.status === 'paid')
        .reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);

      data.push({
        name: months[date.getMonth()],
        receita,
        despesa,
      });
    }
    return data;
  }, [transactions]);

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo ao Vertex Workspace. Aqui está o resumo da sua operação hoje.</p>
      </div>

      {hasError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Alguns dados não puderam ser carregados. Verifique sua conexão ou recarregue a página.
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Receita Total</h3>
            <div className="p-2 bg-primary/10 text-primary rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">
              R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>
          </div>
          <p className="text-xs mt-1 flex items-center gap-1">
            {momGrowth !== null ? (
              <span className={momGrowth >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {momGrowth >= 0 ? '▲' : '▼'} {Math.abs(momGrowth)}% vs mês anterior
              </span>
            ) : (
              <span className="text-muted-foreground">Entradas pagas acumuladas</span>
            )}
          </p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Lucro Bruto</h3>
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              R$ {Math.abs(grossProfit).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {grossProfit >= 0 ? 'Receita − despesas pagas' : 'Despesas excedem receita'}
          </p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Pipeline (CRM)</h3>
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg"><Target className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">
              R$ {pipelineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeLeads} abertos · taxa de fechamento {closeRate}%
          </p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Clientes / Tarefas</h3>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><Activity className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">{activeCompanies}</h2>
            <span className="flex items-center text-sm font-medium text-green-500">
              <ArrowUpRight className="w-4 h-4" /> {companies.length} total
            </span>
          </div>
          <p className="text-xs mt-1">
            <span className="text-muted-foreground">{pendingTasks} tarefas</span>
            {overdueTasks > 0 && <span className="text-red-500 font-medium ml-1">· {overdueTasks} atrasadas</span>}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Fluxo de Caixa (6 Meses)
            </h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `R$${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'hsl(var(--card))' }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, undefined]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="Receita" dataKey="receita" stroke="#059669" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Despesa" dataKey="despesa" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h3 className="font-bold text-lg text-foreground mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-yellow-500" /> Funil Comercial
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'hsl(var(--card))' }}
                />
                <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
