import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CompanyStatus, COMPANY_STATUS_LABELS } from '@/integrations/supabase/types';

interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
}

interface EditCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  company: Company | null;
}

export const EditCompanyModal = ({ isOpen, onClose, onSave, company }: EditCompanyModalProps) => {
  const [formData, setFormData] = useState({ name: '', document: '', status: 'ativo' as CompanyStatus });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        document: company.document || '',
        status: company.status as CompanyStatus
      });
    }
  }, [company, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);

    const { error } = await supabase
      .from('companies')
      .update({
        name: formData.name,
        document: formData.document || null,
        status: formData.status,
      })
      .eq('id', company.id);

    setSaving(false);

    if (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar empresa');
      return;
    }

    toast.success('Empresa atualizada com sucesso!');
    onSave();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>Atualize as informações da empresa.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Razão Social / Nome Fantasia</Label>
            <Input
              id="edit-name"
              placeholder="Ex: TechCorp Solutions"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-document">CNPJ ou CPF</Label>
            <Input
              id="edit-document"
              placeholder="00.000.000/0001-00"
              value={formData.document}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as CompanyStatus })}>
              <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMPANY_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
