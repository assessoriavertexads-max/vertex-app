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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Verifica autenticação
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Não autorizado" }, 401);

  // 2. Credenciais do servidor
  const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");

  if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return json({ error: "Evolution API não configurada no servidor" }, 503);
  }

  // 3. Lê body
  let action: string;
  let payload: unknown;
  try {
    const body = await req.json();
    action = body.action;
    payload = body.payload;
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  if (!action) return json({ error: "Campo 'action' obrigatório" }, 400);

  const evolutionHeaders = {
    "Content-Type": "application/json",
    "apikey": EVOLUTION_API_KEY,
  };

  let url = "";
  let method = "GET";
  let body: string | undefined;

  switch (action) {
    case "fetchChats":
      url = `${EVOLUTION_URL}/chat/findChats/${EVOLUTION_INSTANCE}`;
      method = "POST";
      body = JSON.stringify(payload || { where: {}, limit: 50 });
      break;

    case "fetchMessages":
      url = `${EVOLUTION_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`;
      method = "POST";
      body = JSON.stringify(payload);
      break;

    case "sendMessage":
      url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      method = "POST";
      body = JSON.stringify(payload);
      break;

    case "connectionState":
      url = `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`;
      method = "GET";
      break;

    default:
      return json({ error: `Ação desconhecida: ${action}` }, 400);
  }

  try {
    const res = await fetchWithTimeout(url, { method, headers: evolutionHeaders, body });
    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na requisição";
    const isTimeout = message.includes("aborted") || message.includes("abort");
    return json(
      { error: isTimeout ? "Timeout: Evolution API não respondeu" : message },
      isTimeout ? 504 : 502
    );
  }
});
