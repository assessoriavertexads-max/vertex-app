import { useState, useMemo, useEffect } from 'react';
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
  Download,
  Pencil,
  Trash2,
  TrendingUp,
  FileDown,
  CalendarDays,
  Send,
  MessageSquare,
  Mail,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { sendTextMessage } from '@/lib/evolution';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NewTransactionModal } from '@/components/finance/NewTransactionModal';
import { EditTransactionModal } from '@/components/finance/EditTransactionModal';
import { CompanyOption, TransactionInsert, TransactionWithCompany } from '@/lib/backend-types';

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

// Normaliza qualquer ciclo para valor mensal equivalente
const MRR_MULTIPLIER: Record<string, number> = {
  MONTHLY: 1,
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  QUARTERLY: 1 / 3,
  SEMIANNUALLY: 1 / 6,
  YEARLY: 1 / 12,
};

const BILLING_TYPE_OPTIONS = [
  { value: 'UNDEFINED', label: 'Cliente escolhe (PIX, Boleto ou Cartão)' },
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto Bancário' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
];

function getSendChannels() {
  try { return JSON.parse(localStorage.getItem('vertex_send_channels') || '{}'); } catch { return {}; }
}

// Modal de envio de cobrança personalizada via WhatsApp e/ou Email
function CustomChargeModal({
  isOpen,
  onClose,
  companies,
}: {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyOption[];
}) {
  const [companyId, setCompanyId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(() => getSendChannels().whatsapp ?? true);
  const [sendEmail, setSendEmail] = useState(() => getSendChannels().email ?? false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ whatsapp?: 'ok' | 'err' | 'skip'; email?: 'ok' | 'skip' } | null>(null);

  const selectedCompany = companies.find(c => c.id === companyId);

  const reset = () => {
    setCompanyId(''); setAmount(''); setDueDate(''); setDescription(''); setMessage(''); setResult(null);
  };
  const handleClose = () => { reset(); onClose(); };

  // Auto-gera template da mensagem quando inputs mudam
  useEffect(() => {
    if (!selectedCompany || !amount || !dueDate) return;
    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(amount));
    const formattedDate = new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR');
    const desc = description.trim() || 'Serviços prestados';
    setMessage(
      `Olá ${selectedCompany.name}! 👋\n\nSegue cobrança referente a: *${desc}*\n\n💰 Valor: *${formattedAmount}*\n📅 Vencimento: *${formattedDate}*\n\nQualquer dúvida, estamos à disposição! 🙂`
    );
  }, [selectedCompany, amount, dueDate, description]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) { toast.error('Selecione a empresa.'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Informe um valor válido.'); return; }
    if (!dueDate) { toast.error('Informe a data de vencimento.'); return; }
    if (!message.trim()) { toast.error('Personalize a mensagem antes de enviar.'); return; }
    if (!sendWhatsApp && !sendEmail) { toast.error('Ative pelo menos um canal de envio.'); return; }

    setIsSending(true);
    const res: { whatsapp?: 'ok' | 'err' | 'skip'; email?: 'ok' | 'skip' } = {};

    try {
      // Registra a transação como pendente
      await supabase.from('financial_transactions').insert({
        company_id: companyId,
        type: 'income',
        amount: parseFloat(amount),
        due_date: dueDate,
        category: description.trim() || 'Cobrança Personalizada',
        status: 'pending',
        subscription_cycle: null,
      });

      // Envia via WhatsApp (Evolution API)
      if (sendWhatsApp) {
        if (selectedCompany?.phone) {
          const phone = selectedCompany.phone.replace(/\D/g, '');
          try {
            await sendTextMessage(phone, message);
            res.whatsapp = 'ok';
          } catch {
            res.whatsapp = 'err';
          }
        } else {
          res.whatsapp = 'skip';
        }
      }

      // Envia via Email (abre cliente de e-mail)
      if (sendEmail) {
        if (selectedCompany?.email) {
          const subject = encodeURIComponent(`Cobrança — ${description.trim() || 'Serviços'}`);
          const body = encodeURIComponent(message);
          window.open(`mailto:${selectedCompany.email}?subject=${subject}&body=${body}`, '_blank');
          res.email = 'ok';
        } else {
          res.email = 'skip';
        }
      }

      setResult(res);
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Tente novamente'}`);
    } finally {
      setIsSending(false);
    }
  };

  const hasPhone = Boolean(selectedCompany?.phone);
  const hasEmail = Boolean(selectedCompany?.email);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-600" /> Enviar Cobrança
          </DialogTitle>
          <DialogDescription>
            Envie a cobrança diretamente ao cliente via WhatsApp ou e-mail.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              {result.whatsapp === 'ok' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> WhatsApp enviado com sucesso!
                </div>
              )}
              {result.whatsapp === 'err' && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <XCircle className="h-4 w-4 shrink-0" /> Falha ao enviar WhatsApp — verifique a conexão.
                </div>
              )}
              {result.whatsapp === 'skip' && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> WhatsApp ignorado — empresa sem telefone cadastrado.
                </div>
              )}
              {result.email === 'ok' && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Cliente de e-mail aberto para envio.
                </div>
              )}
              {result.email === 'skip' && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> E-mail ignorado — empresa sem e-mail cadastrado.
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">A transação foi registrada como pendente no financeiro.</p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSend} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Empresa / Cliente *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                required
              >
                <option value="">Selecione o cliente</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedCompany && (
              <div className="flex gap-2 text-xs">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasPhone ? 'bg-green-50 border-green-200 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                  <MessageSquare className="h-3 w-3" /> {hasPhone ? selectedCompany.phone : 'Sem telefone'}
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasEmail ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-muted border-border text-muted-foreground'}`}>
                  <Mail className="h-3 w-3" /> {hasEmail ? selectedCompany.email : 'Sem e-mail'}
                </span>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: Assessoria de Marketing — Abril/2026"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label>Vencimento *</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
              </div>
            </div>

            {message && (
              <div className="grid gap-2">
                <Label>Mensagem</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="text-xs" />
              </div>
            )}

            {/* Canais de envio */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canais de envio</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span className="text-sm">WhatsApp</span>
                  {!hasPhone && companyId && <span className="text-xs text-muted-foreground">(sem telefone)</span>}
                </div>
                <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} disabled={!hasPhone && Boolean(companyId)} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">E-mail</span>
                  {!hasEmail && companyId && <span className="text-xs text-muted-foreground">(sem e-mail)</span>}
                </div>
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} disabled={!hasEmail && Boolean(companyId)} />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={isSending} className="gap-2">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Cobrança
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const Finance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [isCustomChargeOpen, setIsCustomChargeOpen] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [selectedCompanyForImport, setSelectedCompanyForImport] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithCompany | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCompany[]>({
    queryKey: ['financial_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, companies(name)')
        .is('deleted_at', null)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery<CompanyOption[]>({
    queryKey: ['companies-asaas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Meses disponíveis para filtro
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.due_date + 'T00:00:00');
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const formatMonthLabel = (m: string) => {
    const [year, month] = m.split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // MRR: soma das assinaturas ativas normalizadas para mensal
  const mrr = useMemo(() => {
    const seenSubs = new Set<string>();
    let total = 0;
    transactions
      .filter(t => t.type === 'income' && t.subscription_cycle && t.status !== 'cancelled')
      .forEach(t => {
        if (t.asaas_subscription_id) {
          if (t.asaas_payment_id) return; // pula pagamentos históricos
          if (seenSubs.has(t.asaas_subscription_id)) return;
          seenSubs.add(t.asaas_subscription_id);
        }
        const mult = MRR_MULTIPLIER[t.subscription_cycle!] ?? 1;
        total += Number(t.amount) * mult;
      });
    return total;
  }, [transactions]);

  const totalIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalPending = transactions
    .filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const filteredTransactions = transactions.filter(t => {
    const companyName = t.companies?.name || '';
    const categoryText = t.category || '';
    const matchesSearch = [companyName, categoryText].some(v =>
      v.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesType = filterType === 'all' || t.type === filterType;
    let matchesMonth = true;
    if (filterMonth !== 'all') {
      const d = new Date(t.due_date + 'T00:00:00');
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = m === filterMonth;
    }
    return matchesSearch && matchesType && matchesMonth;
  });

  const createTransaction = useMutation({
    mutationFn: async (data: TransactionInsert) => {
      const { error } = await supabase.from('financial_transactions').insert({
        company_id: data.company_id || null,
        type: data.type,
        amount: data.amount,
        due_date: data.due_date,
        category: data.category || null,
        status: data.status,
        subscription_cycle: data.subscription_cycle,
        billing_type: data.billing_type || 'UNDEFINED',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setIsModalOpen(false);
      toast.success('Transação registrada com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const editTransaction = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionWithCompany> }) => {
      const { error } = await supabase.from('financial_transactions').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setEditingTransaction(null);
      toast.success('Transação atualizada!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id: string) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setDeletingId(null);
      toast.success('Transação excluída.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await supabase.from('financial_transactions').update({ deleted_at: null }).eq('id', id);
            queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
            toast.success('Exclusão desfeita!');
          },
        },
        duration: 6000,
      });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_transactions').update({ status: 'paid' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      toast.success('Marcado como pago!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const importAsaasSubscriptions = useMutation({
    mutationFn: async (company_id: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-import-subscriptions', {
        body: { company_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setShowImportDropdown(false);
      setSelectedCompanyForImport(null);
      const imported = data.imported || 0;
      const updated = data.updated || 0;
      if (imported > 0 || updated > 0) {
        toast.success(`${imported} importada${imported !== 1 ? 's' : ''}, ${updated} atualizada${updated !== 1 ? 's' : ''}.`);
      } else {
        toast.info('Nenhuma assinatura nova encontrada.');
      }
      if (data.errors?.length > 0) toast.error(`Alguns erros: ${data.errors[0]}`);
    },
    onError: (err: Error) => toast.error(`Erro ao importar: ${err.message}`),
  });

  const generateAsaasCharge = useMutation({
    mutationFn: async (transaction: TransactionWithCompany) => {
      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: { transaction_id: transaction.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, transaction) => {
      toast.success(transaction.subscription_cycle ? 'Assinatura criada no Asaas!' : 'Cobrança gerada no Asaas!');
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      if (data.url) window.open(data.url, '_blank');
    },
    onError: (err: Error) => toast.error(`Erro ao gerar cobrança: ${err.message}`),
  });

  const exportCSV = () => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Empresa', 'Descrição', 'Tipo', 'Valor', 'Vencimento', 'Status', 'Ciclo'];
    const rows = filteredTransactions.map(t => [
      t.companies?.name || 'Sem Empresa',
      t.category || '',
      t.type === 'income' ? 'Entrada' : 'Saída',
      Number(t.amount).toFixed(2).replace('.', ','),
      new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR'),
      t.status === 'paid' ? 'Pago' : t.status === 'pending' ? 'Aguardando' : t.status === 'overdue' ? 'Vencido' : 'Cancelado',
      t.subscription_cycle ? (CYCLE_LABELS[t.subscription_cycle] || t.subscription_cycle) : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full"><CheckCircle2 className="w-3 h-3" /> Pago</span>;
      case 'pending':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"><Clock className="w-3 h-3" /> Aguardando</span>;
      case 'overdue':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full"><AlertCircle className="w-3 h-3" /> Vencido</span>;
      case 'cancelled':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">Cancelado</span>;
      default:
        return null;
    }
  };

  // Verifica se um registro é a assinatura em si (próxima cobrança) vs pagamento histórico
  const isSubscriptionRecord = (t: TransactionWithCompany) =>
    !!t.asaas_subscription_id && !t.asaas_payment_id;

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
        <div className="flex flex-wrap gap-2 relative">
          {/* Export CSV */}
          <Button variant="outline" onClick={exportCSV} className="gap-2 text-slate-600">
            <FileDown className="w-4 h-4" /> Exportar CSV
          </Button>

          {/* Importar Assinaturas */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowImportDropdown(!showImportDropdown)}
              className="gap-2 border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Download className="w-4 h-4" /> Importar Assinaturas
            </Button>
            {showImportDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-10">
                <div className="p-2 border-b">
                  <p className="text-xs font-medium text-slate-600 px-2 py-1">Selecione a empresa com Asaas vinculado</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {companies.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">Nenhuma empresa com Asaas vinculada. Cadastre o ID Asaas no perfil da empresa.</div>
                  ) : (
                    companies.map(company => (
                      <button
                        key={company.id}
                        onClick={() => { setSelectedCompanyForImport(company.id); importAsaasSubscriptions.mutate(company.id); }}
                        disabled={importAsaasSubscriptions.isPending}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center justify-between"
                      >
                        <span>{company.name}</span>
                        {importAsaasSubscriptions.isPending && selectedCompanyForImport === company.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
          <Button
            onClick={() => setIsCustomChargeOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Send className="w-4 h-4" /> Cobrança Personalizada
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">Receita Recebida</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ArrowUpRight className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-3">
            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">A Receber</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-3">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">Saídas / Custos</span>
            <div className="p-2 bg-red-50 rounded-lg text-red-600"><ArrowDownRight className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-3">
            R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-slate-500 text-sm font-medium">MRR</span>
            <div className="p-2 bg-violet-50 rounded-lg text-violet-600"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mt-3">
            R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Receita Mensal Recorrente</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
          {/* Filtros de tipo */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg shrink-0">
            {[['all', 'Todas'], ['income', 'Entradas'], ['expense', 'Saídas']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterType === val
                    ? val === 'income' ? 'bg-white shadow text-emerald-600'
                    : val === 'expense' ? 'bg-white shadow text-red-600'
                    : 'bg-white shadow text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Filtro por mês */}
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                className="pl-9 h-9 rounded-md border border-input bg-background pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              >
                <option value="all">Todos os meses</option>
                {monthOptions.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>

            {/* Busca */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-500">Descrição / Cliente</th>
                <th className="px-5 py-4 font-semibold text-slate-500">Vencimento</th>
                <th className="px-5 py-4 font-semibold text-slate-500">Status</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-right">Valor</th>
                <th className="px-5 py-4 font-semibold text-slate-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 max-w-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium text-slate-900">{t.companies?.name || 'Sem Empresa'}</p>
                        {t.subscription_cycle && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                            <RefreshCw className="w-3 h-3" />
                            {CYCLE_LABELS[t.subscription_cycle] ?? t.subscription_cycle}
                          </span>
                        )}
                        {isSubscriptionRecord(t) && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            <CalendarDays className="w-3 h-3" /> Próx. cobrança
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{t.category}</p>
                    </td>

                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                      {new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>

                    <td className="px-5 py-4">{getStatusBadge(t.status)}</td>

                    <td className={`px-5 py-4 text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Marcar como pago */}
                        {t.type === 'income' && (t.status === 'pending' || t.status === 'overdue') && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                            onClick={() => markAsPaid.mutate(t.id)}
                            disabled={markAsPaid.isPending}
                          >
                            {markAsPaid.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Pago
                          </Button>
                        )}

                        {/* Link Asaas */}
                        {t.type === 'income' && t.status !== 'paid' && (
                          t.asaas_payment_url ? (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-blue-600 hover:bg-blue-50 text-xs"
                              onClick={() => window.open(t.asaas_payment_url!, '_blank')}>
                              <LinkIcon className="w-3 h-3" />
                              {t.subscription_cycle ? 'Ver Assinatura' : 'Ver Boleto'}
                            </Button>
                          ) : !t.asaas_payment_id && !t.asaas_subscription_id ? (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-blue-600 hover:bg-blue-50 text-xs"
                              onClick={() => generateAsaasCharge.mutate(t)}
                              disabled={generateAsaasCharge.isPending}>
                              {generateAsaasCharge.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                              {t.subscription_cycle ? 'Criar Assinatura' : 'Gerar Cobrança'}
                            </Button>
                          ) : null
                        )}

                        {/* Editar */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          onClick={() => setEditingTransaction(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        {/* Excluir */}
                        {deletingId === t.id ? (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => deleteTransaction.mutate(t.id)}
                              disabled={deleteTransaction.isPending}>
                              {deleteTransaction.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500"
                              onClick={() => setDeletingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => setDeletingId(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length > 0 && (
          <div className="px-5 py-3 border-t bg-slate-50/50 text-xs text-slate-400">
            {filteredTransactions.length} registro{filteredTransactions.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultType={modalType}
        onSave={data => createTransaction.mutate(data)}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={(id, data) => editTransaction.mutate({ id, data })}
      />

      <CustomChargeModal
        isOpen={isCustomChargeOpen}
        onClose={() => setIsCustomChargeOpen(false)}
        companies={companies}
      />
    </div>
  );
};

export default Finance;
