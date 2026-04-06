import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const NewCompanyModal = ({ isOpen, onClose, onSave }: NewCompanyModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    status: 'lead'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: Math.random().toString(), demands: 0 });
    setFormData({ name: '', document: '', status: 'lead' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Empresa</DialogTitle>
          <DialogDescription>
            Adicione um novo cliente ou lead ao seu workspace da Vertex.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Razão Social / Nome Fantasia</Label>
            <Input
              id="name"
              placeholder="Ex: TechCorp Solutions"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">CNPJ ou CPF</Label>
            <Input
              id="document"
              placeholder="00.000.000/0001-00"
              value={formData.document}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Status Inicial</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead (Em negociação)</SelectItem>
                <SelectItem value="active">Cliente Ativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Empresa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
