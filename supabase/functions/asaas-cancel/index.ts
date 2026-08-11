import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

    const { asaas_subscription_id, asaas_payment_id } = await req.json() as {
      asaas_subscription_id?: string | null;
      asaas_payment_id?: string | null;
    };

    const headers = { "Content-Type": "application/json", "access_token": apiKey };
    const results: string[] = [];

    // Cancela assinatura — impede cobranças futuras e notificações ao cliente
    if (asaas_subscription_id) {
      const res = await fetch(`${ASAAS_BASE_URL}/subscriptions/${asaas_subscription_id}/cancel`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        results.push(`subscription ${asaas_subscription_id} cancelled`);
      } else {
        // 404 = já cancelada ou não existe — trata como sucesso silencioso
        if (res.status !== 404) {
          const body = await res.json().catch(() => ({})) as { errors?: { description: string }[]; message?: string };
          const msg = body.errors?.[0]?.description ?? body.message ?? `HTTP ${res.status}`;
          console.warn("[asaas-cancel] subscription:", msg);
          results.push(`subscription warning: ${msg}`);
        } else {
          results.push(`subscription ${asaas_subscription_id} not found / already cancelled`);
        }
      }
    }

    // Remove cobrança avulsa (não vinculada à assinatura)
    if (asaas_payment_id && !asaas_subscription_id) {
      const res = await fetch(`${ASAAS_BASE_URL}/payments/${asaas_payment_id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        results.push(`payment ${asaas_payment_id} deleted`);
      } else {
        if (res.status !== 404) {
          const body = await res.json().catch(() => ({})) as { errors?: { description: string }[]; message?: string };
          const msg = body.errors?.[0]?.description ?? body.message ?? `HTTP ${res.status}`;
          console.warn("[asaas-cancel] payment:", msg);
          results.push(`payment warning: ${msg}`);
        } else {
          results.push(`payment ${asaas_payment_id} not found / already deleted`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
