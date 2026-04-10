import {
  DollarSign, Target, Activity,
  ArrowUpRight, TrendingUp, Briefcase
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const { data: companies = [] } = useQuery({
    queryKey: ['dashboard-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, status');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, estimated_value, funnel_stage');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('id, status, due_date');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['dashboard-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, type, amount, status, created_at');
      if (error) throw error;
      return data || [];
    },
  });

  // Memoized calculations
  const metrics = useMemo(() => {
    const activeCompanies = companies.filter((c: { status: string }) => c.status === 'ativo' || c.status === 'active').length;
    const pipelineTotal = leads.reduce((acc: number, l: { estimated_value: number | null }) => acc + Number(l.estimated_value ?? 0), 0);
    const activeLeads = leads.filter((l: { funnel_stage: string }) => l.funnel_stage !== 'closed').length;
    const pendingTasks = tasks.filter((t: { status: string }) => t.status !== 'concluido').length;
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter((t: { status: string; due_date: string | null }) => t.status !== 'concluido' && t.due_date && t.due_date < today).length;
    const monthlyRevenue = transactions
      .filter((t: { type: string; status: string }) => t.type === 'income' && t.status === 'paid')
      .reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);

    return {
      activeCompanies,
      pipelineTotal,
      activeLeads,
      pendingTasks,
      overdueTasks,
      monthlyRevenue,
    };
  }, [companies, leads, tasks, transactions]);

  const { activeCompanies, pipelineTotal, activeLeads, pendingTasks, overdueTasks, monthlyRevenue } = metrics;

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

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Receita Recebida</h3>
            <div className="p-2 bg-primary/10 text-primary rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">
              R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total de entradas pagas</p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Clientes Ativos</h3>
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><Briefcase className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">{activeCompanies}</h2>
            <span className="flex items-center text-sm font-medium text-green-500">
              <ArrowUpRight className="w-4 h-4" /> {companies.length} total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Demandas em andamento</p>
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
          <p className="text-xs text-muted-foreground mt-1">{activeLeads} leads em aberto</p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Tarefas Pendentes</h3>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><Activity className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">{pendingTasks}</h2>
            {overdueTasks > 0 && (
              <span className="text-sm font-medium text-red-500">{overdueTasks} atrasadas</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Requerem atenção da equipe</p>
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
