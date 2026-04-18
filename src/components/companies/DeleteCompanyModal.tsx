import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface DeleteCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  company: Company | null;
}

export const DeleteCompanyModal = ({ isOpen, onClose, onSave, company }: DeleteCompanyModalProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!company) return;
    setDeleting(true);

    const { error } = await supabase
      .from('companies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', company.id);

    setDeleting(false);

    if (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao excluir empresa');
      return;
    }

    onSave();
    onClose();

    toast.success('Empresa excluída.', {
      action: {
        label: 'Desfazer',
        onClick: async () => {
          await supabase.from('companies').update({ deleted_at: null }).eq('id', company.id);
          onSave();
          toast.success('Exclusão desfeita!');
        },
      },
      duration: 6000,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Empresa</DialogTitle>
          <DialogDescription>Você poderá desfazer esta ação nos próximos 6 segundos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{company?.name}</strong>?
          </p>
          <p className="text-xs text-destructive">
            ⚠️ Todos os dados associados a esta empresa (contratos, tarefas, transações) também serão excluídos.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>Cancelar</Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Empresa'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
