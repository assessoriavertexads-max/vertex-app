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

// Busca um cliente no Asaas pelo CPF/CNPJ. Se não existir, cria um novo.
async function findOrCreateAsaasCustomer(company: { name: string; document: string | null }): Promise<string> {
  const cpfCnpj = company.document ? company.document.replace(/\D/g, '') : null;

  if (cpfCnpj) {
    const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpfCnpj}`, {
      headers: asaasHeaders,
    });
    const searchData = await searchRes.json();
    if (searchData.data?.length > 0) {
      return searchData.data[0].id;
    }
  }

  // Cliente não encontrado — cria no Asaas
  const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify({
      name: company.name,
      ...(cpfCnpj ? { cpfCnpj } : {}),
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
  }
  return createData.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transaction_id } = await req.json();

    if (!transaction_id) throw new Error('transaction_id é obrigatório.');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Busca transação + dados da empresa vinculada
    const { data: transaction, error: txError } = await supabaseClient
      .from('financial_transactions')
      .select('*, companies(name, document)')
      .eq('id', transaction_id)
      .single();

    if (txError || !transaction) throw new Error('Transação não encontrada.');
    if (!transaction.companies) throw new Error('Nenhuma empresa vinculada a esta transação.');

    // 2. Busca ou cria o cliente no Asaas usando o CNPJ da empresa
    const asaasCustomerId = await findOrCreateAsaasCustomer(transaction.companies as { name: string; document: string | null });

    // 3. Usa a data de vencimento da transação (ou +3 dias se não houver)
    const dueDate = transaction.due_date
      ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 4. Cria a cobrança no Asaas (cliente escolhe PIX, Boleto ou Cartão)
    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        value: Number(transaction.amount),
        dueDate,
        description: transaction.category || 'Cobrança Vertex',
      }),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      throw new Error(paymentData.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas');
    }

    // 5. Salva o ID e URL do pagamento no Supabase
    await supabaseClient
      .from('financial_transactions')
      .update({
        asaas_payment_id: paymentData.id,
        asaas_payment_url: paymentData.invoiceUrl,
      })
      .eq('id', transaction_id);

    return new Response(
      JSON.stringify({ url: paymentData.invoiceUrl, payment_id: paymentData.id }),
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
