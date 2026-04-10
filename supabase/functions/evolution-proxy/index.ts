import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verifica autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    // 2. Pega credenciais do servidor (nunca expostas ao browser)
    const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      throw new Error("Evolution API não configurada");
    }

    // 3. Lê o body da requisição
    const { action, payload } = await req.json();

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
        throw new Error(`Ação desconhecida: ${action}`);
    }

    const res = await fetch(url, { method, headers: evolutionHeaders, body });
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }
});
