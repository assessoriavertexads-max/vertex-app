import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  MetaAdsProxyResponse,
  NormalizedCampaign,
  NormalizedAccountTotals,
  MetaDatePreset,
} from '@/types/ads';

export interface MetaAdsResult {
  campaigns: NormalizedCampaign[];
  totals: NormalizedAccountTotals;
}

export function useMetaAds(
  adAccountId: string | null,
  datePreset: MetaDatePreset = 'last_30d',
) {
  return useQuery<MetaAdsResult>({
    queryKey: ['meta-ads', adAccountId, datePreset],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<MetaAdsProxyResponse>(
        'meta-ads-proxy',
        { body: { ad_account_id: adAccountId, date_preset: datePreset } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data) throw new Error('Resposta vazia do meta-ads-proxy');

      const campaigns: NormalizedCampaign[] = data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        platform: 'meta',
        status: c.status,
        insights: {
          impressions: c.insights.impressions,
          clicks: c.insights.clicks,
          spend: c.insights.spend,
          ctr: c.insights.ctr,
          cpc: c.insights.cpc,
          cpm: c.insights.cpm,
          conversions: c.insights.conversions,
          roas: c.insights.roas,
          reach: c.insights.reach,
          frequency: c.insights.frequency,
          leads: c.insights.leads,
        },
      }));

      const t = data.account_totals;
      const totals: NormalizedAccountTotals = {
        platform: 'meta',
        impressions: t.impressions,
        clicks: t.clicks,
        spend: t.spend,
        ctr: t.ctr,
        cpc: t.cpc,
        cpm: t.cpm,
        conversions: t.conversions,
        roas: t.roas,
        reach: t.reach,
        leads: t.leads,
      };

      return { campaigns, totals };
    },
    enabled: !!adAccountId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
