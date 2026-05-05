import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface Insight {
  id: string;
  type: "oportunidade" | "alerta" | "sugestão";
  title: string;
  description: string;
  impact: "alto" | "medio" | "baixo";
  icon: typeof TrendingUp;
  color: string;
}

const impactColors = { alto: "destructive" as const, medio: "default" as const, baixo: "secondary" as const };
const impactLabels = { alto: "Alta prioridade", medio: "Média prioridade", baixo: "Baixa prioridade" };

const insightRoutes: Record<string, string> = {
  "overdue-payments": "/finance",
  "stale-leads": "/crm",
  "high-value-negotiation": "/crm",
  "overdue-tasks": "/tasks",
  "upcoming-income": "/finance",
  "leads-no-company": "/crm",
  "stale-negotiation": "/crm",
  "concentration-risk": "/crm",
  "low-conversion": "/crm",
  "mom-revenue-drop": "/finance",
};

export default function AIInsights() {
  const navigate = useNavigate();
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["insights-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*, companies(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["insights-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["insights-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, companies(name)")
        .neq("status", "concluido");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["insights-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, status");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingTx || loadingLeads || loadingTasks || loadingCompanies;

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Transações vencidas
    const overdueTransactions = transactions.filter(
      (t: { status: string; type: string; due_date: string }) =>
        t.status === "overdue" || (t.status === "pending" && t.type === "income" && t.due_date < todayStr)
    );
    if (overdueTransactions.length > 0) {
      const total = overdueTransactions.reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);
      result.push({
        id: "overdue-payments",
        type: "alerta",
        title: `${overdueTransactions.length} pagamento${overdueTransactions.length > 1 ? "s" : ""} em atraso`,
        description: `Total de R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em recebíveis vencidos. Acesse o Financeiro para gerar cobranças e regularizar.`,
        impact: "alto",
        icon: AlertTriangle,
        color: "text-destructive",
      });
    }

    // Leads parados em prospect por mais de 7 dias
    const staleLeads = leads.filter((l: { funnel_stage: string; created_at: string }) => {
      if (l.funnel_stage !== "prospect") return false;
      const createdAt = new Date(l.created_at);
      const diffDays = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 7;
    });
    if (staleLeads.length > 0) {
      result.push({
        id: "stale-leads",
        type: "sugestão",
        title: `${staleLeads.length} lead${staleLeads.length > 1 ? "s" : ""} parado${staleLeads.length > 1 ? "s" : ""} em Prospecção`,
        description: `${staleLeads.length > 1 ? `${staleLeads.length} leads estão` : "1 lead está"} em Prospecção há mais de 7 dias sem avançar. Considere fazer follow-up ou mover para Negociação.`,
        impact: "medio",
        icon: Lightbulb,
        color: "text-primary",
      });
    }

    // Leads em negociação com valor alto
    const highValueLeads = leads.filter(
      (l: { funnel_stage: string; estimated_value: number | null }) =>
        l.funnel_stage === "negotiation" && Number(l.estimated_value) > 5000
    );
    if (highValueLeads.length > 0) {
      const total = highValueLeads.reduce((acc: number, l: { estimated_value: number | null }) => acc + Number(l.estimated_value ?? 0), 0);
      result.push({
        id: "high-value-negotiation",
        type: "oportunidade",
        title: `${highValueLeads.length} negociação${highValueLeads.length > 1 ? "ões" : ""} de alto valor em andamento`,
        description: `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em leads na fase de Negociação. Priorize o fechamento para maximizar a receita do mês.`,
        impact: "alto",
        icon: TrendingUp,
        color: "text-success",
      });
    }

    // Tarefas com prazo vencido
    const overdueTasks = tasks.filter(
      (t: { due_date: string | null; status: string }) => t.due_date && t.due_date < todayStr && t.status !== "concluido"
    );
    if (overdueTasks.length > 0) {
      result.push({
        id: "overdue-tasks",
        type: "alerta",
        title: `${overdueTasks.length} tarefa${overdueTasks.length > 1 ? "s" : ""} com prazo vencido`,
        description: `Existem tarefas pendentes cujo prazo já passou. Acesse A Fazeres ou Processos & Docs para atualizá-las.`,
        impact: "medio",
        icon: AlertTriangle,
        color: "text-warning",
      });
    }

    // Receita a receber nos próximos 7 dias
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const next7Str = next7Days.toISOString().split("T")[0];
    const upcomingIncome = transactions.filter(
      (t: { status: string; type: string; due_date: string }) =>
        t.type === "income" && t.status === "pending" && t.due_date >= todayStr && t.due_date <= next7Str
    );
    if (upcomingIncome.length > 0) {
      const total = upcomingIncome.reduce((acc: number, t: { amount: number }) => acc + Number(t.amount), 0);
      result.push({
        id: "upcoming-income",
        type: "oportunidade",
        title: `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a receber nos próximos 7 dias`,
        description: `${upcomingIncome.length} cobrança${upcomingIncome.length > 1 ? "s" : ""} vence${upcomingIncome.length === 1 ? "" : "m"} em breve. Acompanhe no Financeiro e acione quem estiver pendente.`,
        impact: "baixo",
        icon: TrendingUp,
        color: "text-success",
      });
    }

    // Leads sem empresa vinculada
    const leadsWithoutCompany = leads.filter((l: { company_id: string | null }) => !l.company_id);
    if (leadsWithoutCompany.length > 0) {
      result.push({
        id: "leads-no-company",
        type: "sugestão",
        title: `${leadsWithoutCompany.length} lead${leadsWithoutCompany.length > 1 ? "s" : ""} sem empresa vinculada`,
        description: `Vincule leads às empresas para melhorar o rastreamento de contratos, tarefas e histórico financeiro.`,
        impact: "baixo",
        icon: Lightbulb,
        color: "text-primary",
      });
    }

    // ── Insights de Agência ───────────────────────────────────────────────

    // Leads parados em negociação por mais de 30 dias
    const staleNegotiations = leads.filter((l: { funnel_stage: string; created_at: string }) => {
      if (l.funnel_stage !== "negotiation") return false;
      const diffDays = Math.floor((today.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 30;
    });
    if (staleNegotiations.length > 0) {
      const total = staleNegotiations.reduce((acc: number, l: { estimated_value: number | null }) => acc + Number(l.estimated_value ?? 0), 0);
      result.push({
        id: "stale-negotiation",
        type: "alerta",
        title: `${staleNegotiations.length} negociação${staleNegotiations.length > 1 ? "ões" : ""} parada${staleNegotiations.length > 1 ? "s" : ""} há 30+ dias`,
        description: `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em risco. Leads em Negociação sem avançar por mais de 30 dias tendem a esfriar. Faça follow-up urgente ou qualifique a saída.`,
        impact: "alto",
        icon: AlertTriangle,
        color: "text-destructive",
      });
    }

    // Concentração de receita — um cliente domina >40% do pipeline
    type LeadWithCompany = { company_id: string | null; estimated_value: number | null; companies?: { name: string } | null };
    const pipelineTotal = leads.reduce((acc: number, l: LeadWithCompany) => acc + Number(l.estimated_value ?? 0), 0);
    if (pipelineTotal > 0) {
      const byCompany: Record<string, { name: string; value: number }> = {};
      (leads as LeadWithCompany[]).forEach(l => {
        if (!l.company_id) return;
        const name = (l.companies as { name: string } | null)?.name ?? l.company_id;
        if (!byCompany[l.company_id]) byCompany[l.company_id] = { name, value: 0 };
        byCompany[l.company_id].value += Number(l.estimated_value ?? 0);
      });
      const topEntry = Object.values(byCompany).sort((a, b) => b.value - a.value)[0];
      if (topEntry && (topEntry.value / pipelineTotal) > 0.4) {
        const pct = Math.round((topEntry.value / pipelineTotal) * 100);
        result.push({
          id: "concentration-risk",
          type: "alerta",
          title: `Concentração: ${topEntry.name} representa ${pct}% do pipeline`,
          description: `Alto risco de dependência de um único cliente. Se esse lead não fechar, o impacto na receita será significativo. Diversifique a prospecção.`,
          impact: "medio",
          icon: AlertTriangle,
          color: "text-warning",
        });
      }
    }

    // Taxa de conversão baixa (<15%)
    const totalLeads = leads.length;
    const closedLeads = leads.filter((l: { funnel_stage: string }) => l.funnel_stage === "closed").length;
    const conversionRate = totalLeads > 5 ? Math.round((closedLeads / totalLeads) * 100) : null;
    if (conversionRate !== null && conversionRate < 15) {
      result.push({
        id: "low-conversion",
        type: "sugestão",
        title: `Taxa de conversão baixa: ${conversionRate}%`,
        description: `Apenas ${closedLeads} de ${totalLeads} leads foram fechados. Benchmark saudável para agências: 20–30%. Revise o processo de qualificação e follow-up.`,
        impact: "medio",
        icon: Lightbulb,
        color: "text-primary",
      });
    }

    // Queda de receita mês a mês (>20%)
    const nowDate = new Date();
    const thisMonthKey = nowDate.toISOString().substring(0, 7);
    const lastMonthKey = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).toISOString().substring(0, 7);
    type TxRecord = { type: string; status: string; due_date?: string; created_at?: string; amount: number };
    const paidIncome = (transactions as TxRecord[]).filter(t => t.type === "income" && t.status === "paid");
    const thisMonthRev = paidIncome.filter(t => (t.due_date ?? t.created_at ?? "").substring(0, 7) === thisMonthKey).reduce((a, t) => a + Number(t.amount), 0);
    const lastMonthRev = paidIncome.filter(t => (t.due_date ?? t.created_at ?? "").substring(0, 7) === lastMonthKey).reduce((a, t) => a + Number(t.amount), 0);
    if (lastMonthRev > 0 && thisMonthRev < lastMonthRev * 0.8) {
      const drop = Math.round(((lastMonthRev - thisMonthRev) / lastMonthRev) * 100);
      result.push({
        id: "mom-revenue-drop",
        type: "alerta",
        title: `Receita deste mês caiu ${drop}% vs mês anterior`,
        description: `Mês passado: R$ ${lastMonthRev.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · Este mês: R$ ${thisMonthRev.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Identifique quais clientes não pagaram ou cancelaram.`,
        impact: "alto",
        icon: TrendingUp,
        color: "text-destructive",
      });
    }

    if (result.length === 0) {
      result.push({
        id: "all-good",
        type: "oportunidade",
        title: "Tudo em dia!",
        description: "Não há alertas ou ações urgentes no momento. Continue monitorando o painel para se manter à frente.",
        impact: "baixo",
        icon: TrendingUp,
        color: "text-success",
      });
    }

    return result;
  }, [transactions, leads, tasks, companies]);

  const countByType = useMemo(() => ({
    oportunidades: insights.filter((i) => i.type === "oportunidade").length,
    alertas: insights.filter((i) => i.type === "alerta").length,
    sugestoes: insights.filter((i) => i.type === "sugestão").length,
  }), [insights]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights IA</h1>
          <p className="text-muted-foreground text-sm">Análise automática baseada nos seus dados reais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-primary">{insights.length}</p>
          <p className="text-sm text-muted-foreground">Insights ativos</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-success">{countByType.oportunidades}</p>
          <p className="text-sm text-muted-foreground">Oportunidades</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-warning">{countByType.alertas}</p>
          <p className="text-sm text-muted-foreground">Alertas</p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <div
              key={insight.id}
              className={`stat-card !p-5 group ${insightRoutes[insight.id] ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}`}
              onClick={() => insightRoutes[insight.id] && navigate(insightRoutes[insight.id])}
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className={`h-5 w-5 ${insight.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                    <Badge variant={impactColors[insight.impact]} className="text-xs">
                      {impactLabels[insight.impact]}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{insight.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-2" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
