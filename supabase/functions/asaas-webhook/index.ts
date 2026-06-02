/**
 * asaas-webhook
 *
 * Recebe eventos do Asaas e atualiza financial_transactions em tempo real.
 *
 * Configuração no Asaas:
 *   Dashboard → Integrações → Webhooks → URL:
 *   https://<project>.supabase.co/functions/v1/asaas-webhook
 *
 * Eventos tratados:
 *   PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED_IN_CASH → status = 'paid'
 *   PAYMENT_OVERDUE        → status = 'overdue'
 *   PAYMENT_DELETED / PAYMENT_REFUNDED / PAYMENT_CANCELLED → status = 'cancelled'
 *   PAYMENT_UPDATED        → atualiza valor e vencimento
 *   PAYMENT_CREATED        → importa cobrança avulsa nova (se não existir)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Opcional: token secreto configurado no Asaas para validar origem
const WEBHOOK_TOKEN     = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

function mapStatus(asaasStatus: string): string {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(asaasStatus)) return "paid";
  if (["REFUNDED", "REFUND_REQUESTED", "CANCELLED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(asaasStatus)) return "cancelled";
  if (asaasStatus === "OVERDUE") return "overdue";
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
  // Apenas POST aceito
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Valida token secreto (se configurado)
  if (WEBHOOK_TOKEN) {
    const token = req.headers.get("asaas-access-token") ?? req.headers.get("x-webhook-token");
    if (token !== WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const event   = body.event as string | undefined;
  const payment = body.payment as Record<string, unknown> | undefined;

  // Ignora eventos que não são de pagamento
  if (!event?.startsWith("PAYMENT_") || !payment?.id) {
    return new Response(JSON.stringify({ ok: true, skipped: event ?? "no event" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase    = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const paymentId   = payment.id   as string;
  const newStatus   = mapStatus(payment.status as string);
  const invoiceUrl  = (payment.invoiceUrl as string | null) ?? null;
  const dueDate     = (payment.dueDate    as string | null) ?? null;
  const value       = payment.value       as number | null;
  const subId       = (payment.subscription as string | null) ?? null;

  // ── 1. Tenta atualizar pelo asaas_payment_id ─────────────────────────────
  const { data: byId } = await supabase
    .from("financial_transactions")
    .update({
      status:            newStatus,
      asaas_payment_url: invoiceUrl,
      ...(dueDate ? { due_date: dueDate }  : {}),
      ...(value   ? { amount:   value }    : {}),
    })
    .eq("asaas_payment_id", paymentId)
    .select("id");

  // ── 2. Pagamento de assinatura ───────────────────────────────────────────
  if (!byId?.length && subId) {
    // Tenta vincular a linha pendente (asaas_payment_id ainda NULL = primeiro ciclo)
    const { data: linked } = await supabase
      .from("financial_transactions")
      .update({
        status:             newStatus,
        asaas_payment_id:   paymentId,
        asaas_payment_url:  invoiceUrl,
        ...(dueDate ? { due_date: dueDate } : {}),
        ...(value   ? { amount:   value }   : {}),
      })
      .eq("asaas_subscription_id", subId)
      .is("asaas_payment_id", null)
      .select("id");

    if (linked?.length) {
      return new Response(
        JSON.stringify({ ok: true, event, action: "linked_subscription_payment", status: newStatus }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Nenhuma linha pendente encontrada = novo ciclo de cobrança (mês seguinte)
    // Busca dados base da assinatura para criar nova linha
    const { data: baseSub } = await supabase
      .from("financial_transactions")
      .select("company_id, category, subscription_cycle")
      .eq("asaas_subscription_id", subId)
      .limit(1)
      .maybeSingle();

    if (baseSub) {
      await supabase.from("financial_transactions").insert({
        company_id:            baseSub.company_id,
        amount:                value ?? 0,
        type:                  "income",
        category:              baseSub.category,
        due_date:              dueDate,
        subscription_cycle:    baseSub.subscription_cycle,
        asaas_subscription_id: subId,
        asaas_payment_id:      paymentId,
        asaas_payment_url:     invoiceUrl,
        status:                newStatus,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, event, action: "new_subscription_cycle", status: newStatus }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // ── 3. PAYMENT_CREATED: cobrança avulsa nova — insere se não existe ───────
  if (!byId?.length && event === "PAYMENT_CREATED" && !subId) {
    const customerId = payment.customer as string | null;

    // Descobre a empresa pelo asaas_customer_id
    let companyId: string | null = null;
    if (customerId) {
      const { data: co } = await supabase
        .from("companies")
        .select("id")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();
      companyId = co?.id ?? null;
    }

    const billing  = billingLabel((payment.billingType as string) ?? "");
    const desc     = payment.description as string | null;
    const category = desc
      ? `${desc}${billing ? ` (${billing})` : ""}`
      : billing || "Cobrança Avulsa";

    await supabase.from("financial_transactions").insert({
      company_id:        companyId,
      amount:            value ?? 0,
      type:              "income",
      category,
      due_date:          dueDate,
      subscription_cycle: null,
      asaas_payment_id:  paymentId,
      asaas_payment_url: invoiceUrl,
      status:            newStatus,
    });

    return new Response(
      JSON.stringify({ ok: true, event, action: "inserted_new_payment", status: newStatus }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, event, action: byId?.length ? "updated" : "not_found", status: newStatus }),
    { headers: { "Content-Type": "application/json" } },
  );
});
