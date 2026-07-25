import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Target, AlertTriangle, CheckCircle2, XCircle, Lightbulb,
  DollarSign, MousePointerClick, Eye, Users, Clock,
  Zap, BarChart2, TrendingDown, Activity, FileImage,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account   { id: string; act_id: string; name: string; is_active: boolean; }
interface FunnelStage { name: string; value: number; drop_pct: number | null; }
interface FunnelSnapshot { id: string; account_id: string; funnel_type: string; calculated_at: string; stages: FunnelStage[]; }
interface WeeklyReport { id: string; account_id: string; week_start: string; diagnosis: string | null; good_points: unknown; bad_points: unknown; recommendations: unknown; score: number | null; created_at: string; }
interface AlertItem { id: string; account_id: string; type: string; severity: string; message: string; created_at: string; resolved_at: string | null; }
interface Campaign  { id: string; account_id: string; name: string; objective: string | null; status: string | null; funnel_type: string | null; daily_budget: number | null; }
interface Adset     { id: string; campaign_id: string; name: string; status: string | null; daily_budget: number | null; }
interface Ad        { id: string; adset_id: string; name: string; status: string | null; thumbnail_url: string | null; title: string | null; body: string | null; }

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

function toStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(x => typeof x === 'string') as string[];
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

// ─── Funnel Chart ─────────────────────────────────────────────────────────────

const STAGE_H  = 54;
const GAP_H    = 26;
const SVG_W    = 300;
const MIN_W    = 72;
const COLORS   = ['#0DB878', '#059669', '#047857', '#065f46', '#064e3b'];

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
            <g key={i}>
              <polygon
                points={`${tx},${y} ${tx + tw},${y} ${bx + bw},${y + STAGE_H} ${bx},${y + STAGE_H}`}
                fill={col}
              />
              <text x={SVG_W / 2} y={y + STAGE_H / 2 - 9}
                textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="system-ui">
                {s.name}
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
                  {s.drop_pct !== null && (
                    <text x={SVG_W / 2 + 7} y={y + STAGE_H + GAP_H / 2 + 4}
                      fill="#94a3b8" fontSize="9" fontFamily="system-ui">
                      ↓ {s.drop_pct.toFixed(1)}% de queda
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

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r    = 34;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(score / 100, 1);
  const col  = score >= 70 ? '#0DB878' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor"
          strokeWidth="7" className="text-muted/30" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={col}
          strokeWidth="7" strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 44 44)" />
        <text x="44" y="49" textAnchor="middle" fill={col}
          fontSize="19" fontWeight="700" fontFamily="system-ui">
          {score}
        </text>
      </svg>
      <p className="text-[10px] text-muted-foreground">Score IA</p>
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
};

const ALERT_ICONS: Record<string, React.ElementType> = {
  creative_fatigue:    FileImage,
  audience_saturation: Users,
  funnel_bottleneck:   TrendingDown,
};

const SEVERITY_CLS: Record<string, string> = {
  high:   'border-l-destructive bg-destructive/5',
  medium: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
  low:    'border-l-border',
};

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50',
  low:    'bg-muted text-muted-foreground border-border',
};

