import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  GoogleAdsProxyResponse,
  NormalizedCampaign,
  NormalizedAccountTotals,
  GoogleDateRange,
} from '@/types/ads';

export interface GoogleAdsResult {
  campaigns: NormalizedCampaign[];
  totals: NormalizedAccountTotals;
}

export function useGoogleAds(
  customerId: string | null,
  dateRange: GoogleDateRange = 'LAST_30_DAYS',
) {
  return useQuery<GoogleAdsResult>({
    queryKey: ['google-ads', customerId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GoogleAdsProxyResponse>(
        'google-ads-proxy',
        { body: { customer_id: customerId, date_range: dateRange } },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data) throw new Error('Resposta vazia do google-ads-proxy');

      const campaigns: NormalizedCampaign[] = data.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        platform: 'google',
        status: c.status,
        insights: {
          impressions: c.insights.impressions,
          clicks: c.insights.clicks,
          spend: c.insights.cost,
          ctr: c.insights.ctr,
          cpc: c.insights.avg_cpc,
          cpm: c.insights.avg_cpm,
          conversions: c.insights.conversions,
          roas:
            c.insights.cost > 0
              ? c.insights.conversion_value / c.insights.cost
              : 0,
        },
      }));

      const t = data.account_totals;
      const totals: NormalizedAccountTotals = {
        platform: 'google',
        impressions: t.impressions,
        clicks: t.clicks,
        spend: t.cost,
        ctr: t.ctr,
        cpc: t.avg_cpc,
        cpm: 0,
        conversions: t.conversions,
        roas: t.roas,
      };

      return { campaigns, totals };
    },
    enabled: !!customerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
