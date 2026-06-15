/**
 * submit-form
 * Recebe respostas de formulários públicos (sem autenticação) e cria leads.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Apenas POST" }, 405);

  let body: { slug: string; answers: Record<string, string> };
  try { body = await req.json(); }
  catch { return json({ error: "Body inválido" }, 400); }

  const { slug, answers } = body;
  if (!slug || !answers) return json({ error: "slug e answers são obrigatórios" }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Busca o formulário
  const { data: form, error: formErr } = await sb
    .from("lead_forms")
    .select("id, auth_user_id, title, questions, settings")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (formErr || !form) return json({ error: "Formulário não encontrado" }, 404);

  interface Question {
    id: string;
    label: string;
    maps_to?: string;
    type: string;
  }

  const questions: Question[] = form.questions ?? [];

  // Mapeia respostas para colunas de leads
  let leadName:  string | null = null;
  let leadEmail: string | null = null;
  let leadPhone: string | null = null;
  const extraLines: string[]   = [];

  for (const q of questions) {
    const val = answers[q.id]?.trim();
    if (!val) continue;
    if (q.maps_to === "name")  { leadName  = val; continue; }
    if (q.maps_to === "email") { leadEmail = val; continue; }
    if (q.maps_to === "phone") { leadPhone = val; continue; }
    extraLines.push(`${q.label}: ${val}`);
  }

  const notes = extraLines.join("\n") || null;

  // Cria o lead
  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .insert({
      auth_user_id: form.auth_user_id,
      name:         leadName ?? "Lead sem nome",
      email:        leadEmail,
      phone:        leadPhone,
      stage:        "novo",
      notes,
    })
    .select("id")
    .single();

  if (leadErr) return json({ error: leadErr.message }, 500);

  // Registra a resposta e incrementa contador
  await sb.from("lead_form_responses").insert({
    form_id:  form.id,
    lead_id:  lead.id,
    answers,
  });

  await sb.from("lead_forms")
    .update({ response_count: sb.rpc("coalesce", {}) })
    .eq("id", form.id);

  // Incrementa response_count com RPC segura
  await sb.rpc("increment_form_responses", { form_id: form.id }).catch(() => {});

  return json({ ok: true, lead_id: lead.id });
});
