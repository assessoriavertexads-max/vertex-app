import { TrendingUp, Users, DollarSign, ClipboardList, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const stats = [
  { label: "Receita Mensal", value: "R$ 48.750", change: "+12.5%", up: true, icon: DollarSign, color: "text-success" },
  { label: "Leads Ativos", value: "127", change: "+8.2%", up: true, icon: Users, color: "text-primary" },
  { label: "Conversão", value: "23.4%", change: "-2.1%", up: false, icon: TrendingUp, color: "text-warning" },
  { label: "Tarefas Pendentes", value: "34", change: "+5", up: true, icon: ClipboardList, color: "text-info" },
];

const revenueData = [
  { month: "Jan", receita: 32000, despesa: 18000 },
  { month: "Fev", receita: 35000, despesa: 19000 },
  { month: "Mar", receita: 38000, despesa: 20000 },
  { month: "Abr", receita: 42000, despesa: 21000 },
  { month: "Mai", receita: 45000, despesa: 22000 },
  { month: "Jun", receita: 48750, despesa: 23000 },
];

const leadsData = [
  { stage: "Novo", count: 42 },
  { stage: "Contato", count: 35 },
  { stage: "Proposta", count: 28 },
  { stage: "Negociação", count: 15 },
  { stage: "Fechado", count: 7 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <div className="flex items-center mt-1 text-xs">
              {stat.up ? (
                <ArrowUpRight className="h-3 w-3 text-success mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-destructive mr-1" />
              )}
              <span className={stat.up ? "text-success" : "text-destructive"}>{stat.change}</span>
              <span className="text-muted-foreground ml-1">vs mês anterior</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 stat-card">
          <h2 className="font-semibold text-foreground mb-4">Receita vs Despesas</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 47%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 47%)" />
              <Tooltip />
              <Area type="monotone" dataKey="receita" stroke="hsl(217, 91%, 50%)" fill="url(#colorReceita)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesa" stroke="hsl(0, 84%, 60%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h2 className="font-semibold text-foreground mb-4">Funil de Leads</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={leadsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 47%)" />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 47%)" width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(217, 91%, 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
