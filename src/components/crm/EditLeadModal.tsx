import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyOption, LeadWithCompany } from '@/lib/backend-types';
import { Loader2 } from 'lucide-react';

const FUNNEL_STAGES = [
  { value: 'prospect',      label: '🔍 Prospecção' },
  { value: 'qualification', label: '✅ Qualificação (SDR)' },
  { value: 'diagnosis',     label: '🔬 Diagnóstico' },
  { value: 'proposal',      label: '📋 Proposta Comercial' },
  { value: 'negotiation',   label: '🤝 Negociação' },
  { value: 'won',           label: '🏆 Fechado (Ganho)' },
  { value: 'lost',          label: '❌ Perdido' },
];

const LOSS_REASONS = [
  'Preço alto demais',
  'Escolheu a concorrência',
  'Sem orçamento no momento',
  'Momento errado',
  'Sem resposta',
  'Proposta não aprovada',
  'Outro',
];

interface EditLeadModalProps {
  lead: LeadWithCompany | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<LeadWithCompany>) => void;
  onDelete: (id: string) => void;
}

export const EditLeadModal = ({ lead, onClose, onSave, onDelete }: EditLeadModalProps) => {
  const [title,        setTitle]        = useState('');
  const [companyId,    setCompanyId]    = useState('');
  const [value,        setValue]        = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [notes,        setNotes]        = useState('');
  const [funnelStage,  setFunnelStage]  = useState('prospect');
  const [lossReason,   setLossReason]   = useState('');
  const [confirming,   setConfirming]   = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  const isOpen = !!lead;

  useEffect(() => {
    if (lead) {
      setTitle(lead.title || '');
      setCompanyId(lead.company_id || '');
      setValue(String(lead.estimated_value ?? ''));
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setNotes(lead.notes || '');
      setFunnelStage(lead.funnel_stage || 'prospect');
      setLossReason(lead.loss_reason || '');
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
      company_id:      companyId || null,
      estimated_value: parseFloat(value) || 0,
      email:           email.trim() || null,
      phone:           phone.trim() || null,
      notes:           notes.trim() || null,
      funnel_stage:    funnelStage,
      loss_reason:     funnelStage === 'lost' ? (lossReason || null) : null,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3.5 py-2">
          {/* Título */}
          <div className="grid gap-1.5">
            <Label>Título da Oportunidade *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Valor */}
          <div className="grid gap-1.5">
            <Label>Valor Estimado (R$)</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>

          {/* Email + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Telefone / WhatsApp</Label>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {/* Empresa */}
          <div className="grid gap-1.5">
            <Label>Empresa / Cliente</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Sem empresa vinculada</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Anotações */}
          <div className="grid gap-1.5">
            <Label>Anotações</Label>
            <Textarea
              placeholder="Dores, objetivos, observações sobre o lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Estágio */}
          <div className="grid gap-1.5">
            <Label>Estágio do Funil</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={funnelStage}
              onChange={(e) => setFunnelStage(e.target.value)}
            >
              {FUNNEL_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Motivo de perda (só quando perdido) */}
          {funnelStage === 'lost' && (
            <div className="grid gap-1.5">
              <Label>Motivo de Perda</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
              >
                <option value="">Selecione o motivo</option>
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-between items-center pt-1">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Confirmar exclusão?</span>
                <Button type="button" variant="destructive" size="sm"
                  onClick={() => { onDelete(lead!.id); onClose(); }}>
                  Excluir
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm"
                className="text-destructive hover:text-destructive hover:bg-red-50"
                onClick={() => setConfirming(true)}>
                Excluir lead
              </Button>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
