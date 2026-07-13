import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyOption, LeadInsert } from '@/lib/backend-types';
import { Loader2 } from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leadData: LeadInsert, newCompany?: { name: string; phone?: string; document?: string }) => void;
}

export const NewLeadModal = ({ isOpen, onClose, onSave }: NewLeadModalProps) => {
  const [title,              setTitle]              = useState('');
  const [companyMode,        setCompanyMode]        = useState<'existing' | 'new' | 'none'>('existing');
  const [companyId,          setCompanyId]          = useState('');
  const [newCompanyName,     setNewCompanyName]     = useState('');
  const [newCompanyPhone,    setNewCompanyPhone]    = useState('');
  const [newCompanyDocument, setNewCompanyDocument] = useState('');
  const [value,              setValue]              = useState('');
  const [email,              setEmail]              = useState('');
  const [phone,              setPhone]              = useState('');
  const [isSaving,           setIsSaving]           = useState(false);

  const { data: companies = [], isLoading } = useQuery<CompanyOption[]>({
    queryKey: ['companies-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const reset = () => {
    setTitle(''); setCompanyMode('existing'); setCompanyId('');
    setNewCompanyName(''); setNewCompanyPhone(''); setNewCompanyDocument('');
    setValue(''); setEmail(''); setPhone(''); setIsSaving(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const leadData: LeadInsert = {
        title,
        company_id: companyMode === 'existing' ? (companyId || null) : null,
        estimated_value: parseFloat(value) || 0,
        funnel_stage: 'prospect',
        email: email.trim() || null,
        phone: phone.trim() || null,
      };

      if (companyMode === 'new' && newCompanyName.trim()) {
        onSave(leadData, {
          name: newCompanyName.trim(),
          phone: newCompanyPhone.trim() || undefined,
          document: newCompanyDocument.trim() || undefined,
        });
      } else {
        onSave(leadData);
      }

      reset();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
          <DialogDescription>
            Crie uma nova oportunidade de negócio no funil.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* Título */}
          <div className="grid gap-2">
            <Label htmlFor="title">Título da Oportunidade / Serviço *</Label>
            <Input
              id="title"
              placeholder="Ex: Gestão de Tráfego 6 Meses"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Valor */}
          <div className="grid gap-2">
            <Label htmlFor="value">Valor Estimado (R$) *</Label>
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

          {/* Empresa — modo */}
          <div className="grid gap-2">
            <Label>Empresa / Cliente</Label>
            <div className="flex rounded-lg border border-input overflow-hidden text-sm">
              {(['existing', 'new', 'none'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCompanyMode(mode)}
                  className={`flex-1 py-2 px-3 transition-colors ${
                    companyMode === mode
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {mode === 'existing' ? 'Existente' : mode === 'new' ? 'Criar nova' : 'Sem empresa'}
                </button>
              ))}
            </div>

            {companyMode === 'existing' && (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">{isLoading ? 'Carregando...' : 'Selecione uma empresa'}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {companyMode === 'new' && (
              <div className="grid gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nome da empresa *</Label>
                  <Input
                    placeholder="Ex: Empresa XYZ Ltda"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required={companyMode === 'new'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Telefone / WhatsApp</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">CNPJ / CPF</Label>
                    <Input
                      placeholder="00.000.000/0001-00"
                      value={newCompanyDocument}
                      onChange={(e) => setNewCompanyDocument(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
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

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
