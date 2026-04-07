import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
if (!ASAAS_API_KEY) {
  throw new Error('Variável de ambiente ASAAS_API_KEY não configurada no Supabase.');
}

const ASAAS_BASE_URL = 'https://api.asaas.com/api/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY,
};

// Busca todas as assinaturas do Asaas para um cliente específico com paginação
async function fetchAllCustomerSubscriptions(customerId: string) {
  const subscriptions = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${ASAAS_BASE_URL}/subscriptions?limit=100&page=${page}&customerId=${customerId}`,
      { headers: asaasHeaders }
    );
    const data = await res.json();

    if (data.data?.length > 0) {
      subscriptions.push(...data.data);
      page++;
      hasMore = data.hasMore ?? false;
    } else {
      hasMore = false;
    }
  }

  return subscriptions;
}

// Mapeia ciclos do Asaas para ciclos do banco de dados
function mapAsaasCycle(asaasCycle: string): string {
  const cycleMap: Record<string, string> = {
    'MONTHLY': 'MONTHLY',
    'WEEKLY': 'WEEKLY',
    'BIWEEKLY': 'BIWEEKLY',
    'QUARTERLY': 'QUARTERLY',
    'SEMIANNUALLY': 'SEMIANNUALLY',
    'YEARLY': 'YEARLY',
  };
  return cycleMap[asaasCycle] || 'MONTHLY';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Busca a empresa
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('id, asaas_customer_id')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa não encontrada');
    }

    if (!company.asaas_customer_id) {
      throw new Error('Empresa não possui ID de cliente Asaas vinculado');
    }

    // 2. Busca todas as assinaturas do Asaas para este cliente
    const customerSubscriptions = await fetchAllCustomerSubscriptions(company.asaas_customer_id);

    if (customerSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          message: 'Nenhuma assinatura encontrada para este cliente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Sincroniza assinaturas com financial_transactions
    let imported = 0;
    const errors: string[] = [];

    for (const subscription of customerSubscriptions) {
      try {
        // Verifica se já existe
        const { data: existing } = await supabaseClient
          .from('financial_transactions')
          .select('id')
          .eq('asaas_subscription_id', subscription.id)
          .maybeSingle();

        if (existing) {
          continue; // Já foi importada
        }

        // Importa como nova transação
        const { error: insertError } = await supabaseClient
          .from('financial_transactions')
          .insert({
            company_id: company_id,
            amount: subscription.value,
            type: 'income',
            category: subscription.description || 'Assinatura Importada',
            due_date: subscription.nextDueDate,
            subscription_cycle: mapAsaasCycle(subscription.cycle),
            asaas_subscription_id: subscription.id,
            asaas_payment_url: subscription.invoiceUrl || null,
            status: subscription.status === 'ACTIVE' ? 'pending' : 'cancelled',
          });

        if (insertError) {
          errors.push(`Erro ao importar ${subscription.id}: ${insertError.message}`);
        } else {
          imported++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Erro ao importar ${subscription.id}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total_found: customerSubscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
