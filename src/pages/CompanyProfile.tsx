import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
<<<<<<< HEAD
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '@/lib/company-constants';
import { Json } from '@/integrations/supabase/types';

interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  created_at: string;
  custom_data: Json | null;
  asaas_customer_id: string | null;
}

interface Lead {
  id: string;
  title: string;
  estimated_value: number | null;
  funnel_stage: string | null;
  legal_status: string | null;
  created_at: string;
}

export default function CompanyProfile() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;
      
      setLoading(true);
      
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (companyError) {
        console.error('Erro ao buscar empresa:', companyError);
        toast.error('Erro ao carregar dados da empresa');
      } else if (companyData) {
        setCompany(companyData as Company);
      }

      if (leadsError) {
        console.error('Erro ao buscar leads:', leadsError);
      } else if (leadsData) {
        setLeads(leadsData as Lead[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/companies')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
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
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/companies')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">CNPJ/CPF</p>
              <p className="text-lg font-medium text-foreground">{company.document || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID da Empresa</p>
              <p className="text-sm font-mono text-muted-foreground break-all">{company.id}</p>
            </div>
            {company.asaas_customer_id && (
              <div>
                <p className="text-sm text-muted-foreground">Cliente Asaas</p>
                <p className="text-sm font-mono text-muted-foreground">{company.asaas_customer_id}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Cadastro
              </p>
              <p className="text-lg font-medium text-foreground">
                {new Date(company.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Oportunidades
              </p>
              <p className="text-lg font-medium text-foreground">{leads.length} leads</p>
            </div>
          </div>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Oportunidades Vinculadas</h2>
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{lead.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lead.funnel_stage && `Estágio: ${lead.funnel_stage}`}
                    </p>
                  </div>
                  {lead.estimated_value && (
                    <p className="text-lg font-semibold text-primary">
                      R$ {lead.estimated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                {lead.legal_status && (
                  <p className="text-xs text-muted-foreground mt-2">Status Legal: {lead.legal_status}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="bg-muted/50 rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">Nenhuma oportunidade vinculada a esta empresa ainda.</p>
        </div>
      )}
    </div>
  );
}
