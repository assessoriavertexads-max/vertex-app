import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const summary = [
  { label: "Saldo Atual", value: "R$ 125.430", icon: DollarSign, color: "text-success" },
  { label: "Receitas (mês)", value: "R$ 48.750", icon: TrendingUp, color: "text-primary" },
  { label: "Despesas (mês)", value: "R$ 23.000", icon: CreditCard, color: "text-destructive" },
];

const categories = [
  { name: "Serviços", value: 28000, color: "hsl(217, 91%, 50%)" },
  { name: "Produtos", value: 12000, color: "hsl(142, 71%, 45%)" },
  { name: "Consultorias", value: 8750, color: "hsl(38, 92%, 50%)" },
];

const transactions = [
  { id: 1, desc: "Pagamento - Tech Corp", type: "entrada", value: "R$ 15.000", date: "05/06/2026", status: "Confirmado" },
  { id: 2, desc: "Aluguel Escritório", type: "saida", value: "R$ 4.500", date: "04/06/2026", status: "Pago" },
  { id: 3, desc: "Pagamento - Design Co", type: "entrada", value: "R$ 8.500", date: "03/06/2026", status: "Pendente" },
  { id: 4, desc: "Folha de Pagamento", type: "saida", value: "R$ 12.000", date: "01/06/2026", status: "Pago" },
  { id: 5, desc: "Pagamento - Startup Inc", type: "entrada", value: "R$ 22.000", date: "28/05/2026", status: "Confirmado" },
  { id: 6, desc: "Software e Ferramentas", type: "saida", value: "R$ 2.800", date: "27/05/2026", status: "Pago" },
];

export default function Finance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle de receitas e despesas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summary.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 stat-card">
          <h2 className="font-semibold text-foreground mb-4">Últimas Transações</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-left py-3 text-muted-foreground font-medium">Data</th>
                  <th className="text-right py-3 text-muted-foreground font-medium">Valor</th>
                  <th className="text-right py-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 flex items-center gap-2">
                      {t.type === "entrada" ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-foreground">{t.desc}</span>
                    </td>
                    <td className="py-3 text-muted-foreground">{t.date}</td>
                    <td className={`py-3 text-right font-medium ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                      {t.type === "entrada" ? "+" : "-"}{t.value}
                    </td>
                    <td className="py-3 text-right">
                      <Badge variant={t.status === "Pendente" ? "outline" : "secondary"} className="text-xs">
                        {t.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stat-card">
          <h2 className="font-semibold text-foreground mb-4">Receita por Categoria</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                {categories.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {categories.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                </div>
                <span className="text-foreground font-medium">R$ {c.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
