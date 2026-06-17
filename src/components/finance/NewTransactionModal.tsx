import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyOption } from '@/lib/backend-types';
import { RefreshCw } from 'lucide-react';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    company_id?: string | null;
    type: 'income' | 'expense';
    amount: number;
    due_date: string;
    category?: string | null;
    status: string;
    subscription_cycle: string | null;
    billing_type?: string;
  }) => void;
  defaultType: 'income' | 'expense';
}

const CYCLE_OPTIONS = [
  { value: 'MONTHLY',      label: 'Mensal' },
  { value: 'WEEKLY',       label: 'Semanal' },
  { value: 'BIWEEKLY',     label: 'Quinzenal' },
  { value: 'QUARTERLY',    label: 'Trimestral' },
  { value: 'SEMIANNUALLY', label: 'Semestral' },
  { value: 'YEARLY',       label: 'Anual' },
];

const BILLING_TYPE_OPTIONS = [
  { value: 'UNDEFINED',    label: 'Cliente escolhe (PIX, Boleto ou Cartão)' },
  { value: 'PIX',          label: 'PIX' },
  { value: 'BOLETO',       label: 'Boleto Bancário' },
  { value: 'CREDIT_CARD',  label: 'Cartão de Crédito' },
];

const EXPENSE_CATEGORIES = [
  { value: 'Software',    emoji: '💻' },
  { value: 'Aluguel',     emoji: '🏠' },
  { value: 'Salário',     emoji: '👥' },
  { value: 'Marketing',   emoji: '📣' },
  { value: 'Impostos',    emoji: '🧾' },
  { value: 'Fornecedor',  emoji: '🚚' },
  { value: 'Serviço',     emoji: '🔧' },
  { value: 'Estoque',     emoji: '📦' },
  { value: 'Outros',      emoji: '💸' },
];

