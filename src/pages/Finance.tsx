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
  ChevronDown,
  RefreshCcw,
  ReceiptText,
  Eye,
  EyeOff,
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
import { runAutomations } from '@/lib/automation';

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

// Separa tag de categoria do nome da saída (formato "Tag • Nome")
function parseExpenseCategory(category: string | null): { tag: string | null; name: string } {
  if (!category) return { tag: null, name: 'Sem nome' };
  const idx = category.indexOf(' • ');
  if (idx !== -1) return { tag: category.slice(0, idx), name: category.slice(idx + 3) };
  return { tag: null, name: category };
}

// Calcula próxima data de vencimento baseada no ciclo
function nextDueDate(currentDate: string, cycle: string): string {
  const d = new Date(currentDate + 'T00:00:00');
  switch (cycle) {
    case 'WEEKLY':       d.setDate(d.getDate() + 7); break;
    case 'BIWEEKLY':     d.setDate(d.getDate() + 14); break;
    case 'MONTHLY':      d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY':    d.setMonth(d.getMonth() + 3); break;
    case 'SEMIANNUALLY': d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY':       d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

// Normaliza qualquer ciclo para valor mensal equivalente
const MRR_MULTIPLIER: Record<string, number> = {
  MONTHLY: 1,
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  QUARTERLY: 1 / 3,
  SEMIANNUALLY: 1 / 6,
  YEARLY: 1 / 12,
};


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
          const rawPhone = selectedCompany.phone.replace(/\D/g, '');
          const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
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
            <Send className="h-4 w-4 text-emerald-600" /> Enviar Cobrança
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
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
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
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasPhone ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                  <MessageSquare className="h-3 w-3" /> {hasPhone ? selectedCompany.phone : 'Sem telefone'}
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasEmail ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
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
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm">WhatsApp</span>
                  {!hasPhone && companyId && <span className="text-xs text-muted-foreground">(sem telefone)</span>}
                </div>
                <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} disabled={!hasPhone && Boolean(companyId)} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-500" />
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

// Retorna "YYYY-MM" do mês atual
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Ordem de status para ordenação: vencidos → pendentes → pagos → cancelados
const STATUS_SORT: Record<string, number> = { overdue: 0, pending: 1, paid: 2, cancelled: 3 };

export const Finance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(currentMonthKey);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [isCustomChargeOpen, setIsCustomChargeOpen] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [selectedCompanyForImport, setSelectedCompanyForImport] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [importMode, setImportMode] = useState<'all' | 'subscriptions' | 'charges'>('all');
  const [hideValues, setHideValues] = useState(false);

  const fmtVal = (value: number) =>
    hideValues ? '••••' : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithCompany | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingChargeId, setGeneratingChargeId] = useState<string | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Realtime: qualquer INSERT/UPDATE em financial_transactions recarrega a lista
  useEffect(() => {
    const channel = supabase
      .channel('finance-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCompany[]>({
    queryKey: ['financial_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, companies(name, phone)')
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

  // Transações filtradas só pelo mês (sem tipo/busca) — usadas nos cards de resumo
  const cardTransactions = useMemo(() => {
    if (filterMonth === 'all') return transactions;
    return transactions.filter(t => {
      const d = new Date(t.due_date + 'T00:00:00');
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return m === filterMonth;
    });
  }, [transactions, filterMonth]);

  // MRR: sempre baseado em todas as assinaturas ativas (métrica atual, não por mês)
  const mrr = useMemo(() => {
    const seenSubs = new Set<string>();
    let total = 0;
    transactions
      .filter(t => t.type === 'income' && t.subscription_cycle && t.status !== 'cancelled')
      .forEach(t => {
        if (t.asaas_subscription_id) {
          if (t.asaas_payment_id) return;
          if (seenSubs.has(t.asaas_subscription_id)) return;
          seenSubs.add(t.asaas_subscription_id);
        }
        const mult = MRR_MULTIPLIER[t.subscription_cycle!] ?? 1;
        total += Number(t.amount) * mult;
      });
    return total;
  }, [transactions]);

  const totalIncome = cardTransactions
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalPending = cardTransactions
    .filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpense = cardTransactions
    .filter(t => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpensePending = cardTransactions
    .filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue'))
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

  // Ordenação: vencidos → pendentes (data asc) → pagos (data desc) → cancelados
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const sa = STATUS_SORT[a.status] ?? 4;
      const sb = STATUS_SORT[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      const ta = new Date(a.due_date).getTime();
      const tb = new Date(b.due_date).getTime();
      // Pendentes/vencidos: vencimento mais próximo primeiro
      // Pagos/cancelados: mais recente primeiro
      return a.status === 'paid' || a.status === 'cancelled' ? tb - ta : ta - tb;
    });
  }, [filteredTransactions]);

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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setIsModalOpen(false);
      toast.success('Transação registrada com sucesso!');
      if (data.type === 'income') {
        runAutomations('new_transaction_created', 'any', {
          entityTitle: data.category || 'Transação',
          companyId: data.company_id || null,
          amount: data.amount ?? null,
          dueDate: data.due_date ?? null,
          paymentLink: null,
        }).catch(() => {});
      }
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
      const { data: tx } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (!tx) return null;

      // Auto-cria próximo vencimento para saídas recorrentes
      if (tx.type === 'expense' && tx.subscription_cycle && tx.due_date) {
        const next = nextDueDate(tx.due_date, tx.subscription_cycle);
        const { data: existing } = await supabase
          .from('financial_transactions')
          .select('id')
          .eq('type', 'expense')
          .eq('category', tx.category)
          .eq('due_date', next)
          .is('deleted_at', null)
          .maybeSingle();
        if (!existing) {
          await supabase.from('financial_transactions').insert({
            type: 'expense',
            amount: tx.amount,
            due_date: next,
            category: tx.category,
            company_id: tx.company_id,
            status: 'pending',
            subscription_cycle: tx.subscription_cycle,
            billing_type: tx.billing_type,
          });
        }
      }

      return tx as {
        type: string;
        category: string | null;
        company_id: string | null;
        amount: number | null;
        due_date: string | null;
        asaas_payment_url: string | null;
        subscription_cycle: string | null;
      };
    },
    onSuccess: (tx) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      if (tx?.type === 'expense' && tx.subscription_cycle && tx.due_date) {
        const next = nextDueDate(tx.due_date, tx.subscription_cycle);
        const formatted = new Date(next + 'T00:00:00').toLocaleDateString('pt-BR');
        toast.success(`Pago! Próximo vencimento criado para ${formatted}.`);
      } else {
        toast.success('Marcado como pago!');
      }
      if (tx?.type === 'income') {
        runAutomations('transaction_paid', 'any', {
          entityTitle: tx?.category || 'Pagamento',
          companyId: tx?.company_id ?? null,
          amount: tx?.amount ?? null,
          dueDate: tx?.due_date ?? null,
          paymentLink: tx?.asaas_payment_url ?? null,
        }).catch(() => {});
      }
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const importAsaasSubscriptions = useMutation({
    mutationFn: async ({ companyId, mode }: { companyId: string | '__all__'; mode: 'all' | 'subscriptions' | 'charges' }) => {
      const body = companyId === '__all__' ? { all: true, mode } : { company_id: companyId, mode };
      const { data, error } = await supabase.functions.invoke('asaas-import-subscriptions', { body });
      if (error) {
        // Tenta extrair mensagem real do corpo da resposta HTTP
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const errBody = await ctx.clone().json();
            if (errBody?.error) throw new Error(errBody.error);
          } catch (e) {
            if (e instanceof Error && e !== error) throw e;
          }
        }
        throw new Error((error as Error).message ?? 'Erro desconhecido');
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      setShowImportDropdown(false);
      setSelectedCompanyForImport(null);
      setImportingAll(false);
      const imported = data.imported || 0;
      const updated  = data.updated  || 0;
      const skipped  = data.skipped  || 0;
      if (imported > 0 || updated > 0) {
        const parts = [];
        if (imported > 0) parts.push(`${imported} importado${imported !== 1 ? 's' : ''}`);
        if (updated  > 0) parts.push(`${updated} atualizado${updated !== 1 ? 's' : ''}`);
        if (skipped  > 0) parts.push(`${skipped} não encontrado${skipped !== 1 ? 's' : ''} no Asaas`);
        toast.success(parts.join(', ') + '.');
      } else if (skipped > 0) {
        toast.info(`Nenhum dado novo. ${skipped} empresa${skipped !== 1 ? 's' : ''} não cadastrada${skipped !== 1 ? 's' : ''} no Asaas.`);
      } else {
        toast.info('Nenhum registro novo encontrado.');
      }
      if (data.errors?.length > 0) toast.error(`Alguns erros: ${data.errors[0]}`);
    },
    onError: (err: Error) => { setImportingAll(false); toast.error(err.message); },
  });

  const generateAsaasCharge = useMutation({
    mutationFn: async (transaction: TransactionWithCompany) => {
      setGeneratingChargeId(transaction.id);
      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: { transaction_id: transaction.id },
      });
      if (error) {
        const msg = (error as { context?: { error?: string } })?.context?.error
          ?? (error as { message?: string })?.message
          ?? 'Erro ao conectar com a função';
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, transaction) => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
      const isSubscription = !!transaction.subscription_cycle;
      const rawPhone = transaction.companies?.phone?.replace(/\D/g, '') ?? '';
      const phone = rawPhone ? (rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`) : null;
      const paymentUrl = data.url as string | null;

      toast.success(isSubscription ? 'Assinatura criada no Asaas!' : 'Cobrança gerada no Asaas!', {
        action: paymentUrl ? {
          label: 'Ver link',
          onClick: () => window.open(paymentUrl, '_blank'),
        } : undefined,
      });

      if (paymentUrl && phone) {
        const amount = Number(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const dueDate = new Date(transaction.due_date + 'T00:00:00').toLocaleDateString('pt-BR');
        const desc = transaction.category || (isSubscription ? 'Assinatura' : 'Cobrança');
        const msg = `Olá *${transaction.companies?.name}*! 👋\n\nSua ${isSubscription ? 'assinatura foi criada' : 'cobrança foi gerada'}!\n\n📋 *${desc}*\n💰 *R$ ${amount}*\n📅 *Vencimento: ${dueDate}*\n\nClique para pagar:\n${paymentUrl}\n\nQualquer dúvida, estamos à disposição! 🙏`;

        toast('Enviar link via WhatsApp?', {
          description: `Para ${transaction.companies?.name} (${transaction.companies?.phone})`,
          action: {
            label: 'Enviar',
            onClick: () => sendTextMessage(phone, msg).then(() => toast.success('Mensagem enviada!')).catch(() => toast.error('Falha ao enviar WhatsApp')),
          },
          duration: 8000,
        });
      }
    },
    onError: (err: Error) => toast.error(`Erro ao gerar cobrança: ${err.message}`),
    onSettled: () => setGeneratingChargeId(null),
  });

  const sendPaymentWhatsApp = async (t: TransactionWithCompany) => {
    const raw = t.companies?.phone?.replace(/\D/g, '') ?? '';
    if (!raw) return;
    // Garante código do país 55 (Brasil)
    const phone = raw.startsWith('55') ? raw : `55${raw}`;
    setSendingWhatsAppId(t.id);
    try {
      const amount = Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const dueDate = new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR');
      const desc = t.category || (t.subscription_cycle ? 'Assinatura' : 'Cobrança');
      const linkLine = t.asaas_payment_url ? `\n\nClique para pagar:\n${t.asaas_payment_url}` : '';
      const msg = `Olá *${t.companies?.name}*! 👋\n\nSegue o lembrete de cobrança:\n\n📋 *${desc}*\n💰 *R$ ${amount}*\n📅 *Vencimento: ${dueDate}*${linkLine}\n\nQualquer dúvida, estamos à disposição! 🙏`;
      await sendTextMessage(phone, msg);
      toast.success('Mensagem enviada via WhatsApp!');
    } catch (err) {
      toast.error(`Falha ao enviar via WhatsApp: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setSendingWhatsAppId(null);
    }
  };

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
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"><CheckCircle2 className="w-3 h-3" /> Pago</span>;
      case 'pending':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"><Clock className="w-3 h-3" /> Aguardando</span>;
      case 'overdue':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full"><AlertCircle className="w-3 h-3" /> Vencido</span>;
      case 'cancelled':
        return <span className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">Cancelado</span>;
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Gestão de caixa da Vertos.</p>
        </div>
        <div className="flex flex-wrap gap-2 relative">
          {/* Ocultar/exibir valores */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setHideValues(v => !v)}
            title={hideValues ? 'Exibir valores' : 'Ocultar valores'}
            className="text-muted-foreground"
          >
            {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>

          {/* Export CSV */}
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <FileDown className="w-4 h-4" /> Exportar CSV
          </Button>

          {/* Importar do Asaas */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowImportDropdown(!showImportDropdown)}
              className="gap-2 border-primary/20 text-primary hover:text-primary hover:bg-primary/10"
            >
              <Download className="w-4 h-4" /> Importar <ChevronDown className="w-3 h-3" />
            </Button>
            {showImportDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-10">
                {/* Seletor de tipo */}
                <div className="p-3 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">O que importar:</p>
                  <div className="flex gap-1">
                    {([
                      { value: 'subscriptions', label: 'Assinaturas', icon: RefreshCcw },
                      { value: 'charges',       label: 'Cobranças',   icon: ReceiptText },
                      { value: 'all',           label: 'Tudo',        icon: Download },
                    ] as const).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setImportMode(value)}
                        className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-colors border ${
                          importMode === value
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'border-transparent text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Todas as empresas */}
                <div className="p-2 border-b border-border">
                  <button
                    onClick={() => { setImportingAll(true); importAsaasSubscriptions.mutate({ companyId: '__all__', mode: importMode }); }}
                    disabled={importAsaasSubscriptions.isPending}
                    className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                  >
                    <span>Todas as Empresas</span>
                    {importAsaasSubscriptions.isPending && importingAll
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </button>
                  <p className="text-xs text-muted-foreground px-2 pt-1">ou selecione uma empresa:</p>
                </div>
                {/* Lista de empresas com CPF/CNPJ */}
                <div className="max-h-48 overflow-y-auto">
                  {companies.filter(c => c.document).length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Nenhuma empresa com CPF/CNPJ cadastrado.</div>
                  ) : (
                    companies.filter(c => c.document).map(company => (
                      <button
                        key={company.id}
                        onClick={() => { setSelectedCompanyForImport(company.id); importAsaasSubscriptions.mutate({ companyId: company.id, mode: importMode }); }}
                        disabled={importAsaasSubscriptions.isPending}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50 flex items-center justify-between text-foreground"
                      >
                        <span>{company.name}</span>
                        {importAsaasSubscriptions.isPending && selectedCompanyForImport === company.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <CreditCard className="w-4 h-4" /> Nova Entrada / Cobrar
          </Button>
          <Button
            onClick={() => setIsCustomChargeOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Send className="w-4 h-4" /> Cobrança Personalizada
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      {filterMonth !== 'all' && (
        <p className="text-xs text-muted-foreground -mb-2">
          Exibindo dados de <span className="font-medium text-foreground">{formatMonthLabel(filterMonth)}</span>
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground text-sm font-medium">Receita Recebida</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><ArrowUpRight className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-3">{fmtVal(totalIncome)}</h2>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground text-sm font-medium">A Receber</span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-3">{fmtVal(totalPending)}</h2>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground text-sm font-medium">Saídas / Custos</span>
            <div className="p-2 bg-red-500/10 rounded-lg text-red-600"><ArrowDownRight className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-3">{fmtVal(totalExpense)}</h2>
          {totalExpensePending > 0 && (
            <p className="text-xs text-amber-600 mt-1">+ {fmtVal(totalExpensePending)} a pagar</p>
          )}
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground text-sm font-medium">MRR</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-3">{fmtVal(mrr)}</h2>
          <p className="text-xs text-muted-foreground mt-1">Receita Mensal Recorrente</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-3 bg-muted/30">
          {/* Filtros de tipo */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg shrink-0">
            {[['all', 'Todas'], ['income', 'Entradas'], ['expense', 'Saídas']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterType === val
                    ? val === 'income' ? 'bg-card shadow text-emerald-600'
                    : val === 'expense' ? 'bg-card shadow text-red-600'
                    : 'bg-card shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Filtro por mês */}
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-5 py-4 font-semibold text-muted-foreground">Descrição / Cliente</th>
                <th className="px-5 py-4 font-semibold text-muted-foreground">Vencimento</th>
                <th className="px-5 py-4 font-semibold text-muted-foreground">Status</th>
                <th className="px-5 py-4 font-semibold text-muted-foreground text-right">Valor</th>
                <th className="px-5 py-4 font-semibold text-muted-foreground text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 max-w-xs">
                      {t.type === 'expense' ? (() => {
                        const { tag, name } = parseExpenseCategory(t.category);
                        return (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-medium text-foreground">{name}</p>
                              {tag && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                  {tag}
                                </span>
                              )}
                              {t.subscription_cycle && (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                  <RefreshCw className="w-3 h-3" />
                                  {CYCLE_LABELS[t.subscription_cycle] ?? t.subscription_cycle}
                                </span>
                              )}
                            </div>
                            {t.companies?.name && (
                              <p className="text-muted-foreground text-xs mt-0.5">{t.companies.name}</p>
                            )}
                          </>
                        );
                      })() : (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-medium text-foreground">{t.companies?.name || 'Sem Empresa'}</p>
                            {t.subscription_cycle && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                <RefreshCw className="w-3 h-3" />
                                {CYCLE_LABELS[t.subscription_cycle] ?? t.subscription_cycle}
                              </span>
                            )}
                            {isSubscriptionRecord(t) && (
                              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                <CalendarDays className="w-3 h-3" /> Próx. cobrança
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{t.category}</p>
                        </>
                      )}
                    </td>

                    <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                      {new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>

                    <td className="px-5 py-4">{getStatusBadge(t.status)}</td>

                    <td className={`px-5 py-4 text-right font-medium whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {hideValues ? '••••' : `${t.type === 'income' ? '+' : '-'} R$ ${Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Marcar como pago — entradas e saídas */}
                        {(t.status === 'pending' || t.status === 'overdue') && (
                          <Button
                            variant="ghost" size="sm"
                            className={`h-8 gap-1 text-xs ${
                              t.type === 'income'
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
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
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:bg-primary/10 text-xs"
                              onClick={() => window.open(t.asaas_payment_url!, '_blank')}>
                              <LinkIcon className="w-3 h-3" />
                              {t.subscription_cycle ? 'Ver Assinatura' : 'Ver Boleto'}
                            </Button>
                          ) : !t.asaas_payment_id && !t.asaas_subscription_id ? (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:bg-primary/10 text-xs"
                              onClick={() => generateAsaasCharge.mutate(t)}
                              disabled={generatingChargeId === t.id}>
                              {generatingChargeId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                              {t.subscription_cycle ? 'Criar Assinatura' : 'Gerar Cobrança'}
                            </Button>
                          ) : null
                        )}

                        {/* Enviar via WhatsApp — disponível para qualquer entrada pendente com telefone */}
                        {t.type === 'income' && (t.status === 'pending' || t.status === 'overdue') && t.companies?.phone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                            title="Enviar cobrança via WhatsApp"
                            onClick={() => sendPaymentWhatsApp(t)}
                            disabled={sendingWhatsAppId === t.id}>
                            {sendingWhatsAppId === t.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <MessageSquare className="w-3.5 h-3.5" />}
                          </Button>
                        )}

                        {/* Editar */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                              onClick={() => setDeletingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
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

        {sortedTransactions.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            {sortedTransactions.length} registro{sortedTransactions.length !== 1 ? 's' : ''}
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
