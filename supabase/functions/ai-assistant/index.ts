import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Não autorizado" }, 401);

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "IA não configurada. Configure ANTHROPIC_API_KEY nas secrets do Supabase." }, 503);
  }

  let prompt: string;
  let context: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    context = body.context;
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  if (!prompt?.trim()) return json({ error: "Campo 'prompt' obrigatório" }, 400);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const system = `Você é um assistente de Business Intelligence para agências digitais e empresas SaaS. Analisa dados financeiros, CRM e operacionais e fornece insights acionáveis em português brasileiro. Seja direto e prático — use os dados reais fornecidos, cite valores e métricas específicas. Responda em 2-4 parágrafos ou lista de pontos. Sem introduções genéricas.`;

  const userContent = context
    ? `DADOS DO NEGÓCIO:\n${context}\n\nPERGUNTA: ${prompt}`
    : prompt;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    return json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar IA";
    return json({ error: msg }, 502);
  }
});
