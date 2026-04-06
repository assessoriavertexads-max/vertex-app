import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const insights = [
  {
    id: 1,
    type: "oportunidade",
    title: "Lead quente identificado",
    description: "Ana Costa da Global SA demonstrou alto engajamento nos últimos 7 dias. Recomendamos agendar uma reunião de fechamento esta semana.",
    impact: "alto",
    icon: TrendingUp,
    color: "text-success",
  },
  {
    id: 2,
    type: "alerta",
    title: "Pagamento em atraso",
    description: "O pagamento de R$ 8.500 da Design Co está pendente há 5 dias. Sugerimos enviar um lembrete automático via Asaas.",
    impact: "medio",
    icon: AlertTriangle,
    color: "text-warning",
  },
  {
    id: 3,
    type: "sugestão",
    title: "Otimizar funil de vendas",
    description: "A taxa de conversão caiu 2.1% este mês. Análise sugere que leads estão travando na etapa de proposta. Considere revisar o template.",
    impact: "alto",
    icon: Lightbulb,
    color: "text-primary",
  },
  {
    id: 4,
    type: "oportunidade",
    title: "Upsell para Tech Corp",
    description: "Tech Corp está utilizando 95% da capacidade contratada. Momento ideal para oferecer upgrade de plano.",
    impact: "alto",
    icon: TrendingUp,
    color: "text-success",
  },
  {
    id: 5,
    type: "sugestão",
    title: "Automatizar follow-up",
    description: "42 leads novos não receberam contato nas últimas 48h. Configure uma sequência automática de e-mails.",
    impact: "medio",
    icon: Lightbulb,
    color: "text-primary",
  },
];

const impactColors = { alto: "destructive" as const, medio: "default" as const, baixo: "secondary" as const };

export default function AIInsights() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights IA</h1>
          <p className="text-muted-foreground text-sm">Recomendações inteligentes para o seu negócio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-primary">5</p>
          <p className="text-sm text-muted-foreground">Insights ativos</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-success">2</p>
          <p className="text-sm text-muted-foreground">Oportunidades</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-warning">1</p>
          <p className="text-sm text-muted-foreground">Alertas</p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <div key={insight.id} className="stat-card !p-5 group cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${insight.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                    <Badge variant={impactColors[insight.impact as keyof typeof impactColors]} className="text-xs capitalize">
                      {insight.impact}
                    </Badge>
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
