import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyOption, LeadInsert } from '@/lib/backend-types';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leadData: LeadInsert) => void;
}

export const NewLeadModal = ({ isOpen, onClose, onSave }: NewLeadModalProps) => {
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [value, setValue] = useState('');
  const [legalStatus, setLegalStatus] = useState('');
  const [contractSigned, setContractSigned] = useState(false);

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

    onSave({
      title,
      company_id: companyId || null,
      estimated_value: parseFloat(value) || 0,
      funnel_stage: 'prospect',
      legal_status: contractSigned ? 'Assinado' : legalStatus || null,
    });

    setTitle('');
    setCompanyId('');
    setValue('');
    setLegalStatus('');
    setContractSigned(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Lead</DialogTitle>
          <DialogDescription>
            Crie uma nova oportunidade de negócio no seu funil.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título da Oportunidade / Serviço</Label>
            <Input
              id="title"
              placeholder="Ex: Gestão de Tráfego 6 Meses"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="company">Empresa / Cliente</Label>
            <select
              id="company"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">{isLoading ? 'Carregando empresas...' : 'Selecione uma empresa (opcional)'}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={contractSigned}
                onChange={(e) => setContractSigned(e.target.checked)}
                className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
              />
              Contrato assinado
            </label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="legal-status">Status Jurídico / Contrato</Label>
            <input
              id="legal-status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={legalStatus}
              onChange={(e) => setLegalStatus(e.target.value)}
              placeholder="Ex: Assinado, Em análise, Não assinado"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="value">Valor Estimado (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              placeholder="Ex: 5000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Criar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
