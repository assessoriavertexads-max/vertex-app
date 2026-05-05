import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyOption, LeadWithCompany } from '@/lib/backend-types';
import { Loader2 } from 'lucide-react';

const FUNNEL_STAGES = [
  { value: 'prospect', label: 'Prospecção' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'legal', label: 'Análise Jurídica' },
  { value: 'closed', label: 'Fechado (Ganho)' },
];

interface EditLeadModalProps {
  lead: LeadWithCompany | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<LeadWithCompany>) => void;
  onDelete: (id: string) => void;
}

export const EditLeadModal = ({ lead, onClose, onSave, onDelete }: EditLeadModalProps) => {
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [value, setValue] = useState('');
  const [legalStatus, setLegalStatus] = useState('');
  const [funnelStage, setFunnelStage] = useState('prospect');
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOpen = !!lead;

  useEffect(() => {
    if (lead) {
      setTitle(lead.title || '');
      setCompanyId(lead.company_id || '');
      setValue(String(lead.estimated_value ?? ''));
      setLegalStatus(lead.legal_status || '');
      setFunnelStage(lead.funnel_stage || 'prospect');
      setConfirming(false);
    }
  }, [lead]);

  const { data: companies = [] } = useQuery<CompanyOption[]>({
    queryKey: ['companies-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setIsSaving(true);
    onSave(lead.id, {
      title,
      company_id: companyId || null,
      estimated_value: parseFloat(value) || 0,
      legal_status: legalStatus || null,
      funnel_stage: funnelStage,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Título da Oportunidade *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label>Valor Estimado (R$)</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Empresa / Cliente</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Sem empresa vinculada</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Status Jurídico / Contrato</Label>
            <Input
              placeholder="Ex: Assinado, Em análise, Não assinado"
              value={legalStatus}
              onChange={(e) => setLegalStatus(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Estágio do Funil</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={funnelStage}
              onChange={(e) => setFunnelStage(e.target.value)}
            >
              {FUNNEL_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-between items-center pt-1">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Confirmar exclusão?</span>
                <Button type="button" variant="destructive" size="sm"
                  onClick={() => { onDelete(lead!.id); onClose(); }}>
                  Excluir
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setConfirming(true)}>
                Excluir lead
              </Button>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
