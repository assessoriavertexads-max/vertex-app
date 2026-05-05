import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, ClipboardList, FileText,
  Search, SlidersHorizontal, Sparkles, BarChart2, Download,
  RefreshCw, TrendingUp, MousePointerClick, Eye, DollarSign,
  Users, Loader2, AlertCircle, Image as ImageIcon, Play, ShoppingBag,
  CheckCircle2, Calendar,
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

// ── Google Ads types ──────────────────────────────────────────────────────
interface GoogleAdsInsights {
  impressions: number; clicks: number; cost: number; ctr: number;
  avg_cpc: number; avg_cpm: number; conversions: number; conversion_value: number; roas: number;
}
interface GoogleAdsCampaign {
  id: string; name: string; status: string; channel_type: string;
  insights: Omit<GoogleAdsInsights, 'roas'>;
}
interface GoogleAdsData {
  customer_id: string; date_range: string;
  account_totals: GoogleAdsInsights;
  campaigns: GoogleAdsCampaign[];
}

// ── Meta Ads types ────────────────────────────────────────────────────────
interface MetaInsights {
  impressions: number; reach: number; clicks: number;
  ctr: number; cpm: number; cpc: number; spend: number;
  conversions: number; conversion_value: number; roas: number;
  link_clicks: number; leads: number; video_views?: number; frequency?: number;
}

interface MetaCampaign {
  id: string; name: string; status: string; objective: string | null;
  daily_budget: number | null; lifetime_budget: number | null;
  start_time: string | null; stop_time: string | null;
  insights: MetaInsights;
}

interface MetaCreative {
  id: string | null; title: string | null; body: string | null;
  call_to_action: string | null; image_url: string | null;
  thumbnail_url: string | null; video_id: string | null;
}

interface MetaAd {
  id: string; name: string; status: string;
  campaign_id: string; adset_id: string;
  creative: MetaCreative;
  insights: Omit<MetaInsights, 'conversion_value' | 'roas' | 'video_views' | 'frequency'>;
}

interface MetaData {
  date_preset: string;
  account_totals: MetaInsights;
  campaigns: MetaCampaign[];
  ads: MetaAd[];
}