export const NewTransactionModal = ({ isOpen, onClose, onSave, defaultType }: NewTransactionModalProps) => {
  const [type, setType]                   = useState<'income' | 'expense'>(defaultType);
  const [companyId, setCompanyId]         = useState('');
  const [amount, setAmount]               = useState('');
  const [dueDate, setDueDate]             = useState('');
  const [description, setDescription]     = useState('');
  const [expenseTag, setExpenseTag]       = useState('');
  const [isRecurring, setIsRecurring]     = useState(false);
  const [cycle, setCycle]                 = useState('MONTHLY');
  const [billingType, setBillingType]     = useState('UNDEFINED');

  useEffect(() => {
    setType(defaultType);
    setDescription('');
    setCompanyId('');
    setAmount('');
    setDueDate('');
    setIsRecurring(false);
    setCycle('MONTHLY');
    setBillingType('UNDEFINED');
    setExpenseTag('');
  }, [defaultType, isOpen]);

  const { data: companies = [], isLoading } = useQuery<CompanyOption[]>({
    queryKey: ['companies-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'income' && !companyId) {
      alert('Selecione um cliente/empresa para entradas.');
      return;
    }

    const categoryValue =
      type === 'expense'
        ? expenseTag && description
          ? `${expenseTag} • ${description}`
          : description || expenseTag || null
        : description || null;

    onSave({
      company_id: companyId || null,
      type,
      amount: parseFloat(amount) || 0,
      due_date: dueDate,
      category: categoryValue,
      status: 'pending',
      subscription_cycle: isRecurring ? cycle : null,
      billing_type: type === 'income' ? billingType : undefined,
    });

    setCompanyId('');
    setAmount('');
    setDueDate('');
    setDescription('');
    setExpenseTag('');
    setIsRecurring(false);
    setCycle('MONTHLY');
    onClose();
  };

  const recurringToggle = (
    accentClass: string,
    trackColor: string,
    activeLabel: string,
    inactiveLabel: string,
    activeDesc: string,
    inactiveDesc: string,
  ) => (
    <button
      type="button"
      onClick={() => setIsRecurring(v => !v)}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
        isRecurring ? accentClass : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}
    >
      <RefreshCw className={`w-4 h-4 shrink-0 ${isRecurring ? '' : 'text-slate-400'}`} />
      <div className="text-left">
        <p className="font-semibold">{isRecurring ? activeLabel : inactiveLabel}</p>
        <p className="text-xs font-normal opacity-70">{isRecurring ? activeDesc : inactiveDesc}</p>
      </div>
      <div className={`ml-auto w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${isRecurring ? trackColor : 'bg-slate-200'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
            {type === 'income' ? '💰 Registrar Nova Entrada' : '💸 Registrar Nova Saída'}
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes do {type === 'income' ? 'recebimento' : 'pagamento'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">

          {/* ── SAÍDA ─────────────────────────────── */}
          {type === 'expense' && (
            <>
              {/* Categoria / tag */}
              <div className="grid gap-2">
                <Label>Categoria <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setExpenseTag(expenseTag === cat.value ? '' : cat.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        expenseTag === cat.value
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-background border-border text-muted-foreground hover:border-red-300 hover:text-red-600'
                      }`}
                    >
                      {cat.emoji} {cat.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome da saída */}
              <div className="grid gap-2">
                <Label htmlFor="expense-name">Nome da Saída *</Label>
                <Input
                  id="expense-name"
                  placeholder="Ex: Notion, Aluguel escritório, Servidor AWS…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Empresa/Fornecedor (opcional) */}
              <div className="grid gap-2">
                <Label>
                  Fornecedor / Empresa{' '}
                  <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                >
                  <option value="">{isLoading ? 'Carregando…' : 'Nenhuma empresa'}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="expense-amount">Valor (R$) *</Label>
                  <Input
                    id="expense-amount"
                    type="number" step="0.01" placeholder="0.00"
                    value={amount} onChange={e => setAmount(e.target.value)} required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-date">
                    {isRecurring ? 'Primeiro Vencimento *' : 'Data de Vencimento *'}
                  </Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={dueDate} onChange={e => setDueDate(e.target.value)} required
                  />
                </div>
              </div>

              {/* Toggle recorrência */}
              <div className="grid gap-3">
                {recurringToggle(
                  'border-red-400 bg-red-50 text-red-700',
                  'bg-red-500',
                  'Saída Recorrente',
                  'Saída Única',
                  'Próximo vencimento criado automaticamente ao pagar',
                  'Clique para ativar recorrência',
                )}
                {isRecurring && (
                  <div className="grid gap-2">
                    <Label>Ciclo de Repetição</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={cycle}
                      onChange={e => setCycle(e.target.value)}
                    >
                      {CYCLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ENTRADA ───────────────────────────── */}
          {type === 'income' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="income-company">Empresa / Cliente *</Label>
                <select
                  id="income-company"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  required
                >
                  <option value="">{isLoading ? 'Carregando…' : 'Selecione a empresa'}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="income-desc">Categoria / Descrição *</Label>
                <Input
                  id="income-desc"
                  placeholder="Ex: Mensalidade Tráfego Pago"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="income-amount">Valor (R$) *</Label>
                  <Input
                    id="income-amount"
                    type="number" step="0.01" placeholder="0.00"
                    value={amount} onChange={e => setAmount(e.target.value)} required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="income-date">
                    {isRecurring ? 'Primeiro Vencimento *' : 'Data de Vencimento *'}
                  </Label>
                  <Input
                    id="income-date"
                    type="date"
                    value={dueDate} onChange={e => setDueDate(e.target.value)} required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="billingType">Forma de Pagamento</Label>
                <select
                  id="billingType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={billingType}
                  onChange={e => setBillingType(e.target.value)}
                >
                  {BILLING_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <div className="grid gap-3">
                {recurringToggle(
                  'border-emerald-500 bg-emerald-50 text-emerald-700',
                  'bg-emerald-500',
                  'Assinatura Recorrente',
                  'Cobrança Única',
                  'Clique para tornar cobrança única',
                  'Clique para ativar recorrência',
                )}
                {isRecurring && (
                  <div className="grid gap-2">
                    <Label>Ciclo de Cobrança</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={cycle}
                      onChange={e => setCycle(e.target.value)}
                    >
                      {CYCLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              className={type === 'income'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'}
            >
              {isRecurring
                ? (type === 'income' ? 'Criar Assinatura' : 'Criar Saída Recorrente')
                : 'Salvar Registro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
