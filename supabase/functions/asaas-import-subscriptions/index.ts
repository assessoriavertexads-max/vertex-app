import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

async function findCustomerByCnpj(cnpj: string, apiKey: string): Promise<string | null> {
  const headers = { 'Content-Type': 'application/json', 'access_token': apiKey };
  const res = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cnpj}&limit=1`, { headers });
  const data = await res.json();
  if (data.data?.length > 0) return data.data[0].id;
  return null;
}

async function fetchAllSubscriptions(customerId: string, apiKey: string) {
  const subscriptions = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  const headers = { 'Content-Type': 'application/json', 'access_token': apiKey };

  while (hasMore) {
    const res = await fetch(
      `${ASAAS_BASE_URL}/subscriptions?limit=${limit}&offset=${offset}&customerId=${customerId}`,
      { headers }
    );
    const data = await res.json();
    if (data.data?.length > 0) {
      const filtered = data.data.filter((s: { customer: string }) => s.customer === customerId);
      subscriptions.push(...filtered);
      offset += data.data.length;
      hasMore = data.hasMore ?? false;
    } else {
      hasMore = false;
    }
  }
  return subscriptions;
}

async function fetchPaymentsForSubscription(subscriptionId: string, apiKey: string) {
  const payments = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  const headers = { 'Content-Type': 'application/json', 'access_token': apiKey };

  while (hasMore) {
    const res = await fetch(
      `${ASAAS_BASE_URL}/payments?subscription=${subscriptionId}&limit=${limit}&offset=${offset}`,
      { headers }
    );
    const data = await res.json();
    if (data.data?.length > 0) {
      payments.push(...data.data);
      offset += data.data.length;
      hasMore = data.hasMore ?? false;
    } else {
      hasMore = false;
    }
  }
  return payments;
}

function mapCycle(cycle: string): string {
  const map: Record<string, string> = {
    'MONTHLY': 'MONTHLY', 'WEEKLY': 'WEEKLY', 'BIWEEKLY': 'BIWEEKLY',
    'QUARTERLY': 'QUARTERLY', 'SEMIANNUALLY': 'SEMIANNUALLY', 'YEARLY': 'YEARLY',
  };
  return map[cycle] || 'MONTHLY';
}

function mapPaymentStatus(status: string): string {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) return 'paid';
  if (['REFUNDED', 'CANCELLED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'REFUND_REQUESTED'].includes(status)) return 'cancelled';
  if (status === 'OVERDUE') return 'overdue';
  return 'pending';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importCompany(company: { id: string; name: string; document: string; asaas_customer_id: string | null }, apiKey: string, supabase: any) {
  const cnpj = cleanDocument(company.document);
  const customerId = await findCustomerByCnpj(cnpj, apiKey);
  if (!customerId) return { imported: 0, updated: 0, errors: [`${company.name}: nenhum cliente Asaas com CNPJ ${company.document}`] };

  if (company.asaas_customer_id !== customerId) {
    await supabase.from('companies').update({ asaas_customer_id: customerId }).eq('id', company.id);
  }

  const subscriptions = await fetchAllSubscriptions(customerId, apiKey);
  let imported = 0, updated = 0;
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    try {
      const { data: existingSub } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('asaas_subscription_id', subscription.id)
        .is('asaas_payment_id', null)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from('financial_transactions')
          .update({
            due_date: subscription.nextDueDate,
            amount: subscription.value,
            status: subscription.status === 'ACTIVE' ? 'pending' : 'cancelled',
          })
          .eq('id', existingSub.id);
        updated++;
      } else {
        await supabase.from('financial_transactions').insert({
          company_id: company.id,
          amount: subscription.value,
          type: 'income',
          category: subscription.description || 'Assinatura Importada',
          due_date: subscription.nextDueDate,
          subscription_cycle: mapCycle(subscription.cycle),
          asaas_subscription_id: subscription.id,
          asaas_payment_url: null,
          status: subscription.status === 'ACTIVE' ? 'pending' : 'cancelled',
        });
        imported++;
      }

      const payments = await fetchPaymentsForSubscription(subscription.id, apiKey);
      for (const payment of payments) {
        // Pagamento pendente do mês atual: atualiza URL no registro principal e pula (evita duplicata)
        if (payment.status === 'PENDING' && payment.dueDate === subscription.nextDueDate) {
          if (existingSub && payment.invoiceUrl) {
            await supabase.from('financial_transactions')
              .update({ asaas_payment_url: payment.invoiceUrl })
              .eq('id', existingSub.id);
          }
          continue;
        }

        const { data: existingPayment } = await supabase
          .from('financial_transactions')
          .select('id, status, asaas_payment_url')
          .eq('asaas_payment_id', payment.id)
          .maybeSingle();

        if (existingPayment) {
          const newStatus = mapPaymentStatus(payment.status);
          if (existingPayment.status !== newStatus || (!existingPayment.asaas_payment_url && payment.invoiceUrl)) {
            await supabase.from('financial_transactions').update({
              status: newStatus,
              asaas_payment_url: payment.invoiceUrl || null,
            }).eq('asaas_payment_id', payment.id);
          }
          continue;
        }

        const { error: insertError } = await supabase.from('financial_transactions').insert({
          company_id: company.id,
          amount: payment.value,
          type: 'income',
          category: subscription.description || 'Assinatura Importada',
          due_date: payment.dueDate,
          subscription_cycle: mapCycle(subscription.cycle),
          asaas_subscription_id: subscription.id,
          asaas_payment_id: payment.id,
          asaas_payment_url: payment.invoiceUrl || null,
          status: mapPaymentStatus(payment.status),
        });

        if (insertError) {
          errors.push(`Pagamento ${payment.id}: ${insertError.message}`);
        } else {
          imported++;
        }
      }
    } catch (err) {
      errors.push(`Assinatura ${subscription.id}: ${err instanceof Error ? err.message : 'Erro'}`);
    }
  }

  return { imported, updated, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: { company_id?: string; all?: boolean } = {};
    try { body = await req.json(); } catch { /* cron pode chamar sem body */ }

    const { company_id, all: importAll } = body;

    // ── Modo: importar TODAS as empresas (botão "Importar Todas" ou cron) ────
    if (importAll || !company_id) {
      const { data: allCompanies, error: allErr } = await supabase
        .from('companies')
        .select('id, name, document, asaas_customer_id')
        .not('document', 'is', null);

      if (allErr) throw new Error('Erro ao listar empresas');

      let totalImported = 0, totalUpdated = 0;
      const allErrors: string[] = [];

      for (const company of (allCompanies || [])) {
        if (!company.document) continue;
        const result = await importCompany(company, ASAAS_API_KEY, supabase);
        totalImported += result.imported;
        totalUpdated += result.updated;
        allErrors.push(...result.errors);
      }

      return new Response(
        JSON.stringify({ success: true, imported: totalImported, updated: totalUpdated, errors: allErrors.length ? allErrors : undefined }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Modo: importar empresa específica ─────────────────────────────────────
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, document, asaas_customer_id')
      .eq('id', company_id)
      .single();

    if (companyError || !company) throw new Error('Empresa não encontrada');
    if (!company.document) throw new Error('Empresa não possui CNPJ/CPF cadastrado');

    const result = await importCompany(company, ASAAS_API_KEY, supabase);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