const SEVERITY_LBL: Record<string, string> = { high: 'Alto', medium: 'Médio', low: 'Baixo' };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MetaDiagnostic() {
  const [selectedId, setSelectedId] = useState<string>('');

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['meta-diag-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, act_id, name, is_active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  useEffect(() => {
    if (!selectedId && accounts.length > 0) setSelectedId(accounts[0].id);
  }, [accounts, selectedId]);

  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ['meta-diag-totals', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('insights')
        .select('spend, impressions, clicks')
        .eq('account_id', selectedId);
      const rows = data ?? [];
      const spend       = rows.reduce((a, r) => a + Number(r.spend       ?? 0), 0);
      const impressions = rows.reduce((a, r) => a + Number(r.impressions ?? 0), 0);
      const clicks      = rows.reduce((a, r) => a + Number(r.clicks      ?? 0), 0);
      return {
        spend, impressions, clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100        : 0,
        cpm: impressions > 0 ? (spend  / impressions) * 1000       : 0,
        cpc: clicks      > 0 ?  spend  / clicks                    : 0,
      };
    },
  });

  const { data: funnel } = useQuery({
    queryKey: ['meta-diag-funnel', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('funnel_snapshots')
        .select('*')
        .eq('account_id', selectedId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as FunnelSnapshot | null;
    },
  });

  const { data: report } = useQuery({
    queryKey: ['meta-diag-report', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('account_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as WeeklyReport | null;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['meta-diag-alerts', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts_log')
        .select('*')
        .eq('account_id', selectedId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      return (data ?? []) as AlertItem[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['meta-diag-campaigns', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, account_id, name, objective, status, funnel_type, daily_budget')
        .eq('account_id', selectedId)
        .order('name');
      return (data ?? []) as Campaign[];
    },
  });

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: adsets = [] } = useQuery({
    queryKey: ['meta-diag-adsets', campaignIds],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('adsets')
        .select('id, campaign_id, name, status, daily_budget')
        .in('campaign_id', campaignIds)
        .order('name');
      return (data ?? []) as Adset[];
    },
  });

  const adsetIds = useMemo(() => adsets.map(a => a.id), [adsets]);

  const { data: ads = [] } = useQuery({
    queryKey: ['meta-diag-ads', adsetIds],
    enabled: adsetIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads')
        .select('id, adset_id, name, status, thumbnail_url, title, body')
        .in('adset_id', adsetIds)
        .order('name');
      return (data ?? []) as Ad[];
    },
  });

  const funnelStages   = Array.isArray(funnel?.stages) ? funnel.stages : [];
  const goodPoints     = toStringArray(report?.good_points);
  const badPoints      = toStringArray(report?.bad_points);
  const recommendations = toStringArray(report?.recommendations);

  const campaignById = useMemo(
    () => Object.fromEntries(campaigns.map(c => [c.id, c])),
    [campaigns],
  );

  const criticalAlerts = alerts.filter(a => a.severity === 'high');

  return (
    <div className="space-y-6 pb-8 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Meta Diagnóstico</h1>
          {criticalAlerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-destructive/10 text-destructive border-destructive/20 font-medium">
              <AlertTriangle className="h-3 w-3" />
              {criticalAlerts.length} crítico{criticalAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm pl-12">
          Diagnóstico automático de performance, funil e criativos por conta
        </p>
      </div>

      {/* ── Account selector ───────────────────────────────────────────────── */}
      {loadingAccounts ? (
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta configurada ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedId(acc.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                selectedId === acc.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-foreground hover:border-primary/50 hover:text-primary'
              }`}
            >
              {acc.name}
              {!acc.is_active && <span className="ml-1.5 text-xs opacity-40">(inativo)</span>}
            </button>
          ))}
        </div>
      )}

      {!selectedId ? (
        <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
          Selecione uma conta acima para ver o diagnóstico
        </div>
      ) : (
        <>
          {/* ── KPI Cards ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Investimento"   value={totals ? fmtBRL(totals.spend)        : '—'} icon={DollarSign}      iconCls="bg-primary/10 text-primary"           isLoading={loadingTotals} />
            <KpiCard label="Impressões"     value={totals ? fmtInt(totals.impressions)  : '—'} icon={Eye}             iconCls="bg-blue-500/10 text-blue-500"         isLoading={loadingTotals} />
            <KpiCard label="Cliques"        value={totals ? fmtInt(totals.clicks)       : '—'} icon={MousePointerClick} iconCls="bg-violet-500/10 text-violet-500"  isLoading={loadingTotals} />
            <KpiCard label="CTR"            value={totals ? fmtPct(totals.ctr)          : '—'} icon={Activity}        iconCls="bg-orange-500/10 text-orange-500"     isLoading={loadingTotals} />
            <KpiCard label="CPM"            value={totals ? fmtBRL(totals.cpm)          : '—'} icon={BarChart2}       iconCls="bg-amber-500/10 text-amber-500"       isLoading={loadingTotals} />
            <KpiCard label="CPC"            value={totals ? fmtBRL(totals.cpc)          : '—'} icon={MousePointerClick} iconCls="bg-indigo-500/10 text-indigo-500"  isLoading={loadingTotals} />
          </div>

          {/* ── Funil + Diagnóstico ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Funil */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Funil de Conversão
                  {funnel?.funnel_type && (
                    <Badge variant="outline" className="text-[10px] capitalize">{funnel.funnel_type}</Badge>
                  )}
                </CardTitle>
                {funnel?.calculated_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(funnel.calculated_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-2">
                <FunnelChart stages={funnelStages} />
              </CardContent>
            </Card>

            {/* Diagnóstico IA */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Diagnóstico IA
                    </CardTitle>
                    {report?.week_start && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Semana de {new Date(report.week_start).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  {report?.score !== null && report?.score !== undefined && (
                    <ScoreRing score={report.score} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {!report ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum diagnóstico gerado para esta conta ainda.
                  </p>
                ) : (
                  <>
                    {/* Pontos positivos */}
                    {goodPoints.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pontos Positivos
                        </p>
                        <ul className="space-y-2">
                          {goodPoints.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Pontos de atenção */}
                    {badPoints.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-destructive uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5" />
                          Pontos de Atenção
                        </p>
                        <ul className="space-y-2">
                          {badPoints.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Texto livre se não há estrutura */}
                    {goodPoints.length === 0 && badPoints.length === 0 && report.diagnosis && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.diagnosis}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── O que Fazer ───────────────────────────────────────────────────── */}
          {recommendations.length > 0 && (
            <Card className="border-primary/25 bg-primary/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <Lightbulb className="h-4 w-4" />
                  O que Fazer para Melhorar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed pt-0.5">{r}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* ── Alertas Ativos ────────────────────────────────────────────────── */}
          {alerts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas Ativos
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                  {alerts.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {alerts.map(alert => {
                  const Icon = ALERT_ICONS[alert.type] ?? AlertTriangle;
                  return (
                    <Card
                      key={alert.id}
                      className={`border-l-4 ${SEVERITY_CLS[alert.severity] ?? ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 border ${SEVERITY_BADGE[alert.severity] ?? 'bg-muted'}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <p className="text-xs font-semibold">
                                {ALERT_LABELS[alert.type] ?? alert.type}
                              </p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SEVERITY_BADGE[alert.severity] ?? 'bg-muted'}`}>
                                {SEVERITY_LBL[alert.severity] ?? alert.severity}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                              {new Date(alert.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Campanhas / Conjuntos / Criativos ────────────────────────────── */}
          <Tabs defaultValue="campaigns">
            <TabsList className="h-9">
              <TabsTrigger value="campaigns" className="text-sm">
                Campanhas
                {campaigns.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    {campaigns.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="adsets" className="text-sm">
                Conjuntos
                {adsets.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    {adsets.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="ads" className="text-sm">
                Criativos
                {ads.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                    {ads.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Campanhas */}
            <TabsContent value="campaigns" className="mt-4">
              {campaigns.length === 0
                ? <EmptyState icon={BarChart2} message="Nenhuma campanha encontrada para esta conta." />
                : (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[540px]">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Campanha</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Objetivo</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Funil</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground">Orçamento/dia</th>
                          <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {campaigns.map(c => (
                          <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3 text-muted-foreground text-xs">{c.objective ?? '—'}</td>
                            <td className="p-3">
                              {c.funnel_type && (
                                <Badge variant="outline" className="text-[10px] capitalize">{c.funnel_type}</Badge>
                              )}
                            </td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">
                              {c.daily_budget != null ? fmtBRL(c.daily_budget) : '—'}
                            </td>
                            <td className="p-3 text-center">
                              <StatusBadge status={c.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </TabsContent>

            {/* Conjuntos */}
            <TabsContent value="adsets" className="mt-4">
              {adsets.length === 0
                ? <EmptyState icon={Users} message="Nenhum conjunto de anúncio encontrado." />
                : (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Conjunto</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Campanha</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground">Orçamento/dia</th>
                          <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {adsets.map(a => (
                          <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-medium">{a.name}</td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {campaignById[a.campaign_id]?.name ?? '—'}
                            </td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">
                              {a.daily_budget != null ? fmtBRL(a.daily_budget) : '—'}
                            </td>
                            <td className="p-3 text-center">
                              <StatusBadge status={a.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </TabsContent>

            {/* Criativos */}
            <TabsContent value="ads" className="mt-4">
              {ads.length === 0
                ? <EmptyState icon={FileImage} message="Nenhum criativo encontrado." />
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ads.map(ad => (
                      <Card key={ad.id} className="overflow-hidden">
                        {ad.thumbnail_url ? (
                          <img
                            src={ad.thumbnail_url}
                            alt={ad.name}
                            className="w-full h-44 object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-44 bg-muted flex items-center justify-center">
                            <FileImage className="h-8 w-8 text-muted-foreground/25" />
                          </div>
                        )}
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{ad.name}</p>
                            <StatusBadge status={ad.status} />
                          </div>
                          {ad.title && (
                            <p className="text-xs font-medium text-foreground/70 line-clamp-1">{ad.title}</p>
                          )}
                          {ad.body && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ad.body}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              }
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
