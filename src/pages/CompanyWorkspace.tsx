import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, CheckCircle2, ClipboardList, FileText,
  Search, SlidersHorizontal, Sparkles, BarChart2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  asaas_customer_id: string | null;
  custom_data: Json;
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

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  due_date: string;
  category: string | null;
}

const statusLabels: Record<string, string> = {
  ativo: 'Cliente Ativo',
  'stand-by': 'Stand-by',
  inativo: 'Inativo',
  cancelado: 'Cancelado',
  active: 'Cliente Ativo',
  lead: 'Lead',
  churn: 'Cancelado',
};

const FUNNEL_COLORS: Record<string, string> = {
  prospect: '#6366f1',
  negotiation: '#3b82f6',
  legal: '#f59e0b',
  closed: '#10b981',
};

const FUNNEL_LABELS: Record<string, string> = {
  prospect: 'Prospecção',
  negotiation: 'Negociação',
  legal: 'Jurídico',
  closed: 'Fechado',
};

export default function CompanyWorkspace() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'metrics' | 'improvements' | 'erp'>('overview');
  const [searchCampaigns, setSearchCampaigns] = useState('');
  const [erpParameter, setErpParameter] = useState('');
  const [erpNotes, setErpNotes] = useState('');

  const { data: company, isLoading: isLoadingCompany, isError: isErrorCompany } = useQuery<Company>({
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

  const { data: campaigns = [], isLoading: isLoadingCampaigns, isError: isErrorCampaigns } = useQuery<Lead[]>({
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

  const { data: tasks = [], isLoading: isLoadingTasks, isError: isErrorTasks } = useQuery<Task[]>({
    queryKey: ['company-tasks', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_date, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
    enabled: !!companyId,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['company-transactions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, type, amount, status, due_date, category')
        .eq('company_id', companyId)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Transaction[];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (company) {
      const data = (company.custom_data ?? {}) as Record<string, unknown>;
      setErpParameter((data.erp_parameter as string) ?? '');
      setErpNotes((data.erp_notes as string) ?? '');
    }
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: async (payload: { erp_parameter: string; erp_notes: string }) => {
      if (!companyId) throw new Error('ID de empresa não encontrado');
      const currentData = (company?.custom_data ?? {}) as Record<string, unknown>;
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
    return campaigns.filter(
      c => c.title.toLowerCase().includes(term) ||
        (c.funnel_stage?.toLowerCase().includes(term) ?? false) ||
        (c.legal_status?.toLowerCase().includes(term) ?? false),
    );
  }, [campaigns, searchCampaigns]);

  const totalRevenue = useMemo(
    () => campaigns.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0),
    [campaigns],
  );

  // --- Métricas calculadas ---
  const metrics = useMemo(() => {
    const totalPaid = transactions
      .filter(t => t.type === 'income' && t.status === 'paid')
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const totalPending = transactions
      .filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const tasksDone = tasks.filter(t => t.status === 'concluido').length;
    const tasksPending = tasks.filter(t => t.status !== 'concluido').length;
    const completionRate = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;

    const funnelData = ['prospect', 'negotiation', 'legal', 'closed'].map(stage => ({
      name: FUNNEL_LABELS[stage],
      value: campaigns.filter(c => c.funnel_stage === stage).length,
      fill: FUNNEL_COLORS[stage],
    })).filter(d => d.value > 0);

    // Receita por mês (últimos 6 meses)
    const months: string[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(d.toISOString().substring(0, 7));
    }
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const revenueByMonth = months.map(m => {
      const [y, mo] = m.split('-');
      const monthTx = transactions.filter(t => t.due_date?.substring(0, 7) === m);
      return {
        name: monthLabels[Number(mo) - 1],
        receita: monthTx.filter(t => t.type === 'income' && t.status === 'paid').reduce((a, t) => a + Number(t.amount), 0),
        pendente: monthTx.filter(t => t.type === 'income' && t.status !== 'paid').reduce((a, t) => a + Number(t.amount), 0),
      };
    });

    return { totalPaid, totalPending, tasksDone, tasksPending, completionRate, funnelData, revenueByMonth };
  }, [transactions, tasks, campaigns]);

  // --- GERA RELATÓRIO ---
  const generateReport = () => {
    if (!company) return;

    const lines: string[] = [
      `RELATÓRIO DO CLIENTE: ${company.name}`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      `Status: ${statusLabels[company.status] ?? company.status}`,
      `CNPJ/CPF: ${company.document ?? 'Não informado'}`,
      `Cadastrado em: ${new Date(company.created_at).toLocaleDateString('pt-BR')}`,
      '',
      '=== FINANCEIRO ===',
      `Receita recebida: R$ ${metrics.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `A receber: R$ ${metrics.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `Total transações: ${transactions.length}`,
      '',
      '=== CAMPANHAS / CRM ===',
      `Total de campanhas: ${campaigns.length}`,
      `Valor estimado total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ...campaigns.map(c =>
        `  - [${FUNNEL_LABELS[c.funnel_stage ?? ''] ?? c.funnel_stage ?? 'sem estágio'}] ${c.title} — R$ ${Number(c.estimated_value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ),
      '',
      '=== TAREFAS ===',
      `Total: ${tasks.length} | Concluídas: ${metrics.tasksDone} | Pendentes: ${metrics.tasksPending} | Taxa: ${metrics.completionRate}%`,
      ...tasks.map(t =>
        `  - [${t.status ?? 'sem status'}] ${t.title}${t.due_date ? ` — vence ${new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}`
      ),
      '',
      '=== ERP ===',
      `Chave ERP: ${erpParameter || 'Não definido'}`,
      `Notas: ${erpNotes || 'Nenhuma'}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${company.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório gerado!');
  };

  const statusText = company?.status ? (statusLabels[company.status] ?? company.status) : 'Sem status';

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Briefcase className="h-5 w-5" />
            <span className="uppercase tracking-[0.25em] text-xs font-semibold">Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-2">{company.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Campanhas, tarefas, métricas e parâmetros ERP.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/companies">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button variant="outline" onClick={generateReport} className="gap-2">
            <Download className="h-4 w-4" /> Gerar Relatório
          </Button>
          <Button onClick={() => setActiveTab('erp')}>Parâmetros ERP</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Status</p>
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
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Receita Recebida</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            R$ {metrics.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="improvements">Diagnóstico IA</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
        </TabsList>

        {/* ====== RESUMO ====== */}
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
                <p><span className="font-medium text-foreground">Campanhas ativas:</span> {campaigns.filter(c => c.funnel_stage !== 'closed').length}</p>
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
                {tasks.slice(0, 4).map(task => (
                  <div key={task.id} className="rounded-2xl border border-border p-4">
                    <p className="font-medium text-sm text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{task.description || 'Sem descrição'}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.status || 'Sem status'}</span>
                      <span>{task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ====== CAMPANHAS ====== */}
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
                onChange={e => setSearchCampaigns(e.target.value)}
              />
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha encontrada para este cliente.
            </div>
          ) : (
            <div className="grid gap-4 mt-4">
              {filteredCampaigns.map(campaign => (
                <div key={campaign.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm text-foreground">{campaign.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{FUNNEL_LABELS[campaign.funnel_stage ?? ''] ?? campaign.funnel_stage ?? 'Sem estágio'}</p>
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

        {/* ====== MÉTRICAS ====== */}
        <TabsContent value="metrics">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" /> Métricas do Cliente
            </h2>

            {/* KPI financeiros */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">Receita Recebida</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  R$ {metrics.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="text-xl font-bold text-amber-600 mt-1">
                  R$ {metrics.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
                <p className="text-xl font-bold text-blue-600 mt-1">{metrics.completionRate}%</p>
                <p className="text-xs text-muted-foreground">{metrics.tasksDone} de {tasks.length} tarefas</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">Valor Pipeline</p>
                <p className="text-xl font-bold text-violet-600 mt-1">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Gráfico receita por mês */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Receita por Mês (últimos 6 meses)</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.revenueByMonth} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={v => `R$${v / 1000}k`} />
                      <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, undefined]} contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(var(--card))' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontSize: 12 }} />
                      <Bar name="Pago" dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar name="Pendente" dataKey="pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Funil de campanhas */}
            {metrics.funnelData.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-4">Distribuição do Funil de Campanhas</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={metrics.funnelData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={11}>
                        {metrics.funnelData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Campanhas']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tarefas */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-3">Status das Tarefas</p>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {[
                    { status: 'concluido', label: 'Concluídas', color: 'bg-emerald-500' },
                    { status: 'em_progresso', label: 'Em Progresso', color: 'bg-blue-500' },
                    { status: 'a_receber', label: 'A Fazer', color: 'bg-slate-400' },
                  ].map(({ status, label, color }) => {
                    const count = tasks.filter(t => t.status === status).length;
                    const pct = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ====== DIAGNÓSTICO IA ====== */}
        <TabsContent value="improvements">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Diagnóstico com IA</h2>
              <p className="text-sm text-muted-foreground">Análise inteligente baseada no desempenho e histórico do cliente</p>
            </div>

            <div className="grid gap-4">
              {campaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">Sem campanhas para análise. Cadastre campanhas para receber recomendações.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border bg-blue-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Otimização de Campanha</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {campaigns.length > 2
                            ? `Com ${campaigns.length} campanhas ativas, considere consolidar esforços nas 3 melhores oportunidades para maximizar ROI.`
                            : `Você tem ${campaigns.length} campanha(s). Recomenda-se aumentar o portfolio para melhor diversificação de risco.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-green-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Acompanhamento de Receita</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Valor estimado total: R$ {totalRevenue.toFixed(2)}.{' '}
                          {totalRevenue > 50000
                            ? ' Este é um cliente de alto valor. Recomenda-se atendimento VIP com revisões trimestrais.'
                            : ' Há potencial para aumento. Identifique oportunidades cross-sell.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {metrics.totalPending > 0 && (
                    <div className="rounded-2xl border border-border bg-amber-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">Cobranças Pendentes</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            R$ {metrics.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em aberto. Acesse o Financeiro para regularizar ou gerar cobranças.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border bg-purple-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Saúde do Pipeline</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {campaigns.filter(c => c.funnel_stage === 'closed').length > 0
                            ? 'Existem oportunidades fechadas! Considere fazer follow-up para novos projetos.'
                            : 'Todas as campanhas estão em andamento. Mantenha o ritmo e agende reviews semanais.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {metrics.completionRate < 50 && tasks.length > 0 && (
                    <div className="rounded-2xl border border-border bg-orange-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">Taxa de Conclusão Baixa</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Apenas {metrics.completionRate}% das tarefas foram concluídas. Revise prioridades e redistributa atividades.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tasks.length === 0 && (
                    <div className="rounded-2xl border border-border bg-orange-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">Falta de Tarefas Planejadas</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Não há tarefas vinculadas a este cliente. Crie um plano de ação com marcos e deliverables claros.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ====== ERP ====== */}
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
                    onChange={e => setErpParameter(e.target.value)}
                    placeholder="Ex: CLIENTE_12345"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="erp-notes">Notas do ERP</Label>
                  <Textarea
                    id="erp-notes"
                    value={erpNotes}
                    onChange={e => setErpNotes(e.target.value)}
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