// ── Company ────────────────────────────────────────────────────────────────
interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  asaas_customer_id: string | null;
  phone: string | null;
  email: string | null;
  meta_ad_account_id: string | null;
  google_ad_account_id: string | null;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'google-ads' | 'metrics' | 'improvements' | 'history' | 'erp'>('overview');
  const [searchCampaigns, setSearchCampaigns] = useState('');
  const [metaDatePreset, setMetaDatePreset] = useState('last_30d');
  const [metaView, setMetaView] = useState<'campaigns' | 'ads'>('campaigns');
  const [googleDateRange, setGoogleDateRange] = useState('LAST_30_DAYS');
  const [erpParameter, setErpParameter] = useState('');
  const [erpNotes, setErpNotes] = useState('');

  const { data: company, isLoading: isLoadingCompany, isError: isErrorCompany } = useQuery<Company>({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) throw new Error('ID de empresa não encontrado');
      const { data, error } = await supabase
        .from('companies')
        .select('*')
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
        .select('id, name, description, status, due_date, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Map name → title for compatibility
      return (data || []).map((t: Record<string, unknown>) => ({ ...t, title: t.name })) as unknown as Task[];
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

  // Meta Ads
  const metaAccountId = company?.meta_ad_account_id ?? null;
  const {
    data: metaData,
    isLoading: loadingMeta,
    isError: metaError,
    error: metaQueryError,
    refetch: refetchMeta,
  } = useQuery<MetaData>({
    queryKey: ['meta-ads', companyId, metaDatePreset, metaAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads-proxy', {
        body: { ad_account_id: metaAccountId, date_preset: metaDatePreset },
      });
      if (error) {
        const ctx = (error as { context?: { error?: string } })?.context;
        const msg = ctx?.error ?? (error as { message?: string })?.message ?? 'Erro ao conectar com a função';
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as MetaData;
    },
    enabled: !!metaAccountId && (activeTab === 'campaigns' || activeTab === 'improvements'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Google Ads
  const googleAccountId = company?.google_ad_account_id ?? null;
  const {
    data: googleData,
    isLoading: loadingGoogle,
    isError: googleError,
    error: googleQueryError,
    refetch: refetchGoogle,
  } = useQuery<GoogleAdsData>({
    queryKey: ['google-ads', companyId, googleDateRange, googleAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-ads-proxy', {
        body: { customer_id: googleAccountId, date_range: googleDateRange },
      });
      if (error) {
        const ctx = (error as { context?: { error?: string } })?.context;
        const msg = ctx?.error ?? (error as { message?: string })?.message ?? 'Erro ao conectar com a função';
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as GoogleAdsData;
    },
    enabled: !!googleAccountId && activeTab === 'google-ads',
    staleTime: 5 * 60 * 1000,
    retry: 1,
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

  // --- DIAGNÓSTICO IA ---
  const aiInsights = useMemo(() => {
    const result: { level: 'alta' | 'media' | 'baixa'; type: string; color: string; title: string; desc: string }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // Financeiro
    const overdueTx = transactions.filter(t => t.type === 'income' && t.status === 'pending' && t.due_date < todayStr);
    const overdueAmt = overdueTx.reduce((a, t) => a + Number(t.amount), 0);
    if (overdueAmt > 0) {
      result.push({ level: 'alta', type: 'alerta', color: 'red', title: `R$ ${fmt(overdueAmt)} em atraso`, desc: `${overdueTx.length} cobrança(s) vencida(s). Acesse Financeiro → Cobrança Personalizada para notificar o cliente.` });
    }
    const collRate = metrics.totalPaid + metrics.totalPending > 0 ? (metrics.totalPaid / (metrics.totalPaid + metrics.totalPending)) * 100 : 100;
    if (collRate < 70 && metrics.totalPending > 500) {
      result.push({ level: 'media', type: 'alerta', color: 'amber', title: `Taxa de recebimento: ${collRate.toFixed(0)}%`, desc: `${(100 - collRate).toFixed(0)}% da receita ainda está pendente. Considere automatizar cobranças.` });
    }

    // Tarefas
    const overdueTasks = tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'concluido');
    if (overdueTasks.length > 0) {
      result.push({ level: 'alta', type: 'alerta', color: 'orange', title: `${overdueTasks.length} tarefa(s) com prazo vencido`, desc: `Prazos ultrapassados. Revise ou redistribua as atividades pendentes.` });
    }
    if (metrics.completionRate < 60 && tasks.length >= 3) {
      result.push({ level: 'media', type: 'sugestão', color: 'amber', title: `Conclusão de tarefas: ${metrics.completionRate}%`, desc: `Apenas ${metrics.tasksDone}/${tasks.length} tarefas concluídas. Revise as prioridades.` });
    }
    if (tasks.length === 0) {
      result.push({ level: 'media', type: 'sugestão', color: 'blue', title: 'Sem tarefas planejadas', desc: 'Crie um plano de ação com marcos e entregas claras para este cliente.' });
    }

    // Meta Ads
    if (metaData && metaData.account_totals.spend > 0) {
      const t = metaData.account_totals;
      if (t.roas < 1) {
        result.push({ level: 'alta', type: 'alerta', color: 'red', title: `ROAS negativo (${t.roas.toFixed(2)}x)`, desc: `Retorno abaixo do investimento. Revise segmentação e criativos urgentemente.` });
      } else if (t.roas < 2) {
        result.push({ level: 'media', type: 'sugestão', color: 'amber', title: `ROAS abaixo do benchmark (${t.roas.toFixed(2)}x)`, desc: `Meta recomendada: 3x+. Teste novos criativos e audiências.` });
      } else if (t.roas >= 4) {
        result.push({ level: 'baixa', type: 'oportunidade', color: 'green', title: `Excelente ROAS: ${t.roas.toFixed(2)}x`, desc: `Performance sólida. Escale o orçamento nas campanhas de maior desempenho.` });
      }
      if (t.ctr < 1 && t.impressions > 5000) {
        result.push({ level: 'media', type: 'sugestão', color: 'amber', title: `CTR baixo: ${t.ctr.toFixed(2)}%`, desc: `Benchmark: 1-2%. Teste novos títulos e imagens nos anúncios.` });
      }
      if (t.conversions === 0 && t.spend > 500) {
        result.push({ level: 'alta', type: 'alerta', color: 'red', title: 'Sem conversões registradas', desc: `R$ ${fmt(t.spend)} investido sem conversões. Verifique o pixel de conversão e a landing page.` });
      }
      if (metaData.campaigns.length > 1) {
        const sorted = [...metaData.campaigns].sort((a, b) => b.insights.roas - a.insights.roas);
        const best = sorted[0];
        if (best.insights.roas >= 3) {
          result.push({ level: 'baixa', type: 'oportunidade', color: 'green', title: `Campanha destaque: ${best.name.substring(0, 40)}`, desc: `ROAS: ${best.insights.roas.toFixed(2)}x. Considere aumentar o orçamento desta campanha.` });
        }
        const worst = sorted[sorted.length - 1];
        if (worst.insights.spend > 0 && worst.insights.roas < 0.5 && sorted.length > 1) {
          result.push({ level: 'alta', type: 'alerta', color: 'red', title: `Campanha com baixo retorno: ${worst.name.substring(0, 35)}`, desc: `ROAS de ${worst.insights.roas.toFixed(2)}x. Considere pausar ou revisar criativos.` });
        }
      }
    } else if (metaAccountId && !metaData) {
      result.push({ level: 'baixa', type: 'sugestão', color: 'blue', title: 'Carregue os dados do Meta Ads', desc: 'Acesse a aba "Meta Ads" para analisar a performance das campanhas.' });
    } else if (!metaAccountId) {
      result.push({ level: 'baixa', type: 'sugestão', color: 'blue', title: 'Meta Ads não conectado', desc: 'Configure o Ad Account ID no Perfil para receber insights de anúncios.' });
    }

    // Positivos
    if (overdueAmt === 0 && metrics.totalPaid > 0) {
      result.push({ level: 'baixa', type: 'oportunidade', color: 'green', title: 'Financeiro em dia!', desc: `R$ ${fmt(metrics.totalPaid)} recebido sem inadimplências.` });
    }
    if (metrics.completionRate === 100 && tasks.length >= 3) {
      result.push({ level: 'baixa', type: 'oportunidade', color: 'green', title: 'Todas as tarefas concluídas!', desc: 'Ótimo trabalho! Certifique-se de planejar as próximas entregas.' });
    }

    if (result.length === 0) {
      result.push({ level: 'baixa', type: 'oportunidade', color: 'green', title: 'Cliente em boa situação!', desc: 'Nenhum alerta ou ação urgente no momento. Continue acompanhando.' });
    }

    const order = { alta: 0, media: 1, baixa: 2 };
    return result.sort((a, b) => order[a.level] - order[b.level]);
  }, [transactions, tasks, metrics, metaData, metaAccountId]);

  const healthScore = useMemo(() => {
    const high = aiInsights.filter(i => i.level === 'alta' && i.type === 'alerta').length;
    const med = aiInsights.filter(i => i.level === 'media' && i.type === 'alerta').length;
    return Math.max(0, 100 - high * 20 - med * 10);
  }, [aiInsights]);

  // --- GERA RELATÓRIO PDF ---
  const generateReport = () => {
    if (!company) return;
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const txRows = transactions.map(t => `
      <tr>
        <td>${new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
        <td>${t.category || '—'}</td>
        <td>${t.type === 'income' ? 'Receita' : 'Despesa'}</td>
        <td>R$ ${fmt(Number(t.amount))}</td>
        <td class="badge ${t.status === 'paid' ? 'badge-green' : t.status === 'overdue' ? 'badge-red' : 'badge-amber'}">${t.status === 'paid' ? 'Pago' : t.status === 'overdue' ? 'Vencido' : 'Pendente'}</td>
      </tr>`).join('');

    const taskRows = tasks.map(t => `
      <tr>
        <td>${t.title || '—'}</td>
        <td class="badge ${t.status === 'concluido' ? 'badge-green' : t.status === 'em_progresso' ? 'badge-blue' : 'badge-gray'}">${t.status === 'concluido' ? 'Concluído' : t.status === 'em_progresso' ? 'Em progresso' : 'A fazer'}</td>
        <td>${t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      </tr>`).join('');

    const campaignRows = campaigns.map(c => `
      <tr>
        <td>${c.title}</td>
        <td>${FUNNEL_LABELS[c.funnel_stage ?? ''] ?? c.funnel_stage ?? '—'}</td>
        <td>R$ ${fmt(Number(c.estimated_value ?? 0))}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório — ${company.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:36px;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:18px;margin-bottom:22px}
  .logo{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}.logo span{color:#6366f1}
  .co-name{font-size:20px;font-weight:700;margin-top:4px}
  .sub{color:#64748b;font-size:11px;margin-top:3px}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
  .kpi-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
  .kpi-value{font-size:16px;font-weight:700;margin-top:3px}
  .green{color:#059669}.amber{color:#d97706}.red{color:#dc2626}.blue{color:#2563eb}
  .section{margin-bottom:20px}
  .section-title{font-size:12px;font-weight:700;margin-bottom:8px;border-left:3px solid #6366f1;padding-left:8px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f1f5f9;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}
  td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  .badge{display:inline-block;padding:2px 7px;border-radius:100px;font-size:10px;font-weight:600}
  .badge-green{background:#d1fae5;color:#065f46}.badge-amber{background:#fef3c7;color:#92400e}
  .badge-red{background:#fee2e2;color:#991b1b}.badge-blue{background:#dbeafe;color:#1e40af}
  .badge-gray{background:#f1f5f9;color:#475569}
  .footer{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;color:#94a3b8;font-size:10px;display:flex;justify-content:space-between}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">VERTEX<span>.</span>ERP</div>
    <div class="co-name">${company.name}</div>
    <div class="sub">Status: ${statusLabels[company.status] ?? company.status} · CNPJ: ${company.document ?? 'N/A'} · Desde ${new Date(company.created_at).toLocaleDateString('pt-BR')}</div>
  </div>
  <div style="text-align:right;color:#64748b;font-size:11px">
    <div>Relatório gerado em</div>
    <div style="font-weight:700;color:#0f172a">${dateStr} ${timeStr}</div>
  </div>
</div>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Receita Recebida</div><div class="kpi-value green">R$ ${fmt(metrics.totalPaid)}</div></div>
  <div class="kpi"><div class="kpi-label">A Receber</div><div class="kpi-value amber">R$ ${fmt(metrics.totalPending)}</div></div>
  <div class="kpi"><div class="kpi-label">Conclusão Tarefas</div><div class="kpi-value">${metrics.completionRate}%</div></div>
  <div class="kpi"><div class="kpi-label">Total Tarefas</div><div class="kpi-value">${tasks.length}</div></div>
</div>
${transactions.length > 0 ? `<div class="section"><div class="section-title">Histórico Financeiro (${transactions.length})</div>
<table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead>
<tbody>${txRows}</tbody></table></div>` : ''}
${tasks.length > 0 ? `<div class="section"><div class="section-title">Tarefas (${tasks.length})</div>
<table><thead><tr><th>Tarefa</th><th>Status</th><th>Vencimento</th></tr></thead>
<tbody>${taskRows}</tbody></table></div>` : ''}
${campaigns.length > 0 ? `<div class="section"><div class="section-title">Campanhas / CRM (${campaigns.length}) · Pipeline: R$ ${fmt(totalRevenue)}</div>
<table><thead><tr><th>Campanha</th><th>Estágio</th><th>Valor Estimado</th></tr></thead>
<tbody>${campaignRows}</tbody></table></div>` : ''}
${erpParameter ? `<div class="section"><div class="section-title">ERP</div>
<table><tbody>
  <tr><td style="font-weight:600;width:140px">Chave ERP</td><td>${erpParameter}</td></tr>
  ${erpNotes ? `<tr><td style="font-weight:600">Notas</td><td>${erpNotes}</td></tr>` : ''}
</tbody></table></div>` : ''}
<div class="footer"><span>VERTEX ERP · ${company.name}</span><span>Gerado em ${dateStr} ${timeStr}</span></div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    toast.success('Relatório aberto para impressão / salvar como PDF!');
  };

  const statusText = company?.status ? (statusLabels[company.status] ?? company.status) : 'Sem status';

  if (isLoadingCompany) {
    return <div className="flex items-center justify-center h-64">Carregando workspace do cliente...</div>;
  }

  if (isErrorCompany || !company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">Erro ao carregar o workspace do cliente. Tente novamente.</p>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['company', companyId] })}>
          Tentar novamente
        </Button>
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
          <TabsTrigger value="history">Vendas</TabsTrigger>
          <TabsTrigger value="campaigns">Meta Ads</TabsTrigger>
          <TabsTrigger value="google-ads">Google Ads</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="improvements">Diagnóstico IA</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
        </TabsList>

        {/* ====== RESUMO ====== */}
        <TabsContent value="overview">
          <div className="space-y-5">
            {/* Dados cadastrais */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Dados do Cliente
                </p>
                <button
                  className="text-xs text-primary underline underline-offset-2"
                  onClick={() => navigate(`/companies/${companyId}/profile`)}
                >
                  Editar →
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CNPJ / CPF', value: company.document },
                  { label: 'Email', value: company.email },
                  { label: 'Telefone / WhatsApp', value: company.phone },
                  { label: 'Asaas ID', value: company.asaas_customer_id, mono: true },
                  { label: 'Cadastrado em', value: new Date(company.created_at).toLocaleDateString('pt-BR') },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-medium text-foreground mt-0.5 truncate ${item.mono ? 'font-mono' : ''}`}>
                      {item.value || <span className="text-muted-foreground font-normal">Não informado</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mídias pagas */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Mídias Pagas
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-600">f</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Meta Ads</p>
                    <p className={`text-xs font-mono truncate ${company.meta_ad_account_id ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {company.meta_ad_account_id || 'Não conectado'}
                    </p>
                  </div>
                  {company.meta_ad_account_id && <span className="ml-auto w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-red-500">G</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Google Ads</p>
                    <p className={`text-xs font-mono truncate ${company.google_ad_account_id ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {company.google_ad_account_id || 'Não conectado'}
                    </p>
                  </div>
                  {company.google_ad_account_id && <span className="ml-auto w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                </div>
              </div>
            </div>

            {/* Tarefas recentes */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary mb-3">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-semibold">Tarefas recentes</span>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem tarefas vinculadas a este cliente.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.slice(0, 4).map(task => (
                    <div key={task.id} className="rounded-xl border border-border p-3">
                      <p className="font-medium text-sm text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description || 'Sem descrição'}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.status || 'Sem status'}</span>
                        <span>{task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ====== HISTÓRICO DE VENDAS ====== */}
        <TabsContent value="history">
          {(() => {
            const closedDeals = campaigns.filter(c => c.funnel_stage === 'closed');
            const totalSold = closedDeals.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);
            const paidIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid');
            const totalReceived = paidIncome.reduce((sum, t) => sum + Number(t.amount), 0);
            const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

            return (
              <div className="space-y-5">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs text-emerald-600 font-medium">Contratos Fechados</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{closedDeals.length}</p>
                    <p className="text-xs text-emerald-600 mt-1">R$ {fmt(totalSold)} em pipeline</p>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <p className="text-xs text-blue-600 font-medium">Receita Recebida</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">R$ {fmt(totalReceived)}</p>
                    <p className="text-xs text-blue-600 mt-1">{paidIncome.length} cobranças pagas</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 col-span-2 md:col-span-1">
                    <p className="text-xs text-muted-foreground font-medium">Ticket Médio</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      R$ {closedDeals.length > 0 ? fmt(totalSold / closedDeals.length) : '0,00'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">por serviço fechado</p>
                  </div>
                </div>

                {/* Linha do tempo de serviços vendidos */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Serviços Vendidos / Contratos</p>
                  </div>

                  {closedDeals.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto" />
                      <p className="text-sm font-medium text-foreground">Nenhum contrato fechado ainda</p>
                      <p className="text-xs text-muted-foreground">Mova leads para "Fechado (Ganho)" no CRM para registrar aqui.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {closedDeals.map(deal => (
                        <div key={deal.id} className="flex items-start gap-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                          <div className="mt-0.5 shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">{deal.title}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(deal.created_at + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {deal.legal_status && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                  {deal.legal_status}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold text-emerald-700 text-sm">
                              R$ {fmt(Number(deal.estimated_value ?? 0))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">estimado</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cobranças pagas */}
                {paidIncome.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Pagamentos Recebidos</p>
                    </div>
                    <div className="space-y-2">
                      {paidIncome.slice(0, 10).map(t => (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm text-foreground">{t.category || 'Sem descrição'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <p className="font-semibold text-emerald-600 text-sm">R$ {fmt(Number(t.amount))}</p>
                        </div>
                      ))}
                      {paidIncome.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{paidIncome.length - 10} pagamentos anteriores
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* ====== CAMPANHAS META ADS ====== */}
        <TabsContent value="campaigns">
          {!metaAccountId ? (
            // Sem conta vinculada
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-blue-600">f</span>
              </div>
              <p className="font-semibold text-foreground">Meta Ads não conectado</p>
              <p className="text-sm text-muted-foreground">
                Acesse o <strong>Perfil da Empresa</strong> e insira o Ad Account ID para sincronizar campanhas.
              </p>
              <button
                className="text-sm text-blue-600 underline underline-offset-2"
                onClick={() => navigate(`/companies/${companyId}/profile`)}
              >
                Ir para o Perfil →
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Controles */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">f</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">Meta Ads</span>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {metaAccountId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Período */}
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none"
                    value={metaDatePreset}
                    onChange={e => setMetaDatePreset(e.target.value)}
                  >
                    <option value="today">Hoje</option>
                    <option value="yesterday">Ontem</option>
                    <option value="last_7d">Últimos 7 dias</option>
                    <option value="last_14d">Últimos 14 dias</option>
                    <option value="last_30d">Últimos 30 dias</option>
                    <option value="last_90d">Últimos 90 dias</option>
                    <option value="this_month">Este mês</option>
                    <option value="last_month">Mês passado</option>
                  </select>
                  {/* Campanhas / Anúncios */}
                  <div className="flex p-0.5 bg-muted rounded-lg">
                    {(['campaigns', 'ads'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setMetaView(v)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${metaView === v ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
                      >
                        {v === 'campaigns' ? 'Campanhas' : 'Anúncios'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => refetchMeta()}
                    disabled={loadingMeta}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingMeta ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingMeta ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Buscando dados do Meta Ads...</span>
                </div>
              ) : metaError || !metaData ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
                  <AlertCircle className="h-6 w-6 text-red-500 mx-auto" />
                  <p className="text-sm font-medium text-red-700">Erro ao buscar dados do Meta Ads</p>
                  {metaQueryError instanceof Error && metaQueryError.message ? (
                    <p className="text-xs text-red-600 font-mono bg-red-100 rounded px-2 py-1 max-w-sm mx-auto break-words">
                      {metaQueryError.message}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600">Verifique se o Ad Account ID está correto e se o META_ACCESS_TOKEN está configurado nos secrets do Supabase.</p>
                  )}
                  <button onClick={() => refetchMeta()} className="text-xs text-red-600 underline">Tentar novamente</button>
                </div>
              ) : (
                <>
                  {/* KPIs totais da conta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                      { label: 'Investido', value: `R$ ${metaData.account_totals.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-red-500' },
                      { label: 'Alcance', value: metaData.account_totals.reach.toLocaleString('pt-BR'), icon: Users, color: 'text-blue-500' },
                      { label: 'Impressões', value: metaData.account_totals.impressions.toLocaleString('pt-BR'), icon: Eye, color: 'text-purple-500' },
                      { label: 'Cliques', value: metaData.account_totals.clicks.toLocaleString('pt-BR'), icon: MousePointerClick, color: 'text-indigo-500' },
                      { label: 'CTR', value: `${metaData.account_totals.ctr.toFixed(2)}%`, icon: TrendingUp, color: 'text-green-500' },
                      { label: 'CPC', value: `R$ ${metaData.account_totals.cpc.toFixed(2)}`, icon: DollarSign, color: 'text-amber-500' },
                      { label: 'ROAS', value: metaData.account_totals.roas > 0 ? `${metaData.account_totals.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: 'text-emerald-500' },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                          <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        </div>
                        <p className="text-base font-bold text-foreground leading-tight">{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Conversões e Leads */}
                  {(metaData.account_totals.conversions > 0 || metaData.account_totals.leads > 0) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {metaData.account_totals.conversions > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs text-emerald-600">Conversões</p>
                          <p className="text-xl font-bold text-emerald-700">{metaData.account_totals.conversions.toLocaleString('pt-BR')}</p>
                          {metaData.account_totals.conversion_value > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">R$ {metaData.account_totals.conversion_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          )}
                        </div>
                      )}
                      {metaData.account_totals.leads > 0 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                          <p className="text-xs text-blue-600">Leads</p>
                          <p className="text-xl font-bold text-blue-700">{metaData.account_totals.leads.toLocaleString('pt-BR')}</p>
                          {metaData.account_totals.spend > 0 && metaData.account_totals.leads > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">CPL: R$ {(metaData.account_totals.spend / metaData.account_totals.leads).toFixed(2)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Campanhas */}
                  {metaView === 'campaigns' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{metaData.campaigns.length} campanha{metaData.campaigns.length !== 1 ? 's' : ''}</p>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input className="pl-8 h-8 text-xs w-52" placeholder="Buscar campanha..." value={searchCampaigns} onChange={e => setSearchCampaigns(e.target.value)} />
                        </div>
                      </div>

                      {metaData.campaigns
                        .filter(c => !searchCampaigns || c.name.toLowerCase().includes(searchCampaigns.toLowerCase()))
                        .map(campaign => (
                          <div key={campaign.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{campaign.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{campaign.objective ?? 'Sem objetivo'}</p>
                              </div>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                                campaign.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' :
                                campaign.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {campaign.status === 'ACTIVE' ? 'Ativa' : campaign.status === 'PAUSED' ? 'Pausada' : campaign.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 text-center">
                              {[
                                { label: 'Gasto', value: `R$${campaign.insights.spend.toFixed(2)}` },
                                { label: 'Alcance', value: campaign.insights.reach.toLocaleString('pt-BR') },
                                { label: 'Impressões', value: campaign.insights.impressions.toLocaleString('pt-BR') },
                                { label: 'Cliques', value: campaign.insights.clicks.toLocaleString('pt-BR') },
                                { label: 'CTR', value: `${campaign.insights.ctr.toFixed(2)}%` },
                                { label: 'CPC', value: `R$${campaign.insights.cpc.toFixed(2)}` },
                                { label: 'ROAS', value: campaign.insights.roas > 0 ? `${campaign.insights.roas.toFixed(2)}x` : '—' },
                              ].map(m => (
                                <div key={m.label} className="bg-muted/50 rounded-lg p-2">
                                  <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
                                  <p className="text-xs font-semibold text-foreground mt-0.5">{m.value}</p>
                                </div>
                              ))}
                            </div>
                            {(campaign.insights.conversions > 0 || campaign.insights.leads > 0) && (
                              <div className="flex gap-3 mt-2">
                                {campaign.insights.conversions > 0 && (
                                  <span className="text-xs text-emerald-600 font-medium">✓ {campaign.insights.conversions} conversões</span>
                                )}
                                {campaign.insights.leads > 0 && (
                                  <span className="text-xs text-blue-600 font-medium">◎ {campaign.insights.leads} leads</span>
                                )}
                              </div>
                            )}
                            {(campaign.daily_budget || campaign.lifetime_budget) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Budget: {campaign.daily_budget ? `R$ ${campaign.daily_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/dia` : `R$ ${campaign.lifetime_budget?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total`}
                              </p>
                            )}
                          </div>
                        ))}

                      {metaData.campaigns.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          Nenhuma campanha encontrada nesta conta no período selecionado.
                        </div>
                      )}

                      {metaData.campaigns.length >= 50 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center py-2">
                          Exibindo as primeiras 50 campanhas. Algumas podem não aparecer.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Lista de Anúncios / Criativos */}
                  {metaView === 'ads' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">{metaData.ads.length} anúncio{metaData.ads.length !== 1 ? 's' : ''}</p>
                      {metaData.ads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          Nenhum anúncio encontrado no período selecionado.
                        </div>
                      ) : (
                        metaData.ads.map(ad => (
                          <div key={ad.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex gap-4">
                              {/* Thumbnail */}
                              <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {ad.creative.thumbnail_url || ad.creative.image_url ? (
                                  <img
                                    src={ad.creative.thumbnail_url ?? ad.creative.image_url ?? ''}
                                    alt={ad.name}
                                    className="h-full w-full object-cover"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : ad.creative.video_id ? (
                                  <Play className="h-6 w-6 text-muted-foreground" />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm text-foreground truncate">{ad.name}</p>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                                    ad.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' :
                                    ad.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
                                  </span>
                                </div>
                                {ad.creative.title && (
                                  <p className="text-xs font-medium text-foreground mt-1 line-clamp-1">{ad.creative.title}</p>
                                )}
                                {ad.creative.body && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ad.creative.body}</p>
                                )}
                                {ad.creative.call_to_action && (
                                  <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-500/10 text-blue-600 rounded">
                                    {ad.creative.call_to_action}
                                  </span>
                                )}
                                {/* Métricas do anúncio */}
                                <div className="flex flex-wrap gap-3 mt-2">
                                  {[
                                    { label: 'Gasto', value: `R$${ad.insights.spend.toFixed(2)}` },
                                    { label: 'Alcance', value: ad.insights.reach.toLocaleString('pt-BR') },
                                    { label: 'Cliques', value: ad.insights.clicks.toLocaleString('pt-BR') },
                                    { label: 'CTR', value: `${ad.insights.ctr.toFixed(2)}%` },
                                    { label: 'CPC', value: `R$${ad.insights.cpc.toFixed(2)}` },
                                    ...(ad.insights.conversions > 0 ? [{ label: 'Conv.', value: String(ad.insights.conversions) }] : []),
                                    ...(ad.insights.leads > 0 ? [{ label: 'Leads', value: String(ad.insights.leads) }] : []),
                                  ].map(m => (
                                    <div key={m.label} className="text-center bg-muted/50 rounded px-2 py-1">
                                      <p className="text-xs text-muted-foreground leading-none">{m.label}</p>
                                      <p className="text-xs font-semibold text-foreground mt-0.5">{m.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* ====== GOOGLE ADS ====== */}
        <TabsContent value="google-ads">
          {!googleAccountId ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-red-500">G</span>
              </div>
              <p className="font-semibold text-foreground">Google Ads não conectado</p>
              <p className="text-sm text-muted-foreground">
                Acesse o <strong>Perfil da Empresa</strong> e insira o Customer ID para sincronizar campanhas.
              </p>
              <button className="text-sm text-red-600 underline underline-offset-2" onClick={() => navigate(`/companies/${companyId}/profile`)}>
                Ir para o Perfil →
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Controles */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-red-500">G</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">Google Ads</span>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{googleAccountId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={googleDateRange}
                    onChange={e => setGoogleDateRange(e.target.value)}
                  >
                    <option value="TODAY">Hoje</option>
                    <option value="YESTERDAY">Ontem</option>
                    <option value="LAST_7_DAYS">Últimos 7 dias</option>
                    <option value="LAST_14_DAYS">Últimos 14 dias</option>
                    <option value="LAST_30_DAYS">Últimos 30 dias</option>
                    <option value="LAST_90_DAYS">Últimos 90 dias</option>
                    <option value="THIS_MONTH">Este mês</option>
                    <option value="LAST_MONTH">Mês passado</option>
                  </select>
                  <button
                    onClick={() => refetchGoogle()}
                    disabled={loadingGoogle}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingGoogle ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingGoogle ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Buscando dados do Google Ads...</span>
                </div>
              ) : googleError || !googleData ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
                  <AlertCircle className="h-6 w-6 text-red-500 mx-auto" />
                  <p className="text-sm font-medium text-red-700">Erro ao buscar dados do Google Ads</p>
                  {googleQueryError instanceof Error && googleQueryError.message ? (
                    <p className="text-xs text-red-600 font-mono bg-red-100 rounded px-2 py-1 max-w-sm mx-auto break-words">
                      {googleQueryError.message}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600">Verifique o Customer ID e se as credenciais OAuth estão configuradas nos secrets do Supabase.</p>
                  )}
                  <button onClick={() => refetchGoogle()} className="text-xs text-red-600 underline">Tentar novamente</button>
                </div>
              ) : (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                      { label: 'Investido', value: `R$ ${googleData.account_totals.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-red-500' },
                      { label: 'Impressões', value: googleData.account_totals.impressions.toLocaleString('pt-BR'), icon: Eye, color: 'text-purple-500' },
                      { label: 'Cliques', value: googleData.account_totals.clicks.toLocaleString('pt-BR'), icon: MousePointerClick, color: 'text-indigo-500' },
                      { label: 'CTR', value: `${googleData.account_totals.ctr.toFixed(2)}%`, icon: TrendingUp, color: 'text-green-500' },
                      { label: 'CPC Médio', value: `R$ ${googleData.account_totals.avg_cpc.toFixed(2)}`, icon: DollarSign, color: 'text-amber-500' },
                      { label: 'Conversões', value: googleData.account_totals.conversions.toLocaleString('pt-BR'), icon: Users, color: 'text-blue-500' },
                      { label: 'ROAS', value: googleData.account_totals.roas > 0 ? `${googleData.account_totals.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: 'text-emerald-500' },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                          <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        </div>
                        <p className="text-base font-bold text-foreground leading-tight">{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Campanhas */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{googleData.campaigns.length} campanha{googleData.campaigns.length !== 1 ? 's' : ''}</p>
                    {googleData.campaigns.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        Nenhuma campanha encontrada nesta conta no período selecionado.
                      </div>
                    ) : (
                      googleData.campaigns.map(campaign => (
                        <div key={campaign.id} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{campaign.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{campaign.channel_type}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                              campaign.status === 'ENABLED' ? 'bg-green-500/10 text-green-600' :
                              campaign.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {campaign.status === 'ENABLED' ? 'Ativa' : campaign.status === 'PAUSED' ? 'Pausada' : campaign.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 text-center">
                            {[
                              { label: 'Gasto', value: `R$${campaign.insights.cost.toFixed(2)}` },
                              { label: 'Impressões', value: campaign.insights.impressions.toLocaleString('pt-BR') },
                              { label: 'Cliques', value: campaign.insights.clicks.toLocaleString('pt-BR') },
                              { label: 'CTR', value: `${campaign.insights.ctr.toFixed(2)}%` },
                              { label: 'CPC', value: `R$${campaign.insights.avg_cpc.toFixed(2)}` },
                              { label: 'Conv.', value: campaign.insights.conversions.toLocaleString('pt-BR') },
                            ].map(m => (
                              <div key={m.label} className="bg-muted/50 rounded-lg p-2">
                                <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
                                <p className="text-xs font-semibold text-foreground mt-0.5">{m.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
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
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Diagnóstico com IA</h2>
                <p className="text-sm text-muted-foreground">Análise automática baseada em dados reais do cliente</p>
              </div>
              {/* Health Score */}
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <div className="relative h-12 w-12">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke={healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${(healthScore / 100) * 87.96} 87.96`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{healthScore}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saúde do Cliente</p>
                  <p className={`text-sm font-semibold ${healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {healthScore >= 80 ? 'Ótimo' : healthScore >= 60 ? 'Atenção' : 'Crítico'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {aiInsights.map((insight, i) => {
                const bgMap: Record<string, string> = { red: 'bg-red-500/5 border-red-200', orange: 'bg-orange-500/5 border-orange-200', amber: 'bg-amber-500/5 border-amber-200', blue: 'bg-blue-500/5 border-blue-200', green: 'bg-green-500/5 border-green-200' };
                const iconMap: Record<string, string> = { red: 'text-red-500', orange: 'text-orange-500', amber: 'text-amber-500', blue: 'text-blue-500', green: 'text-green-500' };
                const typeMap: Record<string, string> = { alerta: 'bg-red-100 text-red-700', sugestão: 'bg-amber-100 text-amber-700', oportunidade: 'bg-green-100 text-green-700' };
                return (
                  <div key={i} className={`rounded-xl border p-4 ${bgMap[insight.color] ?? 'border-border'}`}>
                    <div className="flex items-start gap-3">
                      <Sparkles className={`h-5 w-5 shrink-0 mt-0.5 ${iconMap[insight.color] ?? 'text-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-sm text-foreground">{insight.title}</p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${typeMap[insight.type] ?? ''}`}>
                            {insight.type}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                            {insight.level === 'alta' ? 'Alta prioridade' : insight.level === 'media' ? 'Média prioridade' : 'Baixa prioridade'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
