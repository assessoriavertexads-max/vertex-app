import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Eye, Plus, Trash2, Loader2, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Contract {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  file_url: string | null;
  notes: string | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'active', label: 'Ativo' },
  { value: 'expired', label: 'Expirado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'bg-gray-500/20 text-gray-500';
    case 'active': return 'bg-green-500/20 text-green-600';
    case 'expired': return 'bg-red-500/20 text-red-600';
    case 'cancelled': return 'bg-orange-500/20 text-orange-600';
    default: return 'bg-emerald-500/20 text-emerald-600';
  }
};

const getStatusLabel = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.label ?? status;

interface ContractFormData {
  title: string;
  description: string;
  status: string;
  notes: string;
  signed_at: string;
  expires_at: string;
}

const EMPTY_FORM: ContractFormData = {
  title: '',
  description: '',
  status: 'draft',
  notes: '',
  signed_at: '',
  expires_at: '',
};

function ContractModal({
  isOpen,
  onClose,
  onSave,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ContractFormData) => void;
  initial?: ContractFormData;
}) {
  const [form, setForm] = useState<ContractFormData>(initial ?? EMPTY_FORM);

  const set = (field: keyof ContractFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Informe um título para o contrato.');
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Título *</Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ex: Contrato de Assessoria 2026"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Resumo do escopo do contrato"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Data de Assinatura</Label>
              <Input
                type="date"
                value={form.signed_at}
                onChange={e => set('signed_at', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Data de Expiração</Label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={e => set('expires_at', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Notas internas sobre o contrato"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">{initial ? 'Salvar alterações' : 'Criar contrato'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CompanyContracts() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: company, isLoading: loadingCompany } = useQuery<Company>({
    queryKey: ['company-name', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId!)
        .single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!companyId,
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery<Contract[]>({
    queryKey: ['contracts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contract[];
    },
    enabled: !!companyId,
  });

  const createContract = useMutation({
    mutationFn: async (form: ContractFormData) => {
      const { error } = await supabase.from('contracts').insert({
        company_id: companyId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        signed_at: form.signed_at || null,
        expires_at: form.expires_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', companyId] });
      setIsModalOpen(false);
      toast.success('Contrato criado com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ContractFormData }) => {
      const { error } = await supabase.from('contracts').update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        signed_at: form.signed_at || null,
        expires_at: form.expires_at || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', companyId] });
      setEditingContract(null);
      toast.success('Contrato atualizado!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', companyId] });
      setDeletingId(null);
      toast.success('Contrato excluído.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const loading = loadingCompany || loadingContracts;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Empresa não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(`/companies/${companyId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Workspace
        </Button>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Contrato
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-foreground">Contratos Arquivados</h1>
        <p className="text-muted-foreground mt-1">{company.name} — {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}</p>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-muted/50 rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground font-medium">Nenhum contrato cadastrado ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Contrato" para arquivar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map(contract => (
            <div key={contract.id} className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{contract.title}</h3>
                    {contract.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{contract.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contract.status)}`}>
                        {getStatusLabel(contract.status)}
                      </span>
                      {contract.signed_at && (
                        <span className="text-xs text-muted-foreground">
                          Assinado: {new Date(contract.signed_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {contract.expires_at && (
                        <span className="text-xs text-muted-foreground">
                          Expira: {new Date(contract.expires_at + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Criado: {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {contract.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">Obs: {contract.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {contract.file_url && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
                        onClick={() => window.open(contract.file_url!, '_blank')}>
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = contract.file_url!;
                          a.download = contract.title;
                          a.click();
                        }}>
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </Button>
                    </>
                  )}

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingContract(contract)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {deletingId === contract.id ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => deleteContract.mutate(contract.id)}
                        disabled={deleteContract.isPending}>
                        {deleteContract.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirmar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setDeletingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => setDeletingId(contract.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criação */}
      <ContractModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={form => createContract.mutate(form)}
      />

      {/* Modal edição */}
      {editingContract && (
        <ContractModal
          isOpen={!!editingContract}
          onClose={() => setEditingContract(null)}
          onSave={form => updateContract.mutate({ id: editingContract.id, form })}
          initial={{
            title: editingContract.title,
            description: editingContract.description ?? '',
            status: editingContract.status,
            notes: editingContract.notes ?? '',
            signed_at: editingContract.signed_at
              ? new Date(editingContract.signed_at).toISOString().split('T')[0]
              : '',
            expires_at: editingContract.expires_at ?? '',
          }}
        />
      )}
    </div>
  );
}
