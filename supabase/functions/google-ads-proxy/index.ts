import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth não configurado (GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN)");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Erro OAuth Google: ${data.error_description ?? data.error ?? "token inválido"}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Autenticação Supabase
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Não autorizado" }, 401);

  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!developerToken) {
    return json({ error: "Google Ads não configurado no servidor (GOOGLE_ADS_DEVELOPER_TOKEN)" }, 503);
  }

  let rawCustomerId: string;
  let dateRange: string;
  try {
    const body = await req.json();
    rawCustomerId = String(body.customer_id ?? "").replace(/-/g, "");
    dateRange = body.date_range ?? "LAST_30_DAYS";
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  if (!rawCustomerId) return json({ error: "customer_id é obrigatório" }, 400);

  try {
    const accessToken = await getAccessToken();

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };

    // Se houver login-customer-id (conta gerenciadora), adicionar
    const managerCustomerId = Deno.env.get("GOOGLE_ADS_MANAGER_CUSTOMER_ID");
    if (managerCustomerId) headers["login-customer-id"] = managerCustomerId;

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING ${dateRange}
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${rawCustomerId}/googleAds:search`,
      { method: "POST", headers, body: JSON.stringify({ query }) }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg =
        errData?.error?.message ??
        errData?.error?.details?.[0]?.errors?.[0]?.message ??
        `Erro Google Ads API: ${res.status}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    const rows: Record<string, unknown>[] = data.results ?? [];

    // Normaliza campanhas
    const campaigns = rows.map((row) => {
      const c = row.campaign as Record<string, unknown>;
      const m = row.metrics as Record<string, unknown>;
      const costMicros = Number(m.costMicros ?? 0);
      const cost = costMicros / 1_000_000;
      const avgCpc = Number(m.averageCpc ?? 0) / 1_000_000;
      const avgCpm = Number(m.averageCpm ?? 0) / 1_000_000;
      const clicks = Number(m.clicks ?? 0);
      const impressions = Number(m.impressions ?? 0);
      const conversions = Number(m.conversions ?? 0);
      const convValue = Number(m.conversionsValue ?? 0);
      // ctr vem como decimal (0.0123 = 1.23%)
      const ctr = Number(m.ctr ?? 0) * 100;
      return {
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        status: String(c.status ?? "UNKNOWN"),
        channel_type: String((c as Record<string, unknown>).advertisingChannelType ?? ""),
        insights: { impressions, clicks, cost, ctr, avg_cpc: avgCpc, avg_cpm: avgCpm, conversions, conversion_value: convValue },
      };
    });

    // Totais da conta
    const totals = campaigns.reduce(
      (acc, c) => {
        acc.impressions += c.insights.impressions;
        acc.clicks += c.insights.clicks;
        acc.cost += c.insights.cost;
        acc.conversions += c.insights.conversions;
        acc.conversion_value += c.insights.conversion_value;
        return acc;
      },
      { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 }
    );

    const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const avgCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
    const roas = totals.cost > 0 ? totals.conversion_value / totals.cost : 0;

    return json({
      customer_id: rawCustomerId,
      date_range: dateRange,
      account_totals: { ...totals, ctr: totalCtr, avg_cpc: avgCpc, roas },
      campaigns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return json({ error: message }, 500);
  }
});
