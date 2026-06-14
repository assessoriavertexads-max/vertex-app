/**
 * vertex-api
 *
 * API REST pública do Vertex para integração com n8n, Make, Zapier e parceiros.
 *
 * Autenticação: Header  X-API-Key: vtx_live_xxxx
 *
 * Endpoints:
 *   GET  /vertex-api                       → info + lista de endpoints
 *   GET  /vertex-api/companies             → lista empresas
 *   GET  /vertex-api/companies/:id         → empresa individual
 *   GET  /vertex-api/transactions          → cobranças (?company_id, status, from, to)
 *   POST /vertex-api/transactions          → criar cobrança  [write]
 *   PATCH /vertex-api/transactions/:id     → atualizar status [write]
 *   GET  /vertex-api/leads                 → leads do CRM
 *   POST /vertex-api/leads                 → criar lead       [write]
 *   PATCH /vertex-api/leads/:id            → atualizar lead   [write]
 *   GET  /vertex-api/tasks                 → tarefas
 *   POST /vertex-api/tasks                 → criar tarefa     [write]
 *   PATCH /vertex-api/tasks/:id            → atualizar tarefa [write]
 *   POST /vertex-api/webhooks/trigger      → disparar evento  [write]
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return json({ error: message }, status);
}

// ── SHA-256 helper ────────────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Autenticação via API Key ──────────────────────────────────────────────────
async function authenticate(
  req: Request,
  sb: ReturnType<typeof createClient>,
): Promise<{ userId: string; permissions: string[] } | null> {
  const rawKey = req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  if (!rawKey || !rawKey.startsWith("vtx_")) return null;

  const keyHash = await sha256(rawKey);

  const { data } = await sb
    .from("api_keys")
    .select("auth_user_id, permissions, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!data || !data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // best-effort update de last_used_at
  sb.from("api_keys").update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash).then(() => {});

  return { userId: data.auth_user_id, permissions: data.permissions ?? ["read"] };
}

// ── Helpers de URL ────────────────────────────────────────────────────────────
function parsePath(req: Request): string[] {
  const url = new URL(req.url);
  return url.pathname.replace(/^\/vertex-api\/?/, "").split("/").filter(Boolean);
}
function qs(req: Request) { return new URL(req.url).searchParams; }

// ── /companies ────────────────────────────────────────────────────────────────
async function handleCompanies(
  req: Request, parts: string[], sb: ReturnType<typeof createClient>, userId: string,
) {
  const id = parts[0];

  if (req.method === "GET" && !id) {
    const q      = qs(req);
    const limit  = Math.min(Number(q.get("limit") ?? 50), 200);
    const offset = Number(q.get("offset") ?? 0);
    const search = q.get("search") ?? "";

    let query = sb
      .from("companies")
      .select("id, name, document, phone, email, status, meta_ad_account_id, google_ad_account_id, asaas_customer_id, created_at")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .order("name")
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return json({ data, count: data?.length ?? 0, limit, offset });
  }

  if (req.method === "GET" && id) {
    const { data, error } = await sb
      .from("companies")
      .select("*, company_metrics(*)")
      .eq("id", id)
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(error.message, 500);
    if (!data)  return err("Empresa não encontrada", 404);
    return json({ data });
  }

  return err("Método não suportado", 405);
}

// ── /transactions ─────────────────────────────────────────────────────────────
async function handleTransactions(
  req: Request, parts: string[], sb: ReturnType<typeof createClient>,
  userId: string, perms: string[],
) {
  const id = parts[0];
  const q  = qs(req);

  if (req.method === "GET") {
    const limit  = Math.min(Number(q.get("limit") ?? 50), 200);
    const offset = Number(q.get("offset") ?? 0);

    let query = sb
      .from("financial_transactions")
      .select("id, company_id, amount, type, category, status, due_date, subscription_cycle, asaas_payment_url, created_at, companies(name)")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .order("due_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.get("company_id")) query = query.eq("company_id", q.get("company_id")!);
    if (q.get("status"))     query = query.eq("status", q.get("status")!);
    if (q.get("from"))       query = query.gte("due_date", q.get("from")!);
    if (q.get("to"))         query = query.lte("due_date", q.get("to")!);

    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return json({ data, count: data?.length ?? 0, limit, offset });
  }

  if (req.method === "POST") {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const { company_id, amount, type = "income", category, status = "pending", due_date, subscription_cycle } = body;
    if (!amount || !category) return err("amount e category são obrigatórios", 400);
    const { data, error } = await sb.from("financial_transactions")
      .insert({ auth_user_id: userId, company_id: company_id ?? null, amount: Number(amount), type, category, status, due_date: due_date ?? null, subscription_cycle: subscription_cycle ?? null })
      .select().single();
    if (error) return err(error.message, 500);
    return json({ data }, 201);
  }

  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const allowed = ["status", "amount", "due_date", "category", "asaas_payment_url"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
    const { data, error } = await sb.from("financial_transactions")
      .update(update).eq("id", id).eq("auth_user_id", userId).select().single();
    if (error) return err(error.message, 500);
    return json({ data });
  }

  return err("Método não suportado", 405);
}

// ── /leads ────────────────────────────────────────────────────────────────────
async function handleLeads(
  req: Request, parts: string[], sb: ReturnType<typeof createClient>,
  userId: string, perms: string[],
) {
  const id = parts[0];
  const q  = qs(req);

  if (req.method === "GET") {
    const limit  = Math.min(Number(q.get("limit") ?? 50), 200);
    const offset = Number(q.get("offset") ?? 0);

    let query = sb
      .from("leads")
      .select("id, name, email, phone, company_id, stage, value, notes, created_at, companies(name)")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.get("stage"))      query = query.eq("stage", q.get("stage")!);
    if (q.get("company_id")) query = query.eq("company_id", q.get("company_id")!);

    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return json({ data, count: data?.length ?? 0, limit, offset });
  }

  if (req.method === "POST") {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const { name, email, phone, company_id, stage = "novo", value, notes } = body;
    if (!name) return err("name é obrigatório", 400);
    const { data, error } = await sb.from("leads")
      .insert({ auth_user_id: userId, name, email: email ?? null, phone: phone ?? null, company_id: company_id ?? null, stage, value: value ? Number(value) : null, notes: notes ?? null })
      .select().single();
    if (error) return err(error.message, 500);
    return json({ data }, 201);
  }

  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const allowed = ["name", "email", "phone", "stage", "value", "notes", "company_id"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
    const { data, error } = await sb.from("leads")
      .update(update).eq("id", id).eq("auth_user_id", userId).select().single();
    if (error) return err(error.message, 500);
    return json({ data });
  }

  return err("Método não suportado", 405);
}

// ── /tasks ────────────────────────────────────────────────────────────────────
async function handleTasks(
  req: Request, parts: string[], sb: ReturnType<typeof createClient>,
  userId: string, perms: string[],
) {
  const id = parts[0];
  const q  = qs(req);

  if (req.method === "GET") {
    const limit  = Math.min(Number(q.get("limit") ?? 50), 200);
    const offset = Number(q.get("offset") ?? 0);

    let query = sb
      .from("tasks")
      .select("id, name, description, status, priority, due_date, company_id, created_at, companies(name)")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .range(offset, offset + limit - 1);

    if (q.get("status"))     query = query.eq("status", q.get("status")!);
    if (q.get("company_id")) query = query.eq("company_id", q.get("company_id")!);
    if (q.get("due_from"))   query = query.gte("due_date", q.get("due_from")!);
    if (q.get("due_to"))     query = query.lte("due_date", q.get("due_to")!);

    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return json({ data, count: data?.length ?? 0, limit, offset });
  }

  if (req.method === "POST") {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const { name, description, status = "a_receber", priority = "normal", due_date, company_id } = body;
    if (!name) return err("name é obrigatório", 400);
    const { data, error } = await sb.from("tasks")
      .insert({ auth_user_id: userId, name, description: description ?? null, status, priority, due_date: due_date ?? null, company_id: company_id ?? null })
      .select().single();
    if (error) return err(error.message, 500);
    return json({ data }, 201);
  }

  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    if (!perms.includes("write")) return err("Permissão insuficiente", 403);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err("Body inválido", 400); }
    const allowed = ["name", "description", "status", "priority", "due_date", "company_id"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
    const { data, error } = await sb.from("tasks")
      .update(update).eq("id", id).eq("auth_user_id", userId).select().single();
    if (error) return err(error.message, 500);
    return json({ data });
  }

  return err("Método não suportado", 405);
}

// ── /webhooks/trigger ─────────────────────────────────────────────────────────
async function handleWebhookTrigger(
  req: Request, sb: ReturnType<typeof createClient>,
  userId: string, perms: string[],
) {
  if (req.method !== "POST") return err("Apenas POST", 405);
  if (!perms.includes("write")) return err("Permissão insuficiente", 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Body inválido", 400); }

  const { event, company_id, data: eventData } = body;
  if (!event) return err("event é obrigatório", 400);

  // Tenta inserir na tabela de eventos; ignora se não existir
  try {
    await sb.from("webhook_events").insert({
      auth_user_id: userId,
      source:       "external_api",
      event_type:   String(event),
      company_id:   company_id ?? null,
      payload:      eventData ?? {},
    });
  } catch { /* tabela opcional */ }

  return json({ ok: true, event, received_at: new Date().toISOString() });
}

