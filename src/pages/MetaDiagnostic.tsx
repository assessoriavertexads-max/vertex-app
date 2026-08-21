import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Target, AlertTriangle, CheckCircle2, XCircle, Lightbulb,
  DollarSign, MousePointerClick, Eye, Users, Clock,
  Zap, BarChart2, TrendingDown, Activity, FileImage,
  CalendarDays, SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  act_id: string;
  client_name: string;
  active: boolean;
}

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  drop_off_pct: number | null;
}

interface FunnelSnapshot {
  id: number;
  account_id: number;
  funnel_type: string;
  period_start: string;
  period_end: string;
  stages: FunnelStage[];
}

interface WeeklyReport {
  id: number;
  account_id: number;
  week_start: string;
  week_end: string;
  summary: string | null;
  raw_metrics: {
    alerts?: Array<{ message: string; severity: string; alert_type: string; object_name: string }>;
    metrics?: Array<{ spend: string; clicks: number; impressions: number; object_name: string; level: string }>;
  } | null;
}

interface AlertItem {
  id: number;
  account_id: number;
  alert_type: string;
  severity: string;
  message: string;
  object_name: string | null;
  triggered_at: string;
}

interface Campaign {
  campaign_id: string;
  account_id: number;
  name: string;
  objective: string | null;
  status: string | null;
  funnel_type: string | null;
  funnel_type_override: string | null;
  daily_budget: number | null;
}

interface CampaignWithMetrics extends Campaign {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
}

interface Adset {
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string | null;
  daily_budget: number | null;
}

interface Ad {
  ad_id: string;
  adset_id: string;
  name: string;
  status: string | null;
  image_url: string | null;
  creative_thumbnail_url: string | null;
  headline: string | null;
  primary_text: string | null;
  cta_type: string | null;
  ig_permalink_url: string | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
}

interface AdWithMetrics extends Ad {
  spend: number;
  impressions: number;
  clicks: number;
  video_25: number;
  video_100: number;
}

interface InsightRow {
  object_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  video_p25: number | null;
  video_p100: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => v >= 1000
  ? `R$ ${(v / 1000).toFixed(1)}k`
  : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtInt = (v: number) => v >= 1_000_000
  ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1000
  ? `${(v / 1000).toFixed(1)}k`
  : v.toLocaleString('pt-BR');

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

const RANKING_CLS: Record<string, string> = {
  ABOVE_AVERAGE:    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  AVERAGE:          'bg-muted text-muted-foreground border-border',
  BELOW_AVERAGE_10: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  BELOW_AVERAGE_20: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  BELOW_AVERAGE_35: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
};

const RANKING_LBL: Record<string, string> = {
  ABOVE_AVERAGE:    'Acima da média',
  AVERAGE:          'Média',
  BELOW_AVERAGE_10: '↓ 10%',
  BELOW_AVERAGE_20: '↓ 20%',
  BELOW_AVERAGE_35: '↓ 35%',
};

function RankingBadge({ label, value }: { label: string; value: string | null }) {
  if (!value || value === 'UNKNOWN') return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${RANKING_CLS[value] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {label}: {RANKING_LBL[value] ?? value}
    </span>
  );
}

// ─── Funnel Chart ─────────────────────────────────────────────────────────────

const STAGE_H = 54;
const GAP_H   = 26;
const SVG_W   = 300;
const MIN_W   = 72;
const COLORS  = ['#0DB878', '#059669', '#047857', '#065f46', '#064e3b', '#052e16', '#021a0e'];

function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  if (!stages.length) return (
    <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
      Sem dados de funil disponíveis
    </div>
  );

  const max    = stages[0].value || 1;
  const totalH = stages.length * STAGE_H + (stages.length - 1) * GAP_H;
  const sw     = (v: number) => MIN_W + (v / max) * (SVG_W - MIN_W);

