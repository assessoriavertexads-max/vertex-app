import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Calendar, Pencil, Check, X, User, CreditCard, Megaphone, Phone, Mail, UserPlus, Users, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '@/lib/company-constants';
import { Json } from '@/integrations/supabase/types';

interface ClientUser {
  id: string;
  full_name: string | null;
  agency_user_id: string | null;
}

interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  created_at: string;
  custom_data: Json | null;
  asaas_customer_id: string | null;
  phone: string | null;
  email: string | null;
  meta_ad_account_id: string | null;
  google_ad_account_id: string | null;
}

// Campo inline editável reutilizável
function InlineField({
  label,
  value,
  placeholder,
  mono,
  icon,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  mono?: boolean;
  icon?: React.ReactNode;
  onSave: (val: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setInput(value ?? ''); }, [value]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(input.trim() || null);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        {icon}{label}
      </p>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            className={`h-8 text-sm ${mono ? 'font-mono' : ''}`}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(false)}>
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
            {value || 'Não informado'}
          </p>
          <Button
            size="icon" variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => { setInput(value ?? ''); setEditing(true); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany]         = useState<Company | null>(null);
  const [loading, setLoading]         = useState(true);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      supabase.from('companies').select('*').eq('id', companyId).single(),
      supabase.from('profiles').select('id, full_name, agency_user_id').eq('company_id', companyId).eq('role', 'cliente'),
    ]).then(([companyRes, profilesRes]) => {
      if (companyRes.error) toast.error('Erro ao carregar dados da empresa');
      else if (companyRes.data) setCompany(companyRes.data as Company);
      if (profilesRes.data) setClientUsers(profilesRes.data as ClientUser[]);
    }).finally(() => setLoading(false));
  }, [companyId]);

  const handleInviteClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !companyId) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-client', {
        body: { email: inviteEmail.trim(), company_id: companyId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? 'Convite enviado!');
      setInviteEmail('');
      // Refresh client list
      const { data: updated } = await supabase
        .from('profiles').select('id, full_name, agency_user_id')
        .eq('company_id', companyId).eq('role', 'cliente');
      if (updated) setClientUsers(updated as ClientUser[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const saveField = async (field: string, value: string | null) => {
    if (!companyId) return;
    const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', companyId);
    if (error) {
      toast.error(`Erro ao salvar campo`);
    } else {
      setCompany(prev => prev ? { ...prev, [field]: value } : prev);
      toast.success('Atualizado!');
    }
  };

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

  const statusLabel = COMPANY_STATUS_LABELS[company.status as keyof typeof COMPANY_STATUS_LABELS] || company.status;
  const statusColor = COMPANY_STATUS_COLORS[company.status as keyof typeof COMPANY_STATUS_COLORS] || 'bg-gray-500/20 text-gray-400';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/companies/${companyId}`)}>
          Abrir Workspace
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary flex-shrink-0">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Desde {new Date(company.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      {/* Dados Cadastrais */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Dados Cadastrais
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InlineField
            label="CNPJ / CPF"
            value={company.document}
            placeholder="00.000.000/0001-00"
            mono
            onSave={v => saveField('document', v)}
          />
          <InlineField
            label="Email"
            value={company.email}
            placeholder="cliente@empresa.com.br"
            icon={<Mail className="h-3 w-3" />}
            onSave={v => saveField('email', v)}
          />
          <InlineField
            label="Telefone / WhatsApp"
            value={company.phone}
            placeholder="5511999999999"
            mono
            icon={<Phone className="h-3 w-3" />}
            onSave={v => saveField('phone', v)}
          />
        </div>
      </div>

      {/* Financeiro */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <InlineField
              label="Asaas — ID do Cliente"
              value={company.asaas_customer_id}
              placeholder="cus_000000000000"
              mono
              onSave={v => saveField('asaas_customer_id', v)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Encontre em: Asaas → Clientes → ID do cliente
            </p>
          </div>
        </div>
      </div>

      {/* Portal do Cliente */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Portal do Cliente
        </h2>
        <p className="text-xs text-muted-foreground">
          Envie um convite por email. O cliente recebe um link para definir a senha e acessar um painel exclusivo com boletos e campanhas.
        </p>

        {clientUsers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acessos ativos</p>
            {clientUsers.map(cu => (
              <div key={cu.id} className="flex items-center gap-2 py-1.5 px-3 bg-muted/40 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm">{cu.full_name ?? cu.id}</span>
                <Badge variant="secondary" className="ml-auto text-xs">cliente</Badge>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleInviteClient} className="flex gap-2">
          <Input
            type="email"
            placeholder="email@cliente.com.br"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="h-9 text-sm"
            required
          />
          <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()} className="shrink-0">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {inviting ? 'Enviando…' : 'Convidar'}
          </Button>
        </form>
      </div>

      {/* Mídias Pagas */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Mídias Pagas
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Meta */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <span className="text-xs font-bold text-emerald-600">f</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Meta Ads</p>
                <p className="text-xs text-muted-foreground">Facebook & Instagram</p>
              </div>
              {company.meta_ad_account_id && (
                <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">Conectado</span>
              )}
            </div>
            <InlineField
              label="Ad Account ID"
              value={company.meta_ad_account_id}
              placeholder="act_000000000000"
              mono
              onSave={v => saveField('meta_ad_account_id', v)}
            />
            <p className="text-xs text-muted-foreground">
              Meta Business Suite → Configurações → Contas de Anúncio
            </p>
          </div>

          {/* Google */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                <span className="text-xs font-bold text-red-500">G</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Google Ads</p>
                <p className="text-xs text-muted-foreground">Google & YouTube</p>
              </div>
              {company.google_ad_account_id && (
                <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">Conectado</span>
              )}
            </div>
            <InlineField
              label="Customer ID"
              value={company.google_ad_account_id}
              placeholder="000-000-0000"
              mono
              onSave={v => saveField('google_ad_account_id', v)}
            />
            <p className="text-xs text-muted-foreground">
              Google Ads → Ferramentas → ID do cliente (canto superior direito)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
