import { useEffect, useState } from 'react';
import { MessageCircle, FileText, TrendingUp, Clock, CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Transaction {
  id: string;
  category: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  type: string;
}

interface Company {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface AgencyProfile {
  full_name: string | null;
  whatsapp_phone: string | null;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string | null) {
  if (!d) return '–';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':      return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    case 'pending':   return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
    case 'overdue':   return <Badge variant="destructive">Vencido</Badge>;
    case 'cancelled': return <Badge variant="secondary">Cancelado</Badge>;
    default:          return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ClientPortal() {
  const { profile } = useAuth();
  const [company, setCompany]             = useState<Company | null>(null);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [agencyProfile, setAgencyProfile] = useState<AgencyProfile | null>(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!profile?.company_id) { setLoading(false); return; }
    load();
  }, [profile]);

  async function load() {
    setLoading(true);
    try {
      const [companyRes, txRes, agencyRes] = await Promise.all([
        // Company data — RLS ensures we only see our own company
        supabase
          .from('companies')
          .select('id, name, phone, email')
          .eq('id', profile!.company_id!)
          .single(),

        // Transactions — RLS ensures only our company's
        supabase
          .from('financial_transactions')
          .select('id, category, amount, status, due_date, type')
          .order('due_date', { ascending: true }),

        // Agency profile (to get WhatsApp contact number)
        profile?.agency_user_id
          ? supabase
              .from('profiles')
              .select('full_name, whatsapp_phone')
              .eq('id', profile.agency_user_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (companyRes.data) setCompany(companyRes.data as Company);
      if (txRes.data) setTransactions(txRes.data as Transaction[]);
      if (agencyRes.data) setAgencyProfile(agencyRes.data as AgencyProfile);
    } finally {
      setLoading(false);
    }
  }

  const pending  = transactions.filter(t => t.status === 'pending');
  const overdue  = transactions.filter(t => t.status === 'overdue');
  const paid     = transactions.filter(t => t.status === 'paid');
  const totalPending = pending.reduce((s, t) => s + Number(t.amount), 0);
  const totalOverdue = overdue.reduce((s, t) => s + Number(t.amount), 0);

  const whatsappNumber = agencyProfile?.whatsapp_phone?.replace(/\D/g, '') ?? '';
  const whatsappLink   = whatsappNumber
    ? `https://wa.me/${whatsappNumber.startsWith('55') ? whatsappNumber : '55' + whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de falar sobre minha conta.')}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile?.company_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h2 className="text-xl font-semibold">Conta não vinculada</h2>
        <p className="text-muted-foreground max-w-xs">
          Seu acesso ainda não foi vinculado a uma empresa. Entre em contato com a agência.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{company?.name ?? 'Portal do Cliente'}</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua conta</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Boletos Pendentes</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatBRL(totalPending)}</p>
                <p className="text-xs text-muted-foreground mt-1">{pending.length} fatura{pending.length !== 1 ? 's' : ''}</p>
              </div>
              <Clock className="h-10 w-10 text-yellow-400 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className={overdue.length > 0 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Vencidos</p>
                <p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {formatBRL(totalOverdue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{overdue.length} fatura{overdue.length !== 1 ? 's' : ''}</p>
              </div>
              <AlertTriangle className={`h-10 w-10 opacity-60 ${overdue.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pagos este mês</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatBRL(paid.reduce((s, t) => s + Number(t.amount), 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{paid.length} fatura{paid.length !== 1 ? 's' : ''}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-400 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions list */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Faturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma fatura encontrada.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.category ?? 'Serviço'}</p>
                      <p className="text-xs text-muted-foreground">Venc. {formatDate(tx.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {statusBadge(tx.status)}
                      <span className="text-sm font-semibold tabular-nums">{formatBRL(Number(tx.amount))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact agency */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Falar com a Agência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem dúvidas sobre suas faturas ou campanhas? Fale diretamente com nossa equipe.
            </p>

            {whatsappLink ? (
              <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                  <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp (não configurado)
              </Button>
            )}

            {company?.email && (
              <Button asChild variant="outline" className="w-full">
                <a href={`mailto:${company.email}`}>
                  E-mail
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
