/**
 * asaas-webhook
 *
 * Recebe eventos do Asaas e atualiza financial_transactions em tempo real.
 * verify_jwt = false  (chamada server-to-server, sem JWT Supabase)
 *
 * URL no Asaas:
 *   https://<project>.supabase.co/functions/v1/asaas-webhook
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_TOKEN    = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mapStatus(s: string): string {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s)) return "paid";
  if (["REFUNDED", "REFUND_REQUESTED", "CANCELLED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(s)) return "cancelled";
  if (s === "OVERDUE") return "overdue";
  return "pending";
}

function billingLabel(type: string): string {
  const m: Record<string, string> = {
    PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão de Crédito",
    DEBIT_CARD: "Cartão de Débito", TRANSFER: "Transferência",
  };
  return m[type] ?? type;
}

serve(async (req) => {
  if (req.method !== "POST") return err("Method Not Allowed", 405);

  // Valida token secreto opcional (configurado no Asaas)
  if (WEBHOOK_TOKEN) {
    const token = req.headers.get("asaas-access-token") ?? req.headers.get("x-webhook-token");
    if (token !== WEBHOOK_TOKEN) return err("Unauthorized", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON");
  }

  const event   = body.event   as string | undefined;
  const payment = body.payment as Record<string, unknown> | undefined;

  // Ignora eventos que não são de pagamento
  if (!event?.startsWith("PAYMENT_") || !payment?.id) {
    return ok({ skipped: event ?? "no event" });
  }

  const supabase   = createClient(SUPABASE_URL, SERVICE_KEY);
  const paymentId  = payment.id          as string;
  const asaasStatus = payment.status     as string;
  const newStatus  = mapStatus(asaasStatus);
  const invoiceUrl = (payment.invoiceUrl  as string | null) ?? null;
  const dueDate    = (payment.dueDate     as string | null) ?? null;
  const value      = (payment.value       as number | null) ?? null;
  // Asaas retorna subscription como string (ID) ou null
  const subId      = (payment.subscription as string | null) ?? null;
  const customerId = (payment.customer     as string | null) ?? null;

  // ── 1. Atualiza por asaas_payment_id (caminho mais direto) ──────────────
  const { data: byId, error: byIdErr } = await supabase
    .from("financial_transactions")
    .update({
      status:            newStatus,
      asaas_payment_url: invoiceUrl,
      ...(dueDate !== null ? { due_date: dueDate } : {}),
      ...(value   !== null ? { amount:   value   } : {}),
    })
    .eq("asaas_payment_id", paymentId)
    .select("id");

  if (byIdErr) console.error("[asaas-webhook] update by id:", byIdErr.message);
  if (byId?.length) return ok({ event, action: "updated", count: byId.length, status: newStatus });

  // ── 2. Pagamento de assinatura: vincula ao registro pendente ────────────
  if (subId) {
    const { data: linked } = await supabase
      .from("financial_transactions")
      .update({
        status:            newStatus,
        asaas_payment_id:  paymentId,
        asaas_payment_url: invoiceUrl,
        ...(dueDate !== null ? { due_date: dueDate } : {}),
        ...(value   !== null ? { amount:   value   } : {}),
      })
      .eq("asaas_subscription_id", subId)
      .is("asaas_payment_id", null)
      .select("id");

    if (linked?.length) return ok({ event, action: "linked_subscription_payment", status: newStatus });

    // Novo ciclo de cobrança — cria próxima entrada baseada na assinatura existente
    const { data: base } = await supabase
      .from("financial_transactions")
      .select("company_id, category, subscription_cycle, auth_user_id")
      .eq("asaas_subscription_id", subId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (base) {
      const { error: insErr } = await supabase.from("financial_transactions").insert({
        company_id:            base.company_id,
        auth_user_id:          base.auth_user_id,   // preserva o dono do registro
        amount:                value ?? 0,
        type:                  "income",
        category:              base.category,
        due_date:              dueDate,
        subscription_cycle:    base.subscription_cycle,
        asaas_subscription_id: subId,
        asaas_payment_id:      paymentId,
        asaas_payment_url:     invoiceUrl,
        status:                newStatus,
      });
      if (insErr) console.error("[asaas-webhook] insert new cycle:", insErr.message);
    } else {
      console.warn("[asaas-webhook] subscription not found in DB, subId:", subId);
    }

    return ok({ event, action: "new_subscription_cycle", status: newStatus });
  }

  // ── 3. PAYMENT_CREATED: cobrança avulsa nova ────────────────────────────
  if (event === "PAYMENT_CREATED") {
    // Idempotência: evita duplicata se Asaas re-enviar o evento
    const { data: exists } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();

    if (exists) return ok({ event, action: "already_exists", status: newStatus });

    // Resolve empresa + auth_user_id pelo asaas_customer_id
    let companyId:   string | null = null;
    let authUserId:  string | null = null;

    if (customerId) {
      const { data: co } = await supabase
        .from("companies")
        .select("id, auth_user_id")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();
      companyId  = co?.id           ?? null;
      authUserId = co?.auth_user_id ?? null;
    }

    const billing  = billingLabel((payment.billingType as string) ?? "");
    const desc     = payment.description as string | null;
    const category = desc
      ? `${desc}${billing ? ` (${billing})` : ""}`
      : billing || "Cobrança Avulsa";

    const { error: insErr } = await supabase.from("financial_transactions").insert({
      company_id:         companyId,
      auth_user_id:       authUserId,   // necessário para RLS
      amount:             value ?? 0,
      type:               "income",
      category,
      due_date:           dueDate,
      subscription_cycle: null,
      asaas_payment_id:   paymentId,
      asaas_payment_url:  invoiceUrl,
      status:             newStatus,
    });

    if (insErr) console.error("[asaas-webhook] insert avulso:", insErr.message);
    return ok({ event, action: "inserted_new_payment", status: newStatus });
  }

  // Evento de pagamento reconhecido mas sem ação (ex: PAYMENT_UPDATED sem match)
  return ok({ event, action: "no_match", paymentId });
});
