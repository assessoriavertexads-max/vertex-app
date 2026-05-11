import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdsTable } from '@/components/ads/AdsTable';
import { useGoogleAds } from '@/hooks/useGoogleAds';
import { useMetaAds } from '@/hooks/useMetaAds';
import { DATE_PERIODS } from '@/types/ads';
import type { GoogleDateRange, MetaDatePreset, NormalizedCampaign, NormalizedAccountTotals } from '@/types/ads';
import {
  BarChart2, DollarSign, MousePointerClick, Eye, TrendingUp,
  AlertCircle, Settings2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const GOOGLE_ID_KEY = 'vertex_google_ads_customer_id';
const META_ACCOUNT_KEY = 'vertex_meta_ad_account_id';

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

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toFixed(1)}k`
    : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
    ? `${(v / 1000).toFixed(1)}k`
    : v.toLocaleString('pt-BR');
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtRoas = (v: number) => (v > 0 ? `${v.toFixed(2)}×` : '—');

// ── Account selector ─────────────────────────────────────────────────────────
function useCompaniesWithMeta() {
  return useQuery({
    queryKey: ['companies-with-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, meta_ad_account')
        .not('meta_ad_account', 'is', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; meta_ad_account: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Combined KPI totals ───────────────────────────────────────────────────────
function combineTotals(list: NormalizedAccountTotals[]): NormalizedAccountTotals {
  const sum = list.reduce(
    (acc, t) => ({
      impressions: acc.impressions + t.impressions,
      clicks: acc.clicks + t.clicks,
      spend: acc.spend + t.spend,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      conversions: acc.conversions + t.conversions,
      roas: 0,
      platform: 'google' as const,
    }),
    { impressions: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0, cpm: 0, conversions: 0, roas: 0, platform: 'google' as const },
  );

  sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
  sum.cpc = sum.clicks > 0 ? sum.spend / sum.clicks : 0;
  sum.cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : 0;

  const totalConvValue = list.reduce((acc, t) => acc + (t.conversions > 0 ? t.roas * t.spend : 0), 0);
  sum.roas = sum.spend > 0 ? totalConvValue / sum.spend : 0;

  return sum;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdsManager() {
  const [periodIndex, setPeriodIndex] = useState(4); // Últimos 30 dias
  const period = DATE_PERIODS[periodIndex];

  const [googleCustomerId, setGoogleCustomerId] = useState<string>(
    () => localStorage.getItem(GOOGLE_ID_KEY) ?? '',
  );
  const [googleInput, setGoogleInput] = useState(googleCustomerId);
  const [metaAccountId, setMetaAccountId] = useState<string>(
    () => localStorage.getItem(META_ACCOUNT_KEY) ?? '',
  );
  const [showConfig, setShowConfig] = useState(false);

  const { data: metaCompanies = [], isLoading: loadingCompanies } = useCompaniesWithMeta();

  // When companies load and no Meta account is saved, pre-select the first one
  useEffect(() => {
    if (!metaAccountId && metaCompanies.length > 0) {
      const first = metaCompanies[0].meta_ad_account;
      setMetaAccountId(first);
      localStorage.setItem(META_ACCOUNT_KEY, first);
    }
  }, [metaCompanies, metaAccountId]);

  const handleGoogleSave = () => {
    const trimmed = googleInput.trim();
    setGoogleCustomerId(trimmed);
    localStorage.setItem(GOOGLE_ID_KEY, trimmed);
  };

  const handleMetaChange = (accountId: string) => {
    setMetaAccountId(accountId);
    localStorage.setItem(META_ACCOUNT_KEY, accountId);
  };

  const {
    data: googleData,
    isLoading: gLoading,
    isError: gError,
    error: gErr,
    refetch: gRefetch,
    isFetching: gFetching,
  } = useGoogleAds(googleCustomerId || null, period.google);

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
    const m = metaData?.campaigns ?? [];
    return [...g, ...m].sort((a, b) => b.insights.spend - a.insights.spend);
  }, [googleData, metaData]);

  const availableTotals = useMemo(() => {
    const list: NormalizedAccountTotals[] = [];
    if (googleData?.totals) list.push(googleData.totals);
    if (metaData?.totals) list.push(metaData.totals);
    return list;
  }, [googleData, metaData]);

  const combinedTotals = useMemo(
    () => (availableTotals.length > 0 ? combineTotals(availableTotals) : null),
    [availableTotals],
  );

  const noAccountsConfigured = !googleCustomerId && !metaAccountId;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">
      {/* Header */}
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
            onValueChange={(v) => setPeriodIndex(Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PERIODS.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            title="Configurar contas"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
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

      {/* Account Configuration Panel */}
      {(showConfig || noAccountsConfigured) && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Contas de Anúncio
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Google Ads — Customer ID</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 123-456-7890"
                  value={googleInput}
                  onChange={(e) => setGoogleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGoogleSave()}
                  className="text-sm h-9"
                />
                <Button size="sm" onClick={handleGoogleSave} variant="secondary">
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Google Ads → Configurações → ID da conta
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Meta — Conta de Anúncio</Label>
              {loadingCompanies ? (
                <Skeleton className="h-9 w-full" />
              ) : metaCompanies.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-2">
                  Nenhuma empresa com Meta Ad Account configurada.{' '}
                  Adicione em Empresas → Perfil.
                </p>
              ) : (
                <Select value={metaAccountId} onValueChange={handleMetaChange}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {metaCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.meta_ad_account}>
                        {c.name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({c.meta_ad_account})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error alerts */}
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

      {/* KPI Cards */}
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

      {/* Tabs */}
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
          <TabsTrigger value="google" className="text-sm gap-1.5">
            Google Ads
            {(googleData?.campaigns.length ?? 0) > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {googleData!.campaigns.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="meta" className="text-sm gap-1.5">
            Meta Ads
            {(metaData?.campaigns.length ?? 0) > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {metaData!.campaigns.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unified">
          <AdsTable
            campaigns={unifiedCampaigns}
            isLoading={isLoadingAny}
          />
        </TabsContent>

        <TabsContent value="google">
          {!googleCustomerId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Settings2 className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                Configure o Google Ads Customer ID no painel acima.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
                Configurar
              </Button>
            </div>
          ) : (
            <AdsTable
              campaigns={googleData?.campaigns ?? []}
              isLoading={gLoading}
              hidePlatformColumn
            />
          )}
        </TabsContent>

        <TabsContent value="meta">
          {!metaAccountId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Settings2 className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                Nenhuma conta Meta configurada.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
                Configurar
              </Button>
            </div>
          ) : (
            <AdsTable
              campaigns={metaData?.campaigns ?? []}
              isLoading={mLoading}
              hidePlatformColumn
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
