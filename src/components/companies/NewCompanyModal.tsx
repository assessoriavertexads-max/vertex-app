import { useState } from 'react';

const ONBOARDING_TASKS = [
  { name: 'Reunião de Briefing Inicial', priority: 'alta' },
  { name: 'Coletar acessos e senhas do cliente', priority: 'alta' },
  { name: 'Configurar integração Asaas', priority: 'media' },
  { name: 'Alinhar cronograma de entregas', priority: 'media' },
  { name: 'Criar relatório de onboarding', priority: 'baixa' },
];
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CompanyStatus, COMPANY_STATUS_LABELS } from '@/lib/company-constants';
import { isValidCNPJorCPF, formatCNPJorCPF } from '@/utils/validation';
import { runAutomations } from '@/lib/automation';

interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const NewCompanyModal = ({ isOpen, onClose, onSave }: NewCompanyModalProps) => {
  const [formData, setFormData] = useState({ name: '', document: '', status: 'ativo' as CompanyStatus });
  const [saving, setSaving] = useState(false);
  const [documentError, setDocumentError] = useState('');

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDocumentError('');
    setFormData({ ...formData, document: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    if (formData.document && !isValidCNPJorCPF(formData.document)) {
      setDocumentError('CNPJ ou CPF inválido. Verifique o documento informado.');
      return;
    }

    setSaving(true);

    const { data: inserted, error } = await supabase.from('companies').insert({
      name: formData.name.trim(),
      document: formData.document ? formatCNPJorCPF(formData.document) : null,
      status: formData.status,
    }).select('id, name').single();

    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar empresa');
      return;
    }

    toast.success('Empresa cadastrada com sucesso!');
    setFormData({ name: '', document: '', status: 'ativo' });
    onSave();
    onClose();

    if (inserted) {
      // Cria tarefas de onboarding automaticamente
      const tasks = ONBOARDING_TASKS.map(t => ({
        name: t.name,
        priority: t.priority,
        company_id: inserted.id,
        status: 'a_receber',
      }));
      supabase.from('tasks').insert(tasks).then(({ error }) => {
        if (!error) toast.success(`${tasks.length} tarefas de onboarding criadas!`, { duration: 3500 });
      });

      runAutomations('new_company_created', 'any', {
        entityTitle: inserted.name,
        companyId: inserted.id,
        companyName: inserted.name,
      }).catch(() => {});
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Empresa</DialogTitle>
          <DialogDescription>Adicione um novo cliente ao seu workspace da Vertos.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Razão Social / Nome Fantasia</Label>
            <Input id="name" placeholder="Ex: TechCorp Solutions" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">CNPJ ou CPF</Label>
            <Input 
              id="document" 
              placeholder="00.000.000/0001-00 ou 000.000.000-00" 
              value={formData.document} 
              onChange={handleDocumentChange}
              className={documentError ? 'border-red-500' : ''}
            />
            {documentError && <p className="text-sm text-red-500">{documentError}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status Inicial</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as CompanyStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="stand-by">Stand-by</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Empresa'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
