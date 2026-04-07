import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Search,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NewTransactionModal } from '@/components/finance/NewTransactionModal';

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

export const Finance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['financial_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, companies(name)')
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTransaction = useMutation({
    mutationFn: async (data: {
      company_id: string;
      type: 'income' | 'expense';
      amount: number;
      due_date: string;
      category: string;
      status: string;
      subscription_cycle: string | null;
    }) => {
      const { error } = await supabase.from('financial_transactions').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setIsModalOpen(false);
      toast.success('Transação registrada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar transação: ${err.message}`);
    },
  });

  // Gera cobrança única OU assinatura recorrente no Asaas
  const generateAsaasCharge = useMutation({
    mutationFn: async (transaction: any) => {
      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: { transaction_id: transaction.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, transaction) => {
      const isSubscription = !!transaction.subscription_cycle;
      toast.success(
        isSubscription
          ? 'Assinatura criada com sucesso no Asaas!'
          : 'Cobrança gerada com sucesso no Asaas!'
      );
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      if (data.url) window.open(data.url, '_blank');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar cobrança: ${err.message}`);
    },
  });

  const totalIncome = transactions
    .filter((t: any) => t.type === 'income' && t.status === 'paid')
    .reduce((acc: number, t: any) => acc + Number(t.amount), 0);

  const totalPending = transactions
    .filter((t: any) => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc: number, t: any) => acc + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((acc: number, t: any) => acc + Number(t.amount), 0);

  const filteredTransactions = transactions.filter((t: any) => {
    const companyName = t.companies?.name || '';
    const matchesSearch = companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Pago
          </span>
        );
      case 'pending':
        return (
          <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
            <Clock className="w-3 h-3" /> Aguardando
          </span>
        );
      case 'overdue':
        return (
          <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <AlertCircle className="w-3 h-3" /> Vencido
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Financeiro</h1>
          <p className="text-slate-500 mt-1">Gestão de caixa da Vertex.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setModalType('expense'); setIsModalOpen(true); }}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <ArrowDownRight className="w-4 h-4" /> Nova Saída
          </Button>
          <Button
            onClick={() => { setModalType('income'); setIsModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <CreditCard className="w-4 h-4" /> Nova Entrada / Cobrar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 font-medium">Receita Recebida</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mt-4">
            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 font-medium">A Receber</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mt-4">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 font-medium">Saídas / Custos</span>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mt-4">
            R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === 'expense' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Saídas
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar empresa..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500">Descrição / Cliente</th>
                <th className="px-6 py-4 font-semibold text-slate-500">Vencimento</th>
                <th className="px-6 py-4 font-semibold text-slate-500">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-right">Valor</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{t.companies?.name || 'Sem Empresa'}</p>
                        {t.subscription_cycle && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                            <RefreshCw className="w-3 h-3" />
                            {CYCLE_LABELS[t.subscription_cycle] ?? t.subscription_cycle}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{t.category}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(t.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                    <td className={`px-6 py-4 text-right font-medium ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.type === 'income' && t.status !== 'paid' && (
                        t.asaas_payment_url || t.asaas_subscription_id ? (
                          t.asaas_payment_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => window.open(t.asaas_payment_url, '_blank')}
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              {t.subscription_cycle ? 'Ver Assinatura' : 'Ver Boleto'}
                            </Button>
                          ) : (
                            <span className="text-xs text-violet-600 font-medium flex items-center gap-1 justify-end">
                              <RefreshCw className="w-3 h-3" /> Assinatura ativa
                            </span>
                          )
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => generateAsaasCharge.mutate(t)}
                            disabled={generateAsaasCharge.isPending}
                          >
                            {generateAsaasCharge.isPending
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : t.subscription_cycle
                                ? <RefreshCw className="w-3.5 h-3.5" />
                                : <LinkIcon className="w-3.5 h-3.5" />
                            }
                            {t.subscription_cycle ? 'Criar Assinatura' : 'Gerar Cobrança'}
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultType={modalType}
        onSave={(data) => createTransaction.mutate(data)}
      />
    </div>
  );
};

export default Finance;
