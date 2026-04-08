import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  }) => void;
  defaultType: 'income' | 'expense';
}

const CYCLE_OPTIONS = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUALLY', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
];

export const NewTransactionModal = ({ isOpen, onClose, onSave, defaultType }: NewTransactionModalProps) => {
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [companyId, setCompanyId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [cycle, setCycle] = useState('MONTHLY');

  useEffect(() => {
    setType(defaultType);
    setDescription('');
    setCompanyId('');
    setAmount('');
    setDueDate('');
    setIsRecurring(false);
    setCycle('MONTHLY');
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

    onSave({
      company_id: companyId || null,
      type,
      amount: parseFloat(amount) || 0,
      due_date: dueDate,
      category: description || null,
      status: type === 'expense' ? 'paid' : 'pending',
      subscription_cycle: isRecurring && type === 'income' ? cycle : null,
    });

    setCompanyId('');
    setAmount('');
    setDueDate('');
    setDescription('');
    setIsRecurring(false);
    setCycle('MONTHLY');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className={type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
            {type === 'income' ? 'Registrar Nova Entrada' : 'Registrar Nova Saída'}
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes do {type === 'income' ? 'recebimento' : 'pagamento'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="company">Empresa / Cliente</Label>
            <select
              id="company"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required={type === 'income'}
            >
              <option value="">{isLoading ? 'Carregando...' : 'Selecione a empresa (opcional para saída)'}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">
              {type === 'income' ? 'Categoria / Descrição' : 'Descrição da Saída'}
            </Label>
            <Textarea
              id="category"
              placeholder={type === 'income' ? 'Ex: Mensalidade Tráfego' : 'Ex: Compra de software, pagamento de aluguel'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">{isRecurring ? 'Primeiro Vencimento' : 'Data de Vencimento'}</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Toggle de recorrência — apenas para entradas */}
          {type === 'income' && (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  isRecurring
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isRecurring ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <p className="font-semibold">{isRecurring ? 'Assinatura Recorrente' : 'Cobrança Única'}</p>
                  <p className="text-xs font-normal opacity-70">
                    {isRecurring ? 'Clique para tornar cobrança única' : 'Clique para ativar recorrência'}
                  </p>
                </div>
                <div className={`ml-auto w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${isRecurring ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              {isRecurring && (
                <div className="grid gap-2">
                  <Label htmlFor="cycle">Ciclo de Cobrança</Label>
                  <select
                    id="cycle"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                  >
                    {CYCLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className={type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
            >
              {isRecurring ? 'Criar Assinatura' : 'Salvar Registro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
