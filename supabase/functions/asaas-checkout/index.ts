import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findOrCreateAsaasCustomer(
  company: { name: string; document: string | null },
  apiKey: string
): Promise<string> {
  const headers = { 'Content-Type': 'application/json', 'access_token': apiKey };
  const cpfCnpj = company.document ? company.document.replace(/\D/g, '') : null;

  if (cpfCnpj) {
    const res = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpfCnpj}&limit=1`, { headers });
    const data = await res.json();
    if (data.data?.length > 0) return data.data[0].id;
  }

  const res = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: company.name, ...(cpfCnpj ? { cpfCnpj } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
  return data.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada');

    const { transaction_id } = await req.json();
    if (!transaction_id) throw new Error('transaction_id é obrigatório.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: transaction, error: txError } = await supabase
      .from('financial_transactions')
      .select('*, companies(id, name, document, asaas_customer_id)')
      .eq('id', transaction_id)
      .single();


    if (txError || !transaction) throw new Error('Transação não encontrada.');
    if (!transaction.companies) throw new Error('Nenhuma empresa vinculada a esta transação.');

    const asaasHeaders = { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY };

    const asaasCustomerId = await findOrCreateAsaasCustomer(
      transaction.companies as { name: string; document: string | null },
      ASAAS_API_KEY
    );

    // Salva customer_id na empresa se necessário
    if (!transaction.companies.asaas_customer_id) {
      await supabase.from('companies')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', transaction.companies.id);
    }

    const dueDate = transaction.due_date
      ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const isSubscription = !!transaction.subscription_cycle;
    const billingType = transaction.billing_type || 'UNDEFINED';

    if (isSubscription) {
      const res = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType,
          value: Number(transaction.amount),
          nextDueDate: dueDate,
          cycle: transaction.subscription_cycle,
          description: transaction.category || 'Assinatura Vertex',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');

      // Busca o primeiro pagamento da assinatura para obter o invoiceUrl
      let invoiceUrl: string | null = null;
      try {
        const paymentsRes = await fetch(
          `${ASAAS_BASE_URL}/payments?subscription=${data.id}&limit=1`,
          { headers: asaasHeaders }
        );
        const paymentsData = await paymentsRes.json();
        invoiceUrl = paymentsData.data?.[0]?.invoiceUrl ?? null;
      } catch {
        // URL opcional — não bloqueia o fluxo
      }

      await supabase.from('financial_transactions').update({
        asaas_subscription_id: data.id,
        asaas_payment_url: invoiceUrl,
      }).eq('id', transaction_id);

      return new Response(
        JSON.stringify({ subscription_id: data.id, url: invoiceUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType,
          value: Number(transaction.amount),
          dueDate,
          description: transaction.category || 'Cobrança Vertex',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas');

      await supabase.from('financial_transactions').update({
        asaas_payment_id: data.id,
        asaas_payment_url: data.invoiceUrl,
      }).eq('id', transaction_id);

      return new Response(
        JSON.stringify({ payment_id: data.id, url: data.invoiceUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
