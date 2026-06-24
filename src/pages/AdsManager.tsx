import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdsTable } from '@/components/ads/AdsTable';
import { CampaignTracker } from '@/components/ads/CampaignTracker';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { useMetaAds } from '@/hooks/useMetaAds';
import { DATE_PERIODS } from '@/types/ads';
import type { NormalizedCampaign, NormalizedAccountTotals } from '@/types/ads';
import {
  BarChart2, DollarSign, MousePointerClick, Eye, TrendingUp,
  AlertCircle, RefreshCw, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const COMPANY_KEY = 'vertex_ads_company_id';

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  isLoading?: boolean;
  tooltip?: string;
}
function KpiCard({ label, value, icon: Icon, iconColor, isLoading, tooltip }: KpiCardProps) {
  const content = (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
      </CardContent>
    </Card>
  );
  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toFixed(1)}k`
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtInt = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
    ? `${(v / 1000).toFixed(1)}k`
    : v.toLocaleString('pt-BR');
const fmtPct  = (v: number) => `${v.toFixed(2)}%`;
const fmtRoas = (v: number) => (v > 0 ? `${v.toFixed(2)}×` : '—');

// ── Companies query ───────────────────────────────────────────────────────────
interface AdsCompany {
  id: string;
  name: string;
  phone: string | null;
  meta_ad_account_id: string | null;
  google_ad_account_id: string | null;
}

function useAdsCompanies() {
  return useQuery<AdsCompany[]>({
    queryKey: ['companies-with-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, phone, meta_ad_account_id, google_ad_account_id')
        .or('meta_ad_account_id.not.is.null,google_ad_account_id.not.is.null')
        .order('name');
      if (error) throw error;
      return (data ?? []) as AdsCompany[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Combined KPI totals ───────────────────────────────────────────────────────
function combineTotals(list: NormalizedAccountTotals[]): NormalizedAccountTotals {
  const sum = list.reduce(
    (acc, t) => ({
      impressions:  acc.impressions  + t.impressions,
      clicks:       acc.clicks       + t.clicks,
      spend:        acc.spend        + t.spend,
      ctr: 0, cpc: 0, cpm: 0,
      conversions:  acc.conversions  + t.conversions,
      roas: 0,
      platform: 'google' as const,
    }),
    { impressions: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0, cpm: 0, conversions: 0, roas: 0, platform: 'google' as const },
  );

  sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
  sum.cpc = sum.clicks      > 0 ? sum.spend / sum.clicks : 0;
  sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : 0;

  const totalConvValue = list.reduce((acc, t) => acc + (t.conversions > 0 ? t.roas * t.spend : 0), 0);
  sum.roas = sum.spend > 0 ? totalConvValue / sum.spend : 0;

  return sum;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdsManager() {
  const [periodIndex, setPeriodIndex] = useState(4);
  const period = DATE_PERIODS[periodIndex];

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    () => localStorage.getItem(COMPANY_KEY) ?? '',
  );

  const { data: companies = [], isLoading: loadingCompanies } = useAdsCompanies();

  // Auto-seleciona a primeira empresa ao carregar
  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      const first = companies[0].id;
      setSelectedCompanyId(first);
      localStorage.setItem(COMPANY_KEY, first);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) ?? null;
  const metaAccountId   = selectedCompany?.meta_ad_account_id  ?? '';
  const googleAccountId = selectedCompany?.google_ad_account_id ?? '';

  function handleSelectCompany(id: string) {
    setSelectedCompanyId(id);
    localStorage.setItem(COMPANY_KEY, id);
  }

  const {
    data: googleData,
    isLoading: gLoading,
    isError: gError,
    error: gErr,
    refetch: gRefetch,
    isFetching: gFetching,
  } = useGoogleAds(googleAccountId || null, period.google);

  const {
    data: metaData,
    isLoading: mLoading,
    isError: mError,
    error: mErr,
    refetch: mRefetch,
    isFetching: mFetching,
  } = useMetaAds(metaAccountId || null, period.meta);

  const isLoadingAny = gLoading || mLoading;

  const unifiedCampaigns = useMemo<NormalizedCampaign[]>(() => {
    const g = googleData?.campaigns ?? [];
    const m = metaData?.campaigns   ?? [];
    return [...g, ...m].sort((a, b) => b.insights.spend - a.insights.spend);
  }, [googleData, metaData]);

  const combinedTotals = useMemo(() => {
    const list: NormalizedAccountTotals[] = [];
    if (googleData?.totals) list.push(googleData.totals);
    if (metaData?.totals)   list.push(metaData.totals);
    return list.length > 0 ? combineTotals(list) : null;
  }, [googleData, metaData]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart2 className="w-7 h-7 text-primary" />
              Ads Manager
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Visão unificada de Google Ads e Meta Ads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(periodIndex)}
              onValueChange={v => setPeriodIndex(Number(v))}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PERIODS.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              title="Recarregar dados"
              disabled={gFetching || mFetching}
              onClick={() => { gRefetch(); mRefetch(); }}
            >
              <RefreshCw className={`h-4 w-4 ${(gFetching || mFetching) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* ── Seletor de cliente (sempre visível) ──────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Cliente
          </p>
          {loadingCompanies ? (
            <div className="flex gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
            </div>
          ) : companies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              Nenhuma empresa com conta de anúncio.{' '}
              Configure em <strong>Empresas → Perfil</strong> os campos
              "Meta Ad Account" ou "Google Ad Account".
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {companies.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCompany(c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedCompanyId === c.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background border-border text-foreground hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {c.name}
                  {selectedCompanyId === c.id && (
                    <span className="ml-1.5 text-xs opacity-70">
                      {[c.meta_ad_account_id && 'Meta', c.google_ad_account_id && 'Google'].filter(Boolean).join(' + ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Errors ───────────────────────────────────────────────────────── */}
      {gError && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Erro — Google Ads</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">
            {(gErr as Error)?.message ?? 'Erro ao carregar dados do Google Ads.'}
          </AlertDescription>
        </Alert>
      )}
      {mError && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Erro — Meta Ads</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">
            {(mErr as Error)?.message ?? 'Erro ao carregar dados do Meta Ads.'}
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Investimento Total"
          value={combinedTotals ? fmtBRL(combinedTotals.spend) : '—'}
          icon={DollarSign}
          iconColor="bg-primary/10 text-primary"
          isLoading={isLoadingAny}
          tooltip="Soma de gasto Google Ads + Meta Ads no período"
        />
        <KpiCard
          label="Impressões"
          value={combinedTotals ? fmtInt(combinedTotals.impressions) : '—'}
          icon={Eye}
          iconColor="bg-blue-500/10 text-blue-500"
          isLoading={isLoadingAny}
        />
        <KpiCard
          label="Cliques"
          value={combinedTotals ? fmtInt(combinedTotals.clicks) : '—'}
          icon={MousePointerClick}
          iconColor="bg-purple-500/10 text-purple-500"
          isLoading={isLoadingAny}
        />
        <KpiCard
          label="CTR Médio"
          value={combinedTotals ? fmtPct(combinedTotals.ctr) : '—'}
          icon={BarChart2}
          iconColor="bg-orange-500/10 text-orange-500"
          isLoading={isLoadingAny}
          tooltip="CTR ponderado: total cliques / total impressões"
        />
        <KpiCard
          label="ROAS Combinado"
          value={combinedTotals ? fmtRoas(combinedTotals.roas) : '—'}
          icon={TrendingUp}
          iconColor="bg-green-500/10 text-green-500"
          isLoading={isLoadingAny}
          tooltip="Retorno médio ponderado pelo investimento de cada plataforma"
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="unified" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="unified" className="text-sm gap-1.5">
            Unificado
            {unifiedCampaigns.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {unifiedCampaigns.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="text-sm">
            Google Ads
          </TabsTrigger>
          <TabsTrigger value="meta" className="text-sm">
            Meta Ads
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-sm gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            Rastreamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unified">
          <AdsTable campaigns={unifiedCampaigns} isLoading={isLoadingAny} />
        </TabsContent>

        <TabsContent value="google">
          {!googleAccountId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <BarChart2 className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                {selectedCompany
                  ? `${selectedCompany.name} não tem Google Ad Account configurado.`
                  : 'Selecione um cliente acima.'}
              </p>
            </div>
          ) : (
            <AdsTable campaigns={googleData?.campaigns ?? []} isLoading={gLoading} hidePlatformColumn />
          )}
        </TabsContent>

        <TabsContent value="meta">
          {!metaAccountId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <BarChart2 className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                {selectedCompany
                  ? `${selectedCompany.name} não tem Meta Ad Account configurado.`
                  : 'Selecione um cliente acima.'}
              </p>
            </div>
          ) : (
            <AdsTable campaigns={metaData?.campaigns ?? []} isLoading={mLoading} hidePlatformColumn />
          )}
        </TabsContent>

        <TabsContent value="tracking">
          <CampaignTracker
            campaigns={unifiedCampaigns}
            companyId={selectedCompanyId || null}
            companyPhone={selectedCompany?.phone ?? null}
            isLoadingCampaigns={isLoadingAny}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
