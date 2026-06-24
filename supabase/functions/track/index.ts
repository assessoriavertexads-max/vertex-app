/**
 * track — Link de rastreamento de campanhas
 *
 * GET /track?t=TOKEN
 * 1. Incrementa o contador de cliques atomicamente
 * 2. Redireciona para o WhatsApp do cliente
 *
 * verify_jwt = false  (link público, acessado por qualquer pessoa)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("t")?.trim();

  if (!token) {
    return new Response("Link inválido.", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Incrementa e retorna o URL de destino em uma única operação atômica
  const { data: waUrl, error } = await supabase
    .rpc("increment_campaign_click", { p_token: token });

  if (error || !waUrl) {
    return new Response("Link não encontrado.", { status: 404 });
  }

  // Redireciona para o WhatsApp do cliente
  return Response.redirect(waUrl as string, 302);
});
