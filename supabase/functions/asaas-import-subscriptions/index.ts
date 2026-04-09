import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchAllCustomerSubscriptions(customerId: string, apiKey: string) {
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
      subscriptions.push(...data.data);
      offset += data.data.length;
      hasMore = data.hasMore ?? false;
    } else {
      hasMore = false;
    }
  }
  return subscriptions;
}

async function fetchAllPaymentsForSubscription(subscriptionId: string, apiKey: string) {
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

function mapAsaasCycle(cycle: string): string {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada');

    const { company_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, asaas_customer_id')
      .eq('id', company_id)
      .single();

    if (companyError || !company) throw new Error('Empresa não encontrada');
    if (!company.asaas_customer_id) throw new Error('Empresa não possui ID Asaas vinculado');

    const subscriptions = await fetchAllCustomerSubscriptions(company.asaas_customer_id, ASAAS_API_KEY);

    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, updated: 0, total_found: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const subscription of subscriptions) {
      try {
        // 1. Upsert registro da assinatura (próxima cobrança)
        const { data: existingSub } = await supabase
          .from('financial_transactions')
          .select('id')
          .eq('asaas_subscription_id', subscription.id)
          .is('asaas_payment_id', null)
          .maybeSingle();

        if (existingSub) {
          // Atualiza data da próxima cobrança
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
            company_id,
            amount: subscription.value,
            type: 'income',
            category: subscription.description || 'Assinatura Importada',
            due_date: subscription.nextDueDate,
            subscription_cycle: mapAsaasCycle(subscription.cycle),
            asaas_subscription_id: subscription.id,
            asaas_payment_url: null,
            status: subscription.status === 'ACTIVE' ? 'pending' : 'cancelled',
          });
          imported++;
        }

        // 2. Importa pagamentos históricos da assinatura
        const payments = await fetchAllPaymentsForSubscription(subscription.id, ASAAS_API_KEY);

        for (const payment of payments) {
          // Ignora pagamentos pendentes (já cobertos pelo registro da assinatura)
          if (payment.status === 'PENDING') continue;

          const { data: existingPayment } = await supabase
            .from('financial_transactions')
            .select('id')
            .eq('asaas_payment_id', payment.id)
            .maybeSingle();

          if (existingPayment) continue;

          const { error: insertError } = await supabase.from('financial_transactions').insert({
            company_id,
            amount: payment.value,
            type: 'income',
            category: subscription.description || 'Assinatura Importada',
            due_date: payment.dueDate,
            subscription_cycle: mapAsaasCycle(subscription.cycle),
            asaas_subscription_id: subscription.id,
            asaas_payment_id: payment.id,
            status: mapPaymentStatus(payment.status),
          });

          if (insertError) {
            errors.push(`Erro no pagamento ${payment.id}: ${insertError.message}`);
          } else {
            imported++;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        errors.push(`Erro na assinatura ${subscription.id}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        total_found: subscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
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
