import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const META_API_VERSION = "v19.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Campos de insights que serão buscados por campanha e por anúncio
const CAMPAIGN_INSIGHT_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpm",
  "cpc",
  "spend",
  "frequency",
  "actions",
  "action_values",
  "purchase_roas",
  "video_avg_time_watched_actions",
  "video_thruplay_watched_actions",
].join(",");

const AD_INSIGHT_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "spend",
  "actions",
  "action_values",
  "purchase_roas",
].join(",");

function buildParams(obj: Record<string, string>) {
  return new URLSearchParams(obj).toString();
}

// Normaliza o ID da conta: garante prefixo "act_"
function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

// Extrai o valor de uma action_type específico
function getActionValue(actions: { action_type: string; value: string }[] | undefined, type: string) {
  return Number(actions?.find((a) => a.action_type === type)?.value ?? 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN não configurado nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ad_account_id, date_preset = "last_30d" } = await req.json();

    if (!ad_account_id) {
      return new Response(
        JSON.stringify({ error: "ad_account_id é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = normalizeAccountId(String(ad_account_id));
    const token = `access_token=${ACCESS_TOKEN}`;

    // ── 1. CAMPANHAS com insights ──────────────────────────────────────────
    const campaignFields = [
      "id",
      "name",
      "status",
      "effective_status",
      "objective",
      "daily_budget",
      "lifetime_budget",
      "start_time",
      "stop_time",
      `insights.date_preset(${date_preset}){${CAMPAIGN_INSIGHT_FIELDS}}`,
    ].join(",");

    const campaignsUrl = `${META_BASE}/${accountId}/campaigns?${buildParams({
      fields: campaignFields,
      limit: "50",
      access_token: ACCESS_TOKEN,
    })}`;

    const campaignsRes = await fetch(campaignsUrl);
    const campaignsData = await campaignsRes.json();

    if (campaignsData.error) {
      throw new Error(`Meta API (campanhas): ${campaignsData.error.message}`);
    }

    // ── 2. ADSETS por campanha ─────────────────────────────────────────────
    const adsetFields = [
      "id",
      "name",
      "status",
      "campaign_id",
      "daily_budget",
      "lifetime_budget",
      "targeting",
      `insights.date_preset(${date_preset}){impressions,reach,clicks,spend,cpc,ctr,actions}`,
    ].join(",");

    const adsetsUrl = `${META_BASE}/${accountId}/adsets?${buildParams({
      fields: adsetFields,
      limit: "100",
      access_token: ACCESS_TOKEN,
    })}`;

    const adsetsRes = await fetch(adsetsUrl);
    const adsetsData = await adsetsRes.json();

    // ── 3. ANÚNCIOS (criativos) ────────────────────────────────────────────
    const adFields = [
      "id",
      "name",
      "status",
      "effective_status",
      "campaign_id",
      "adset_id",
      "creative{id,name,title,body,call_to_action_type,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id}",
      `insights.date_preset(${date_preset}){${AD_INSIGHT_FIELDS}}`,
    ].join(",");

    const adsUrl = `${META_BASE}/${accountId}/ads?${buildParams({
      fields: adFields,
      limit: "100",
      access_token: ACCESS_TOKEN,
    })}`;

    const adsRes = await fetch(adsUrl);
    const adsData = await adsRes.json();

    // ── 4. ACCOUNT INSIGHTS (totais da conta) ─────────────────────────────
    const accountInsightsUrl = `${META_BASE}/${accountId}/insights?${buildParams({
      fields: [
        "impressions",
        "reach",
        "clicks",
        "ctr",
        "cpm",
        "cpc",
        "spend",
        "actions",
        "action_values",
        "purchase_roas",
      ].join(","),
      date_preset,
      access_token: ACCESS_TOKEN,
    })}`;

    const accountInsightsRes = await fetch(accountInsightsUrl);
    const accountInsightsData = await accountInsightsRes.json();

    // ── Normaliza as campanhas ─────────────────────────────────────────────
    const campaigns = (campaignsData.data || []).map((c: Record<string, unknown>) => {
      const insights = (c.insights as { data?: Record<string, unknown>[] } | undefined)?.data?.[0] ?? {};
      const actions = insights.actions as { action_type: string; value: string }[] | undefined;
      const actionValues = insights.action_values as { action_type: string; value: string }[] | undefined;
      const roas = insights.purchase_roas as { action_type: string; value: string }[] | undefined;

      return {
        id: c.id,
        name: c.name,
        status: c.effective_status ?? c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        start_time: c.start_time,
        stop_time: c.stop_time,
        insights: {
          impressions: Number(insights.impressions ?? 0),
          reach: Number(insights.reach ?? 0),
          clicks: Number(insights.clicks ?? 0),
          ctr: Number(insights.ctr ?? 0),
          cpm: Number(insights.cpm ?? 0),
          cpc: Number(insights.cpc ?? 0),
          spend: Number(insights.spend ?? 0),
          frequency: Number(insights.frequency ?? 0),
          conversions: getActionValue(actions, "offsite_conversion.fb_pixel_purchase") +
            getActionValue(actions, "purchase"),
          conversion_value: getActionValue(actionValues, "offsite_conversion.fb_pixel_purchase") +
            getActionValue(actionValues, "purchase"),
          roas: Number(roas?.[0]?.value ?? 0),
          link_clicks: getActionValue(actions, "link_click"),
          leads: getActionValue(actions, "lead"),
          video_views: getActionValue(actions, "video_view"),
        },
      };
    });

    // ── Normaliza os anúncios ──────────────────────────────────────────────
    const ads = (adsData.data || []).map((ad: Record<string, unknown>) => {
      const insights = (ad.insights as { data?: Record<string, unknown>[] } | undefined)?.data?.[0] ?? {};
      const actions = insights.actions as { action_type: string; value: string }[] | undefined;
      const creative = ad.creative as Record<string, unknown> | undefined;

      return {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status ?? ad.status,
        campaign_id: ad.campaign_id,
        adset_id: ad.adset_id,
        creative: {
          id: creative?.id,
          title: creative?.title ?? null,
          body: creative?.body ?? null,
          call_to_action: creative?.call_to_action_type ?? null,
          image_url: creative?.image_url ?? null,
          thumbnail_url: creative?.thumbnail_url ?? null,
          video_id: creative?.video_id ?? null,
        },
        insights: {
          impressions: Number(insights.impressions ?? 0),
          reach: Number(insights.reach ?? 0),
          clicks: Number(insights.clicks ?? 0),
          ctr: Number(insights.ctr ?? 0),
          cpc: Number(insights.cpc ?? 0),
          cpm: Number(insights.cpm ?? 0),
          spend: Number(insights.spend ?? 0),
          conversions: getActionValue(actions, "offsite_conversion.fb_pixel_purchase") +
            getActionValue(actions, "purchase"),
          link_clicks: getActionValue(actions, "link_click"),
          leads: getActionValue(actions, "lead"),
        },
      };
    });

    // ── Normaliza os adsets ────────────────────────────────────────────────
    const adsets = (adsetsData.data || []).map((s: Record<string, unknown>) => {
      const insights = (s.insights as { data?: Record<string, unknown>[] } | undefined)?.data?.[0] ?? {};
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        campaign_id: s.campaign_id,
        daily_budget: s.daily_budget ? Number(s.daily_budget) / 100 : null,
        lifetime_budget: s.lifetime_budget ? Number(s.lifetime_budget) / 100 : null,
        insights: {
          impressions: Number(insights.impressions ?? 0),
          reach: Number(insights.reach ?? 0),
          clicks: Number(insights.clicks ?? 0),
          spend: Number(insights.spend ?? 0),
          cpc: Number(insights.cpc ?? 0),
          ctr: Number(insights.ctr ?? 0),
        },
      };
    });

    // ── Totais da conta ────────────────────────────────────────────────────
    const accountRaw = accountInsightsData.data?.[0] ?? {};
    const accountActions = accountRaw.actions as { action_type: string; value: string }[] | undefined;
    const accountActionValues = accountRaw.action_values as { action_type: string; value: string }[] | undefined;
    const accountRoas = accountRaw.purchase_roas as { action_type: string; value: string }[] | undefined;

    const account_totals = {
      impressions: Number(accountRaw.impressions ?? 0),
      reach: Number(accountRaw.reach ?? 0),
      clicks: Number(accountRaw.clicks ?? 0),
      ctr: Number(accountRaw.ctr ?? 0),
      cpm: Number(accountRaw.cpm ?? 0),
      cpc: Number(accountRaw.cpc ?? 0),
      spend: Number(accountRaw.spend ?? 0),
      conversions: getActionValue(accountActions, "offsite_conversion.fb_pixel_purchase") +
        getActionValue(accountActions, "purchase"),
      conversion_value: getActionValue(accountActionValues, "offsite_conversion.fb_pixel_purchase") +
        getActionValue(accountActionValues, "purchase"),
      roas: Number(accountRoas?.[0]?.value ?? 0),
      leads: getActionValue(accountActions, "lead"),
      link_clicks: getActionValue(accountActions, "link_click"),
    };

    return new Response(
      JSON.stringify({
        date_preset,
        account_totals,
        campaigns,
        adsets,
        ads,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
