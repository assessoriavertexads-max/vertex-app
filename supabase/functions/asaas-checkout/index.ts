import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// A sua chave da API do Asaas (Sandbox para testes ou Produção)
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
if (!ASAAS_API_KEY) {
  throw new Error('Variável de ambiente ASAAS_API_KEY não configurada no Supabase.');
}
const ASAAS_URL = 'https://sandbox.asaas.com/api/v3/payments'; // Use sandbox.asaas para testar sem gastar dinheiro

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com a requisição CORS do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transaction_id, amount, description } = await req.json();

    // 1. Cria a cobrança no Asaas
    const asaasResponse = await fetch(ASAAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify({
        customer: 'cus_000005030805', // ID DE TESTE (No futuro, você busca o ID real do cliente)
        billingType: 'UNDEFINED', // Deixa o cliente escolher PIX, Boleto ou Cartão
        value: amount,
        dueDate: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString().split('T')[0], // Vence em 3 dias
        description: description,
      })
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) throw new Error(asaasData.errors?.[0]?.description || 'Erro no Asaas');

    // 2. Salva o link do pagamento gerado no nosso banco de dados (Supabase)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('financial_transactions')
      .update({
        asaas_payment_id: asaasData.id,
        asaas_payment_url: asaasData.invoiceUrl
      })
      .eq('id', transaction_id);

    // 3. Devolve o link de pagamento para a nossa tela do React!
    return new Response(JSON.stringify({ url: asaasData.invoiceUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/asaas-checkout' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
