/**
 * submit-form
 * GET  ?slug=xxx  → retorna dados do formulário (sem autenticação, usa SERVICE_ROLE)
 * POST { slug, answers } → cria lead no CRM
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── GET: busca formulário pelo slug ────────────────────────────────────────
  if (req.method === "GET") {
    const url  = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) return json({ error: "slug é obrigatório" }, 400);

    const { data: form, error } = await sb
      .from("lead_forms")
      .select("id, title, description, questions, settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error)  return json({ error: error.message }, 500);
    if (!form)  return json({ error: "Formulário não encontrado" }, 404);
    return json(form);
  }

  // ── POST: submete respostas ────────────────────────────────────────────────
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body: { slug: string; answers: Record<string, string> };
  try { body = await req.json(); }
  catch { return json({ error: "Body inválido" }, 400); }

  const { slug, answers } = body;
  if (!slug || !answers) return json({ error: "slug e answers são obrigatórios" }, 400);

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
    type: string;
    maps_to?: string;
    schedule_settings?: { duration_minutes?: number };
  }

  const questions: Question[] = form.questions ?? [];

  let leadTitle: string | null = null;
  let leadEmail: string | null = null;
  let leadPhone: string | null = null;
  let scheduledAt: string | null = null;
  const extraLines: string[] = [];

  for (const q of questions) {
    const val = answers[q.id]?.trim();
    if (!val) continue;
    if (q.type === "schedule") { scheduledAt = val; continue; }
    switch (q.maps_to) {
      case "name":  leadTitle = val; break;
      case "email": leadEmail = val; break;
      case "phone": leadPhone = val; break;
      case "notes": extraLines.push(val); break;
      default:      extraLines.push(`${q.label}: ${val}`);
    }
  }

  const notes = extraLines.join("\n") || null;
  const scheduledAtIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;

  // Try full insert; fall back to minimal if schema migration not yet applied (42703 = undefined_column)
  let lead: { id: string } | null = null;
  let leadErr: { message: string; code?: string } | null = null;

  ({ data: lead, error: leadErr } = await sb
    .from("leads")
    .insert({
      auth_user_id: form.auth_user_id,
      title:        leadTitle ?? "Lead sem nome",
      email:        leadEmail,
      phone:        leadPhone,
      notes,
      funnel_stage: "prospect",
      scheduled_at: scheduledAtIso,
      source:       "form",
    })
    .select("id")
    .single());

  if (leadErr?.code === "42703") {
    // Colunas extras não existem ainda (migração pendente) — insere apenas campos base
    ({ data: lead, error: leadErr } = await sb
      .from("leads")
      .insert({ title: leadTitle ?? "Lead sem nome", funnel_stage: "prospect" })
      .select("id")
      .single());

    // Se funnel_stage também não existir, usa status (coluna original)
    if (leadErr?.code === "42703") {
      ({ data: lead, error: leadErr } = await sb
        .from("leads")
        .insert({ title: leadTitle ?? "Lead sem nome", status: "prospect" })
        .select("id")
        .single());
    }
  }

  if (leadErr) return json({ error: leadErr.message, code: leadErr.code }, 500);

  await sb.from("lead_form_responses").insert({
    form_id: form.id,
    lead_id: lead.id,
    answers,
  });

  const { data: current } = await sb
    .from("lead_forms").select("response_count").eq("id", form.id).single();
  await sb.from("lead_forms")
    .update({ response_count: (current?.response_count ?? 0) + 1 })
    .eq("id", form.id);

  if (scheduledAtIso) {
    const schedQ = questions.find((q) => q.type === "schedule");
    await sb.from("meetings").insert({
      auth_user_id:     form.auth_user_id,
      lead_id:          lead.id,
      form_id:          form.id,
      scheduled_at:     scheduledAtIso,
      duration_minutes: schedQ?.schedule_settings?.duration_minutes ?? 30,
      title:            `Reunião – ${leadTitle ?? "Lead"}`,
    });
  }

  return json({ ok: true, lead_id: lead.id });
});
