import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  defaultType: 'income' | 'expense';
}

export const NewTransactionModal = ({ isOpen, onClose, onSave, defaultType }: NewTransactionModalProps) => {
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [companyId, setCompanyId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    setType(defaultType);
  }, [defaultType, isOpen]);

  const { data: companies = [], isLoading } = useQuery({
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
    if (!companyId) {
      alert('Selecione um cliente/empresa.');
      return;
    }

    onSave({
      company_id: companyId,
      type,
      amount: parseFloat(amount) || 0,
      due_date: dueDate,
      category,
      status: type === 'expense' ? 'paid' : 'pending',
    });

    setCompanyId('');
    setAmount('');
    setDueDate('');
    setCategory('');
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
              required
            >
              <option value="" disabled>
                {isLoading ? 'Carregando...' : 'Selecione a empresa'}
              </option>
              {companies.map((company: any) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Categoria / Descrição</Label>
            <Input
              id="category"
              placeholder={type === 'income' ? 'Ex: Mensalidade Tráfego' : 'Ex: Assinatura Adobe'}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className={type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}>
              Salvar Registro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
