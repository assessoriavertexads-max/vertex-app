import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CheckCircle2, ClipboardList, FileText, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  asaas_customer_id: string | null;
  custom_data: any;
  created_at: string;
}

interface Lead {
  id: string;
  title: string;
  funnel_stage: string | null;
  estimated_value: number | null;
  legal_status: string | null;
  created_at: string;
  company_id: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
  company_id: string | null;
}

const statusLabels = {
  active: 'Cliente Ativo',
  lead: 'Lead',
  churn: 'Cancelado',
};

export default function CompanyWorkspace() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'erp'>('overview');
  const [searchCampaigns, setSearchCampaigns] = useState('');
  const [erpParameter, setErpParameter] = useState('');
  const [erpNotes, setErpNotes] = useState('');

  const {
    data: company,
    isLoading: isLoadingCompany,
    isError: isErrorCompany,
  } = useQuery<Company>({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('ID de empresa não encontrado');
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, document, status, asaas_customer_id, custom_data, created_at')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data as unknown as Company;
    },
    enabled: !!companyId,
  });

  const {
    data: campaigns = [],
    isLoading: isLoadingCampaigns,
    isError: isErrorCampaigns,
  } = useQuery<Lead[]>({
    queryKey: ['campaigns', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('id, title, funnel_stage, estimated_value, legal_status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Lead[];
    },
    enabled: !!companyId,
  });

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    isError: isErrorTasks,
  } = useQuery<Task[]>({
    queryKey: ['company-tasks', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_date, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (company) {
      const data = (company.custom_data ?? {}) as Record<string, any>;
      setErpParameter(data.erp_parameter ?? '');
      setErpNotes(data.erp_notes ?? '');
    }
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: async (payload: { erp_parameter: string; erp_notes: string }) => {
      if (!companyId) throw new Error('ID de empresa não encontrado');
      const currentData = (company?.custom_data ?? {}) as Record<string, any>;
      const { error } = await supabase
        .from('companies')
        .update({ custom_data: { ...currentData, ...payload } })
        .eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Parâmetro ERP atualizado');
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    },
  });

  const filteredCampaigns = useMemo(() => {
    const term = searchCampaigns.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter((campaign) =>
      campaign.title.toLowerCase().includes(term) ||
      (campaign.funnel_stage?.toLowerCase().includes(term) ?? false) ||
      (campaign.legal_status?.toLowerCase().includes(term) ?? false),
    );
  }, [campaigns, searchCampaigns]);

  const totalRevenue = useMemo(
    () => campaigns.reduce((sum, campaign) => sum + (Number(campaign.estimated_value) || 0), 0),
    [campaigns],
  );

  const statusText = company?.status ? statusLabels[company.status as keyof typeof statusLabels] ?? company.status : 'Sem status';

  if (isLoadingCompany || isLoadingCampaigns || isLoadingTasks) {
    return <div className="flex items-center justify-center h-64">Carregando workspace do cliente...</div>;
  }

  if (isErrorCompany || isErrorCampaigns || isErrorTasks || !company) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Erro ao carregar o workspace do cliente. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Briefcase className="h-5 w-5" />
            <span className="uppercase tracking-[0.25em] text-xs font-semibold">Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-2">{company.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Espaço dedicado ao cliente com campanhas, tarefas e parâmetros ERP.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/companies">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button onClick={() => setActiveTab('erp')}>Parâmetros ERP</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Status do cliente</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{statusText}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Campanhas</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{campaigns.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Tarefas</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{tasks.length}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'campaigns' | 'erp')}>
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-semibold">Visão geral</span>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">CNPJ:</span> {company.document || 'Não informado'}</p>
                <p><span className="font-medium text-foreground">Conta Asaas:</span> {company.asaas_customer_id || 'Nenhuma'}</p>
                <p><span className="font-medium text-foreground">Criado em:</span> {new Date(company.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary mb-3">
                <ClipboardList className="h-4 w-4" />
                <span className="text-sm font-semibold">Desempenho das campanhas</span>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Valor estimado total:</span> R$ {totalRevenue.toFixed(2)}</p>
                <p><span className="font-medium text-foreground">Última campanha:</span> {campaigns[0]?.title ?? 'Sem campanhas'}</p>
                <p><span className="font-medium text-foreground">Campanhas ativas:</span> {campaigns.filter((campaign) => campaign.funnel_stage !== 'closed').length}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-primary mb-3">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-semibold">Tarefas recentes</span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem tarefas vinculadas a este cliente.</p>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-2xl border border-border p-4">
                    <p className="font-medium text-sm text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{task.description || 'Sem descrição'}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.status || 'Sem status'}</span>
                      <span>{task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Campanhas vinculadas ao cliente</p>
              <h2 className="text-lg font-semibold text-foreground">{company.name}</h2>
            </div>
            <div className="relative max-w-sm w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar campanha..."
                value={searchCampaigns}
                onChange={(event) => setSearchCampaigns(event.target.value)}
              />
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha encontrada para este cliente.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm text-foreground">{campaign.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{campaign.funnel_stage || 'Sem estágio'}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {campaign.legal_status || 'Sem status jurídico'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Valor estimado: R$ {campaign.estimated_value?.toFixed(2) ?? '0.00'}</span>
                    <span>•</span>
                    <span>{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="erp">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary mb-3">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm font-semibold">Parâmetro ERP</span>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="erp-parameter">Chave ERP</Label>
                  <Input
                    id="erp-parameter"
                    value={erpParameter}
                    onChange={(event) => setErpParameter(event.target.value)}
                    placeholder="Ex: CLIENTE_12345"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="erp-notes">Notas do ERP</Label>
                  <Textarea
                    id="erp-notes"
                    value={erpNotes}
                    onChange={(event) => setErpNotes(event.target.value)}
                    placeholder="Instruções ou tags específicas para o ERP"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => updateCompany.mutate({ erp_parameter: erpParameter, erp_notes: erpNotes })}>
                    Salvar parâmetro
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Parâmetros atuais</p>
              <div className="mt-4 space-y-3 text-sm text-foreground">
                <p><span className="font-medium">ERP chave:</span> {erpParameter || 'Nenhum definido'}</p>
                <p><span className="font-medium">Notas:</span> {erpNotes || 'Nenhuma nota'}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