// ── Router ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb    = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const parts = parsePath(req);

  // Root — documentação
  if (parts.length === 0 && req.method === "GET") {
    return json({
      name:    "Vertex API",
      version: "1.0.0",
      auth:    "Header: X-API-Key: vtx_live_...",
      docs:    "Gere sua chave em Vertex → Configurações → API Keys",
      endpoints: [
        "GET  /vertex-api/companies?search&limit&offset",
        "GET  /vertex-api/companies/:id",
        "GET  /vertex-api/transactions?company_id&status&from&to&limit&offset",
        "POST /vertex-api/transactions",
        "PATCH /vertex-api/transactions/:id",
        "GET  /vertex-api/leads?stage&company_id&limit&offset",
        "POST /vertex-api/leads",
        "PATCH /vertex-api/leads/:id",
        "GET  /vertex-api/tasks?status&company_id&due_from&due_to&limit&offset",
        "POST /vertex-api/tasks",
        "PATCH /vertex-api/tasks/:id",
        "POST /vertex-api/webhooks/trigger",
      ],
    });
  }

  const auth = await authenticate(req, sb);
  if (!auth) return err("API Key inválida ou ausente. Use: X-API-Key: vtx_live_...", 401);

  const { userId, permissions } = auth;
  const [resource, ...rest]    = parts;

  if (resource === "companies")   return handleCompanies(req, rest, sb, userId);
  if (resource === "transactions") return handleTransactions(req, rest, sb, userId, permissions);
  if (resource === "leads")       return handleLeads(req, rest, sb, userId, permissions);
  if (resource === "tasks")       return handleTasks(req, rest, sb, userId, permissions);
  if (resource === "webhooks" && rest[0] === "trigger")
    return handleWebhookTrigger(req, sb, userId, permissions);

  return err("Endpoint não encontrado", 404);
});
