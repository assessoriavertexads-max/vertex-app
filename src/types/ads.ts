export type AdPlatform = 'google' | 'meta';

export type GoogleDateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_14_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH';

export type MetaDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'this_month'
  | 'last_month';

export interface AdInsights {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  roas: number;
  reach?: number;
  frequency?: number;
  leads?: number;
}

export interface NormalizedCampaign {
  id: string;
  name: string;
  platform: AdPlatform;
  status: string;
  insights: AdInsights;
}

export interface NormalizedAccountTotals extends AdInsights {
  platform: AdPlatform;
}

export interface GoogleAdsProxyResponse {
  error?: string;
  customer_id: string;
  date_range: string;
  account_totals: {
    impressions: number;
    clicks: number;
    cost: number;
    ctr: number;
    avg_cpc: number;
    conversions: number;
    conversion_value: number;
    roas: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    channel_type: string;
    insights: {
      impressions: number;
      clicks: number;
      cost: number;
      ctr: number;
      avg_cpc: number;
      avg_cpm: number;
      conversions: number;
      conversion_value: number;
    };
  }>;
}

export interface MetaAdsProxyResponse {
  error?: string;
  date_preset: string;
  account_totals: {
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    cpm: number;
    cpc: number;
    spend: number;
    conversions: number;
    conversion_value: number;
    roas: number;
    leads: number;
    link_clicks: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    objective?: string;
    insights: {
      impressions: number;
      reach: number;
      clicks: number;
      ctr: number;
      cpm: number;
      cpc: number;
      spend: number;
      frequency: number;
      conversions: number;
      conversion_value: number;
      roas: number;
      link_clicks: number;
      leads: number;
      video_views: number;
    };
  }>;
}

export interface AdColumnDef {
  id: keyof AdInsights;
  label: string;
  visible: boolean;
  description: string;
  formatter: (val: number) => string;
}

export interface DatePeriodOption {
  label: string;
  google: GoogleDateRange;
  meta: MetaDatePreset;
}

export const DATE_PERIODS: DatePeriodOption[] = [
  { label: 'Hoje',           google: 'TODAY',       meta: 'today'      },
  { label: 'Ontem',          google: 'YESTERDAY',   meta: 'yesterday'  },
  { label: 'Últimos 7 dias', google: 'LAST_7_DAYS', meta: 'last_7d'   },
  { label: 'Últimos 14 dias',google: 'LAST_14_DAYS',meta: 'last_14d'  },
  { label: 'Últimos 30 dias',google: 'LAST_30_DAYS',meta: 'last_30d'  },
  { label: 'Este mês',       google: 'THIS_MONTH',  meta: 'this_month' },
  { label: 'Mês anterior',   google: 'LAST_MONTH',  meta: 'last_month' },
];
