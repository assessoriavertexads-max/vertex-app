import {
  DollarSign, Users, Target, Activity,
  ArrowUpRight, ArrowDownRight, TrendingUp, Briefcase
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

const revenueData = [
  { name: 'Jan', receita: 15000, despesa: 8000 },
  { name: 'Fev', receita: 18000, despesa: 8500 },
  { name: 'Mar', receita: 16500, despesa: 9000 },
  { name: 'Abr', receita: 22000, despesa: 8200 },
  { name: 'Mai', receita: 28000, despesa: 10000 },
  { name: 'Jun', receita: 35000, despesa: 11000 },
];

const funnelData = [
  { name: 'Prospecção', quantidade: 12 },
  { name: 'Negociação', quantidade: 8 },
  { name: 'Jurídico', quantidade: 3 },
  { name: 'Fechado', quantidade: 5 },
];

export default function Dashboard() {
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
            <h3 className="font-medium text-muted-foreground">Receita Mensal</h3>
            <div className="p-2 bg-primary/10 text-primary rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">R$ 35k</h2>
            <span className="flex items-center text-sm font-medium text-green-500">
              <ArrowUpRight className="w-4 h-4" /> 25%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Comparado ao mês passado</p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Clientes Ativos</h3>
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><Briefcase className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">42</h2>
            <span className="flex items-center text-sm font-medium text-green-500">
              <ArrowUpRight className="w-4 h-4" /> 3 novos
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
            <h2 className="text-3xl font-bold text-foreground">R$ 128k</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">23 leads em negociação</p>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-muted-foreground">Tarefas Pendentes</h3>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><Activity className="w-5 h-5" /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-foreground">18</h2>
            <span className="flex items-center text-sm font-medium text-red-500">
              <ArrowDownRight className="w-4 h-4" /> 5 atrasadas
            </span>
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