  return (
    <div className="flex justify-center w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W + 56} ${totalH}`}
        className="max-w-xs overflow-visible"
        aria-label="Funil de conversão"
      >
        {stages.map((s, i) => {
          const y    = i * (STAGE_H + GAP_H);
          const tw   = sw(s.value);
          const bw   = stages[i + 1] ? sw(stages[i + 1].value) : tw * 0.84;
          const tx   = (SVG_W - tw) / 2;
          const bx   = (SVG_W - bw) / 2;
          const col  = COLORS[Math.min(i, COLORS.length - 1)];
          const pct  = ((s.value / max) * 100).toFixed(1);
          const last = i === stages.length - 1;

          return (
            <g key={s.key ?? i}>
              <polygon
                points={`${tx},${y} ${tx + tw},${y} ${bx + bw},${y + STAGE_H} ${bx},${y + STAGE_H}`}
                fill={col}
              />
              <text x={SVG_W / 2} y={y + STAGE_H / 2 - 9}
                textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="system-ui">
                {s.label}
              </text>
              <text x={SVG_W / 2} y={y + STAGE_H / 2 + 9}
                textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="system-ui">
                {fmtInt(s.value)}
              </text>
              <text x={SVG_W + 6} y={y + STAGE_H / 2 + 4}
                fill="#94a3b8" fontSize="10" fontFamily="system-ui">
                {pct}%
              </text>

              {!last && (
                <>
                  <line
                    x1={SVG_W / 2} y1={y + STAGE_H}
                    x2={SVG_W / 2} y2={y + STAGE_H + GAP_H}
                    stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,2"
                  />
                  {s.drop_off_pct !== null && s.drop_off_pct > 0 && (
                    <text x={SVG_W / 2 + 7} y={y + STAGE_H + GAP_H / 2 + 4}
                      fill="#94a3b8" fontSize="9" fontFamily="system-ui">
                      ↓ {s.drop_off_pct.toFixed(1)}% de queda
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, iconCls, isLoading }: {
  label: string; value: string; icon: React.ElementType; iconCls: string; isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className={`p-1.5 rounded-md ${iconCls}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        {isLoading
          ? <Skeleton className="h-7 w-20" />
          : <p className="text-xl font-bold tabular-nums">{value}</p>
        }
      </CardContent>
    </Card>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const l = status.toLowerCase();
  const cls = l === 'active' || l === 'ativo'
    ? 'bg-primary/10 text-primary border-primary/20'
    : l === 'paused' || l === 'pausado'
    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200/50'
    : 'bg-muted text-muted-foreground border-border';
  const lbl = l === 'active' ? 'Ativo' : l === 'paused' ? 'Pausado' : status;
  return (
    <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {lbl}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2">
      <Icon className="h-8 w-8 text-muted-foreground/25" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Alert config ─────────────────────────────────────────────────────────────

const ALERT_LABELS: Record<string, string> = {
  creative_fatigue:    'Fadiga de Criativo',
  audience_saturation: 'Saturação de Público',
  funnel_bottleneck:   'Gargalo no Funil',
  high_cpm:            'CPM Alto',
  low_ctr:             'CTR Baixo',
};

const ALERT_ICONS: Record<string, React.ElementType> = {
  creative_fatigue:    FileImage,
  audience_saturation: Users,
  funnel_bottleneck:   TrendingDown,
  high_cpm:            BarChart2,
  low_ctr:             Activity,
};

const SEVERITY_CLS: Record<string, string> = {
  critical: 'border-l-destructive bg-destructive/5',
  high:     'border-l-destructive bg-destructive/5',
  warning:  'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  medium:   'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  low:      'border-l-border',
  info:     'border-l-border',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high:     'bg-destructive/10 text-destructive border-destructive/20',
  warning:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50',
  medium:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50',
  low:      'bg-muted text-muted-foreground border-border',
  info:     'bg-muted text-muted-foreground border-border',
};

const SEVERITY_LBL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', warning: 'Atenção', medium: 'Médio', low: 'Baixo', info: 'Info',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'all';
type StatusFilter = 'all' | 'active' | 'paused' | 'archived';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d':  'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  'all': 'Todo período',
};

const STATUS_FILTER_OPTS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'Todos'     },
  { value: 'active',   label: 'Ativo'     },
  { value: 'paused',   label: 'Pausado'   },
  { value: 'archived', label: 'Arquivado' },
];

export default function MetaDiagnostic() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['meta-diag-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, act_id, client_name, active')
        .order('client_name');
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  useEffect(() => {
    if (selectedId === null && accounts.length > 0) setSelectedId(accounts[0].id);
  }, [accounts, selectedId]);

  // Limpa seleção de campanha ao trocar de conta
  useEffect(() => {
    setSelectedCampaignId(null);
    setActiveTab('overview');
  }, [selectedId]);

  const cutoffDate = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90));
    return d.toISOString().split('T')[0];
  }, [dateRange]);

  // Insights de campanha — usados para totais E para métricas por campanha
  const { data: campaignInsights = [], isLoading: loadingTotals } = useQuery({
    queryKey: ['meta-diag-campaign-insights', selectedId, dateRange],
    enabled: !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from('insights')
        .select('object_id, impressions, clicks, spend, video_p25, video_p100')
        .eq('account_id', selectedId)
        .eq('level', 'campaign');
      if (cutoffDate) q = q.gte('date', cutoffDate);
      const { data } = await q;
      return (data ?? []) as InsightRow[];
    },
  });

  // Insights de anúncio — usados para métricas por criativo
  const { data: adInsights = [] } = useQuery({
    queryKey: ['meta-diag-ad-insights', selectedId, dateRange],
    enabled: !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from('insights')
        .select('object_id, impressions, clicks, spend, video_p25, video_p100')
        .eq('account_id', selectedId)
        .eq('level', 'ad');
      if (cutoffDate) q = q.gte('date', cutoffDate);
      const { data } = await q;
      return (data ?? []) as InsightRow[];
    },
  });

  // Totais do período: SUM de spend/impressions/clicks, CTR/CPM/CPC recalculados
  const totals = useMemo(() => {
    if (!campaignInsights.length) return null;
    const spend       = campaignInsights.reduce((a, r) => a + Number(r.spend       ?? 0), 0);
    const impressions = campaignInsights.reduce((a, r) => a + Number(r.impressions ?? 0), 0);
    const clicks      = campaignInsights.reduce((a, r) => a + Number(r.clicks      ?? 0), 0);
    const ctr = impressions > 0 ? (clicks * 100) / impressions : 0;
    const cpm = impressions > 0 ? (spend * 1000) / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    return { spend, impressions, clicks, ctr, cpm, cpc };
  }, [campaignInsights]);

  const { data: funnelSnapshots = [] } = useQuery({
    queryKey: ['meta-diag-funnel', selectedId, dateRange],
    enabled: !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from('funnel_snapshots')
        .select('id, account_id, funnel_type, period_start, period_end, stages')
        .eq('account_id', selectedId)
        .order('period_start', { ascending: false });
      if (cutoffDate) q = q.gte('period_start', cutoffDate);
      const { data } = await q;
      return (data ?? []) as FunnelSnapshot[];
    },
  });

  const { data: report } = useQuery({
    queryKey: ['meta-diag-report', selectedId, dateRange],
    enabled: !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from('weekly_reports')
        .select('id, account_id, week_start, week_end, summary, raw_metrics')
        .eq('account_id', selectedId)
        .order('week_start', { ascending: false })
        .limit(1);
      if (cutoffDate) q = q.gte('week_start', cutoffDate);
      const { data } = await q.maybeSingle();
      return data as WeeklyReport | null;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['meta-diag-alerts', selectedId, dateRange],
    enabled: !!selectedId,
    queryFn: async () => {
      let q = supabase
        .from('alerts_log')
        .select('id, account_id, alert_type, severity, message, object_name, triggered_at')
        .eq('account_id', selectedId)
        .order('triggered_at', { ascending: false })
        .limit(50);
      if (cutoffDate) q = q.gte('triggered_at', cutoffDate);
      const { data } = await q;
      return (data ?? []) as AlertItem[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['meta-diag-campaigns', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('campaign_id, account_id, name, objective, status, funnel_type, funnel_type_override, daily_budget')
        .eq('account_id', selectedId);
      return (data ?? []) as Campaign[];
    },
  });

  const campaignMetaIds = useMemo(() => campaigns.map(c => c.campaign_id), [campaigns]);

  const { data: adsets = [] } = useQuery({
    queryKey: ['meta-diag-adsets', campaignMetaIds],
    enabled: campaignMetaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('adsets')
        .select('adset_id, campaign_id, name, status, daily_budget')
        .in('campaign_id', campaignMetaIds)
        .order('name');
      return (data ?? []) as Adset[];
    },
  });

  const adsetMetaIds = useMemo(() => adsets.map(a => a.adset_id), [adsets]);

  // Ads buscados pelos adsets (independe de ter insights no período)
  const { data: ads = [] } = useQuery({
    queryKey: ['meta-diag-ads', adsetMetaIds],
    enabled: adsetMetaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads')
        .select('ad_id, adset_id, name, status, image_url, creative_thumbnail_url, headline, primary_text, cta_type, ig_permalink_url, quality_ranking, engagement_rate_ranking, conversion_rate_ranking')
        .in('adset_id', adsetMetaIds);
      return (data ?? []) as Ad[];
    },
  });

  // Agrupa insights por object_id para merge com estrutura
  const campaignInsightMap = useMemo(() => {
    const map: Record<string, { spend: number; impressions: number; clicks: number }> = {};
    for (const r of campaignInsights) {
      if (!map[r.object_id]) map[r.object_id] = { spend: 0, impressions: 0, clicks: 0 };
      map[r.object_id].spend       += Number(r.spend       ?? 0);
      map[r.object_id].impressions += Number(r.impressions ?? 0);
      map[r.object_id].clicks      += Number(r.clicks      ?? 0);
    }
    return map;
  }, [campaignInsights]);

  const adInsightMap = useMemo(() => {
    const map: Record<string, { spend: number; impressions: number; clicks: number; video_25: number; video_100: number }> = {};
    for (const r of adInsights) {
      if (!map[r.object_id]) map[r.object_id] = { spend: 0, impressions: 0, clicks: 0, video_25: 0, video_100: 0 };
      map[r.object_id].spend       += Number(r.spend       ?? 0);
      map[r.object_id].impressions += Number(r.impressions ?? 0);
      map[r.object_id].clicks      += Number(r.clicks      ?? 0);
      map[r.object_id].video_25    += Number(r.video_p25   ?? 0);
      map[r.object_id].video_100   += Number(r.video_p100  ?? 0);
    }
    return map;
  }, [adInsights]);

  // Campanhas com métricas do período, ordenadas por investimento
  const campaignsWithMetrics = useMemo((): CampaignWithMetrics[] =>
    campaigns.map(c => {
      const m = campaignInsightMap[c.campaign_id] ?? { spend: 0, impressions: 0, clicks: 0 };
      const ctr = m.impressions > 0 ? (m.clicks * 100) / m.impressions : 0;
      const cpm = m.impressions > 0 ? (m.spend * 1000) / m.impressions : 0;
      return { ...c, ...m, ctr, cpm };
    }).sort((a, b) => b.spend - a.spend),
  [campaigns, campaignInsightMap]);

  // Ads com métricas do período, ordenados por investimento
  const adsWithMetrics = useMemo((): AdWithMetrics[] =>
    ads.map(a => {
      const m = adInsightMap[a.ad_id] ?? { spend: 0, impressions: 0, clicks: 0, video_25: 0, video_100: 0 };
      return { ...a, ...m };
    }).sort((a, b) => b.spend - a.spend),
  [ads, adInsightMap]);

  // Funis por tipo (uma conta pode ter ecommerce + whatsapp)
  const funnelByType = useMemo(() => {
    const map: Record<string, FunnelSnapshot> = {};
    for (const s of funnelSnapshots) {
      if (!map[s.funnel_type] || s.period_start > map[s.funnel_type].period_start) {
        map[s.funnel_type] = s;
      }
    }
    return Object.values(map);
  }, [funnelSnapshots]);

  // Recomendações extraídas dos alertas do raw_metrics do relatório
  const reportAlerts = useMemo(
    () => report?.raw_metrics?.alerts ?? [],
    [report],
  );

  // Mapa campaign_id (texto Meta) → campanha, para lookup na tabela de conjuntos
  const campaignByMetaId = useMemo(
    () => Object.fromEntries(campaigns.map(c => [c.campaign_id, c])),
    [campaigns],
  );

  const criticalAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');

  const matchesStatus = (status: string | null) => {
    if (statusFilter === 'all') return true;
    const s = status?.toLowerCase() ?? '';
    if (statusFilter === 'active')   return s === 'active'   || s === 'ativo';
    if (statusFilter === 'paused')   return s === 'paused'   || s === 'pausado';
    if (statusFilter === 'archived') return s === 'archived' || s === 'arquivado' || s === 'deleted';
    return true;
  };

  const filteredCampaigns = useMemo(() =>
    campaignsWithMetrics.filter(c => matchesStatus(c.status)),
    [campaignsWithMetrics, statusFilter]
  );

  const filteredAdsets = useMemo(() =>
    adsets
      .filter(a => matchesStatus(a.status))
      .filter(a => !selectedCampaignId || a.campaign_id === selectedCampaignId),
    [adsets, statusFilter, selectedCampaignId]
  );

  const filteredAdsetIds = useMemo(() => new Set(filteredAdsets.map(a => a.adset_id)), [filteredAdsets]);

  const filteredAds = useMemo(() =>
    adsWithMetrics
      .filter(a => matchesStatus(a.status))
      .filter(a => !selectedCampaignId || filteredAdsetIds.has(a.adset_id)),
    [adsWithMetrics, statusFilter, selectedCampaignId, filteredAdsetIds]
  );

  const selectedCampaignName = selectedCampaignId
    ? (campaignByMetaId[selectedCampaignId]?.name ?? selectedCampaignId)
    : null;

  return (
    <div className="space-y-5 pb-8 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Meta Diagnóstico</h1>
            {criticalAlerts.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-destructive/10 text-destructive border-destructive/20 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {criticalAlerts.length} crítico{criticalAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">Diagnóstico automático de performance, funil e criativos por conta</p>
        </div>
      </div>

      {/* ── Barra de filtros ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Seletor de cliente */}
        {loadingAccounts ? (
          <Skeleton className="h-9 w-52 rounded-md" />
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta configurada ainda.</p>
        ) : (
          <Select
            value={selectedId?.toString() ?? ''}
            onValueChange={v => setSelectedId(Number(v))}
          >
            <SelectTrigger className="w-52 h-9 text-sm">
              <SelectValue placeholder="Selecionar cliente..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.client_name}{!acc.active ? ' (inativa)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro de período */}
        <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-44 h-9 text-sm gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de status (campanhas / conjuntos / criativos) */}
        <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 h-9">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-1 shrink-0" />
          {STATUS_FILTER_OPTS.map(opt => {
            const count = opt.value === 'all' ? campaignsWithMetrics.length
              : opt.value === 'active'   ? campaignsWithMetrics.filter(c => ['active','ativo'].includes(c.status?.toLowerCase() ?? '')).length
              : opt.value === 'paused'   ? campaignsWithMetrics.filter(c => ['paused','pausado'].includes(c.status?.toLowerCase() ?? '')).length
              : campaignsWithMetrics.filter(c => ['archived','deleted','arquivado'].includes(c.status?.toLowerCase() ?? '')).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${
                    statusFilter === opt.value ? 'bg-white/20' : 'bg-muted-foreground/15'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!selectedId ? (
        <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
          Selecione uma conta acima para ver o diagnóstico
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="text-sm">Visão Geral</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-sm">
              Campanhas
              {filteredCampaigns.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{filteredCampaigns.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="adsets" className="text-sm">
              Conjuntos
              {filteredAdsets.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{filteredAdsets.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-sm">
              Criativos
              {filteredAds.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{filteredAds.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Visão Geral ──────────────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-5 space-y-5">

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Investimento"   value={totals ? fmtBRL(totals.spend)        : '—'} icon={DollarSign}        iconCls="bg-primary/10 text-primary"          isLoading={loadingTotals} />
              <KpiCard label="Impressões"     value={totals ? fmtInt(totals.impressions)  : '—'} icon={Eye}               iconCls="bg-blue-500/10 text-blue-500"        isLoading={loadingTotals} />
              <KpiCard label="Cliques"        value={totals ? fmtInt(totals.clicks)       : '—'} icon={MousePointerClick} iconCls="bg-violet-500/10 text-violet-500"    isLoading={loadingTotals} />
              <KpiCard label="CTR"            value={totals ? fmtPct(totals.ctr)          : '—'} icon={Activity}          iconCls="bg-orange-500/10 text-orange-500"    isLoading={loadingTotals} />
              <KpiCard label="CPM"            value={totals ? fmtBRL(totals.cpm)          : '—'} icon={BarChart2}         iconCls="bg-amber-500/10 text-amber-500"      isLoading={loadingTotals} />
              <KpiCard label="CPC"            value={totals ? fmtBRL(totals.cpc)          : '—'} icon={MousePointerClick} iconCls="bg-indigo-500/10 text-indigo-500"    isLoading={loadingTotals} />
            </div>

            {/* Diagnóstico IA + Funil */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* Diagnóstico IA — inclui Pontos de Atenção */}
              <Card className="lg:col-span-3 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Diagnóstico IA
                  </CardTitle>
                  {report?.week_start && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Semana de {new Date(report.week_start + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(report.week_end + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  {!report ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum diagnóstico gerado para esta conta ainda.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                        {report.summary ?? 'Resumo não disponível.'}
                      </p>

                      {reportAlerts.length > 0 && (
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-semibold flex items-center gap-1.5 text-primary mb-3">
                            <Lightbulb className="h-3.5 w-3.5" />
                            Pontos de Atenção da Semana
                          </p>
                          <ol className="space-y-2.5">
                            {reportAlerts.map((a, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <div className="pt-0.5 min-w-0">
                                  {a.object_name && (
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5 truncate">{a.object_name}</p>
                                  )}
                                  <p className="text-xs leading-relaxed text-foreground/80">{a.message}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Funil — um card por funnel_type */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {funnelByType.length === 0 ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      Sem dados de funil no período
                    </CardContent>
                  </Card>
                ) : funnelByType.map(f => (
                  <Card key={f.funnel_type}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-primary" />
                        Funil de Conversão
                        <Badge variant="outline" className="text-[10px] capitalize">{f.funnel_type}</Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(f.period_start + 'T00:00:00').toLocaleDateString('pt-BR')} — {new Date(f.period_end + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <FunnelChart stages={Array.isArray(f.stages) ? f.stages : []} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Alertas Ativos — lista compacta */}
            {alerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Alertas Ativos
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                      {alerts.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {alerts.map(alert => {
                      const Icon = ALERT_ICONS[alert.alert_type] ?? AlertTriangle;
                      const sev  = alert.severity;
                      return (
                        <div key={alert.id} className={`flex items-start gap-3 px-5 py-3 border-l-4 ${SEVERITY_CLS[sev] ?? ''}`}>
                          <div className={`p-1.5 rounded-md shrink-0 border mt-0.5 ${SEVERITY_BADGE[sev] ?? 'bg-muted'}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold">
                                {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                              </p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SEVERITY_BADGE[sev] ?? 'bg-muted'}`}>
                                {SEVERITY_LBL[sev] ?? sev}
                              </span>
                              {alert.object_name && (
                                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{alert.object_name}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{alert.message}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 shrink-0 mt-1">
                            {new Date(alert.triggered_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Campanhas ────────────────────────────────────────────────────── */}
          <TabsContent value="campaigns" className="mt-5">
            {filteredCampaigns.length === 0
              ? <EmptyState icon={BarChart2} message={campaigns.length === 0 ? 'Nenhuma campanha encontrada para esta conta.' : 'Nenhuma campanha corresponde ao filtro selecionado.'} />
              : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Campanha</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Funil</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Investido</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Impressões</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Cliques</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">CTR</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">CPM</th>
                        <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredCampaigns.map(c => {
                        const funil    = c.funnel_type_override ?? c.funnel_type;
                        const selected = selectedCampaignId === c.campaign_id;
                        return (
                          <tr
                            key={c.campaign_id}
                            className={`transition-colors cursor-pointer ${
                              selected
                                ? 'bg-primary/5 border-l-2 border-l-primary'
                                : 'hover:bg-muted/20'
                            }`}
                            onClick={() => setSelectedCampaignId(selected ? null : c.campaign_id)}
                          >
                            <td className="p-3">
                              <p className="font-medium line-clamp-1">{c.name}</p>
                              {c.objective && <p className="text-[11px] text-muted-foreground">{c.objective}</p>}
                            </td>
                            <td className="p-3">
                              {funil && <Badge variant="outline" className="text-[10px] capitalize">{funil}</Badge>}
                            </td>
                            <td className="p-3 text-right tabular-nums font-medium">{c.spend > 0 ? fmtBRL(c.spend) : '—'}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{c.impressions > 0 ? fmtInt(c.impressions) : '—'}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{c.clicks > 0 ? fmtInt(c.clicks) : '—'}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{c.impressions > 0 ? fmtPct(c.ctr) : '—'}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{c.impressions > 0 ? fmtBRL(c.cpm) : '—'}</td>
                            <td className="p-3 text-center"><StatusBadge status={c.status} /></td>
                            <td className="p-3 text-right">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedCampaignId(c.campaign_id);
                                  setActiveTab('adsets');
                                }}
                                className="text-xs text-primary hover:underline whitespace-nowrap"
                              >
                                Conjuntos →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </TabsContent>

          {/* ── Conjuntos ────────────────────────────────────────────────────── */}
          <TabsContent value="adsets" className="mt-5 space-y-3">
            {selectedCampaignName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/5 text-xs w-fit">
                <span className="text-muted-foreground">Campanha:</span>
                <span className="font-medium truncate max-w-[300px]">{selectedCampaignName}</span>
                <button onClick={() => setSelectedCampaignId(null)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {filteredAdsets.length === 0
              ? <EmptyState icon={Users} message={adsets.length === 0 ? 'Nenhum conjunto de anúncio encontrado.' : 'Nenhum conjunto corresponde ao filtro selecionado.'} />
              : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Conjunto</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">Campanha</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">Orçamento/dia</th>
                        <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAdsets.map(a => (
                        <tr key={a.adset_id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium">{a.name}</td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {campaignByMetaId[a.campaign_id]?.name ?? '—'}
                          </td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">
                            {a.daily_budget != null ? fmtBRL(Number(a.daily_budget)) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <StatusBadge status={a.status} />
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedCampaignId(a.campaign_id);
                                setActiveTab('ads');
                              }}
                              className="text-xs text-primary hover:underline whitespace-nowrap"
                            >
                              Criativos →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </TabsContent>

          {/* ── Criativos ────────────────────────────────────────────────────── */}
          <TabsContent value="ads" className="mt-5 space-y-3">
            {selectedCampaignName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/5 text-xs w-fit">
                <span className="text-muted-foreground">Campanha:</span>
                <span className="font-medium truncate max-w-[300px]">{selectedCampaignName}</span>
                <button onClick={() => setSelectedCampaignId(null)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {filteredAds.length === 0
              ? <EmptyState icon={FileImage} message={adsWithMetrics.length === 0 ? 'Nenhum criativo com dados no período.' : 'Nenhum criativo corresponde ao filtro selecionado.'} />
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAds.map(ad => {
                    const primaryThumb = ad.image_url || ad.creative_thumbnail_url;
                    const fallbackThumb = ad.image_url ? ad.creative_thumbnail_url : null;
                    const retention = ad.video_25 > 0 ? (ad.video_100 / ad.video_25) * 100 : null;
                    return (
                      <Card key={ad.ad_id} className="overflow-hidden flex flex-col">
                        {primaryThumb ? (
                          <img
                            src={primaryThumb}
                            alt={ad.name}
                            className="w-full h-44 object-cover"
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              if (fallbackThumb && img.src !== fallbackThumb) {
                                img.src = fallbackThumb;
                              } else {
                                img.style.display = 'none';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-44 bg-muted flex items-center justify-center">
                            <FileImage className="h-8 w-8 text-muted-foreground/25" />
                          </div>
                        )}
                        <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium line-clamp-1 flex-1">{ad.headline || ad.name}</p>
                            <StatusBadge status={ad.status} />
                          </div>
                          {ad.primary_text && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ad.primary_text}</p>
                          )}

                          {/* Rankings de qualidade */}
                          <div className="flex flex-wrap gap-1">
                            <RankingBadge label="Qualidade"   value={ad.quality_ranking} />
                            <RankingBadge label="Engaj."      value={ad.engagement_rate_ranking} />
                            <RankingBadge label="Conversão"   value={ad.conversion_rate_ranking} />
                          </div>

                          {/* Métricas do período */}
                          <div className="mt-auto pt-2 border-t border-border grid grid-cols-3 gap-1 text-center">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Investido</p>
                              <p className="text-xs font-semibold tabular-nums">{ad.spend > 0 ? fmtBRL(ad.spend) : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Cliques</p>
                              <p className="text-xs font-semibold tabular-nums">{ad.clicks > 0 ? fmtInt(ad.clicks) : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">{retention != null ? 'Retenção' : 'Impressões'}</p>
                              <p className="text-xs font-semibold tabular-nums">
                                {retention != null ? `${retention.toFixed(0)}%` : ad.impressions > 0 ? fmtInt(ad.impressions) : '—'}
                              </p>
                            </div>
                          </div>

                          {ad.ig_permalink_url && (
                            <a
                              href={ad.ig_permalink_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline"
                            >
                              Ver no Instagram ↗
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            }
          </TabsContent>
        </Tabs>
      )}

      {/* Ícones sem uso mas importados — mantidos para evitar tree-shake diffs */}
      <span className="hidden"><CheckCircle2 /><XCircle /></span>
    </div>
  );
}
