import { supabase } from './supabase';

interface AIResult {
  text?: string;
  error?: string;
}

export async function askAI(prompt: string, context?: string): Promise<string> {
  const invokePromise = supabase.functions.invoke<AIResult>('ai-assistant', {
    body: { prompt, context },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: IA não respondeu em 60s')), 60_000)
  );

  const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.text) throw new Error('Resposta vazia da IA');
  return data.text;
}

export function buildBusinessContext(params: {
  transactions: Array<{ type: string; status: string; amount: number; due_date?: string; category?: string | null; companies?: { name: string } | null }>;
  leads: Array<{ funnel_stage?: string | null; estimated_value?: number | null; companies?: { name: string } | null }>;
  tasks: Array<{ status: string; due_date?: string | null }>;
  companies: Array<{ name: string }>;
}): string {
  const { transactions, leads, tasks, companies } = params;
  const today = new Date().toISOString().split('T')[0];
  const monthKey = today.substring(0, 7);

  const paidIncome    = transactions.filter(t => t.type === 'income'  && t.status === 'paid');
  const paidExpenses  = transactions.filter(t => t.type === 'expense' && t.status === 'paid');
  const pendingIncome = transactions.filter(t => t.type === 'income'  && t.status === 'pending');

  const totalRecebido  = paidIncome.filter(t => (t.due_date ?? '').startsWith(monthKey)).reduce((a, t) => a + Number(t.amount), 0);
  const totalDespesas  = paidExpenses.filter(t => (t.due_date ?? '').startsWith(monthKey)).reduce((a, t) => a + Number(t.amount), 0);
  const totalPendente  = pendingIncome.reduce((a, t) => a + Number(t.amount), 0);
  const totalAtrasado  = pendingIncome.filter(t => (t.due_date ?? '') < today).reduce((a, t) => a + Number(t.amount), 0);

  const activeLeads   = leads.filter(l => !['closed', 'lost'].includes(l.funnel_stage ?? ''));
  const pipelineValue = activeLeads.reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);

  const stageCount = leads.reduce<Record<string, number>>((acc, l) => {
    const s = l.funnel_stage ?? 'sem etapa';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const pendingTasks  = tasks.filter(t => t.status !== 'concluido').length;
  const overdueTasks  = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'concluido').length;

  return `
Mês atual: ${monthKey}
Clientes ativos: ${companies.length}

FINANCEIRO
- Receita recebida no mês: R$ ${totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Despesas pagas no mês: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Lucro líquido no mês: R$ ${(totalRecebido - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- A receber (pendente): R$ ${totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Em atraso: R$ ${totalAtrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

CRM
- Total de leads: ${leads.length}
- Leads no pipeline ativo: ${activeLeads.length}
- Valor do pipeline: R$ ${pipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Por etapa: ${Object.entries(stageCount).map(([k, v]) => `${k} (${v})`).join(', ')}

TAREFAS
- Pendentes: ${pendingTasks} | Em atraso: ${overdueTasks}
`.trim();
}
