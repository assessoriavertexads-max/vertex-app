import { useState } from 'react';
import { useCampaignTracking, TrackingLink } from '@/hooks/useCampaignTracking';
import { SUPABASE_URL } from '@/lib/supabase';
import type { NormalizedCampaign } from '@/types/ads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Link2, Copy, Check, ChevronDown, ChevronUp,
  MousePointerClick, MessageCircle, Users, TrendingDown, TrendingUp, Plus,
} from 'lucide-react';

const TRACK_BASE = `${SUPABASE_URL}/functions/v1/track`;

function trackingUrl(token: string) {
  return `${TRACK_BASE}?t=${token}`;
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=Olá! Vi seu anúncio e gostaria de saber mais.`;
}

// ── Discrepância ─────────────────────────────────────────────────────────────
function DiscrepancyBadge({ meta, real }: { meta: number; real: number }) {
  if (meta === 0 || real === 0) return null;
  const pct = Math.round(((real - meta) / meta) * 100);
  const positive = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    }`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{pct}%
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
interface CampaignRowProps {
  campaign: NormalizedCampaign;
  link: TrackingLink | undefined;
  companyId: string;
  companyPhone: string;
  onCreated: () => void;
  onUpdated: () => void;
}

function CampaignRow({ campaign, link, companyId, companyPhone, onCreated, onUpdated }: CampaignRowProps) {
  const { createLink, updateLink } = useCampaignTracking(companyId);
  const [expanded, setExpanded]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [editing, setEditing]       = useState(false);
  const [confirmed, setConfirmed]   = useState(String(link?.confirmed_contacts ?? 0));
  const [notes, setNotes]           = useState(link?.notes ?? '');

  const metaLeads  = campaign.insights.leads  ?? 0;
  const metaClicks = campaign.insights.clicks ?? 0;
  const metaRef    = metaLeads > 0 ? metaLeads : metaClicks;
  const spend      = campaign.insights.spend;

  const cplMeta    = metaRef > 0 ? spend / metaRef : null;
  const cplLink    = link && link.link_clicks > 0 ? spend / link.link_clicks : null;
  const cplReal    = link && Number(confirmed) > 0 ? spend / Number(confirmed) : null;

  const fmtBRL = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function handleCreate() {
    if (!companyPhone) {
      toast.error('Empresa sem telefone cadastrado. Adicione em Empresas → Perfil.');
      return;
    }
    try {
      await createLink.mutateAsync({
        campaign_id:   campaign.id,
        campaign_name: campaign.name,
        platform:      campaign.platform,
        company_id:    companyId,
        whatsapp_url:  whatsappUrl(companyPhone),
      });
      toast.success('Link de rastreio criado!');
      onCreated();
    } catch (e) {
      toast.error(`Erro ao criar link: ${(e as Error).message}`);
    }
  }

  async function handleSaveConfirmed() {
    if (!link) return;
    try {
      await updateLink.mutateAsync({
        id:                  link.id,
        confirmed_contacts:  Number(confirmed) || 0,
        notes,
      });
      toast.success('Contatos confirmados salvos!');
      setEditing(false);
      onUpdated();
    } catch (e) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    }
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(trackingUrl(link.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const platformColor = campaign.platform === 'meta'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-orange-100 text-orange-700';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${platformColor}`}>
          {campaign.platform}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{campaign.name}</p>
          <p className="text-xs text-muted-foreground">{campaign.status}</p>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MousePointerClick className="w-3 h-3" />
            {metaRef > 0 ? metaRef.toLocaleString('pt-BR') : '—'} Meta
          </span>
          {link && (
            <span className="flex items-center gap-1 text-foreground font-medium">
              <Link2 className="w-3 h-3 text-primary" />
              {link.link_clicks.toLocaleString('pt-BR')} reais
            </span>
          )}
          {link && metaRef > 0 && (
            <DiscrepancyBadge meta={metaRef} real={link.link_clicks} />
          )}
        </div>

        {link ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleCopy(); }}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Copiar link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1 shrink-0"
            onClick={e => { e.stopPropagation(); handleCreate(); }}
            disabled={createLink.isPending}
          >
            <Plus className="w-3 h-3" />
            Gerar link
          </Button>
        )}

        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">

          {/* Métricas comparativas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox
              icon={<MousePointerClick className="w-4 h-4 text-emerald-500" />}
              label="Meta reportou"
              value={metaRef > 0 ? metaRef.toLocaleString('pt-BR') : '—'}
              sub={cplMeta ? `CPL ${fmtBRL(cplMeta)}` : undefined}
            />
            <MetricBox
              icon={<Link2 className="w-4 h-4 text-primary" />}
              label="Cliques no link"
              value={link ? link.link_clicks.toLocaleString('pt-BR') : '—'}
              sub={cplLink ? `CPL ${fmtBRL(cplLink)}` : undefined}
              highlight={!!link}
            />
            <MetricBox
              icon={<MessageCircle className="w-4 h-4 text-emerald-500" />}
              label="Confirmados"
              value={link ? Number(link.confirmed_contacts).toLocaleString('pt-BR') : '—'}
              sub={cplReal ? `CPL ${fmtBRL(cplReal)}` : undefined}
            />
            <MetricBox
              icon={<Users className="w-4 h-4 text-orange-500" />}
              label="Gasto no período"
              value={`R$ ${spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              sub={cplReal && cplMeta ? `${Math.round(((cplReal - cplMeta) / cplMeta) * 100)}% CPL real vs Meta` : undefined}
            />
          </div>

          {/* Link URL */}
          {link && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Link de rastreio</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate text-foreground">
                  {trackingUrl(link.token)}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 p-1.5 rounded border border-border bg-background hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este link como URL de destino no anúncio (no lugar do link direto do WhatsApp).
              </p>
            </div>
          )}

          {/* Editar contatos confirmados */}
          {link && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Contatos confirmados (manual)</p>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={confirmed}
                      onChange={e => setConfirmed(e.target.value)}
                      className="h-8 text-sm w-28"
                      placeholder="0"
                    />
                    <Input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="h-8 text-sm flex-1"
                      placeholder="Observação (opcional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveConfirmed} disabled={updateLink.isPending} className="h-7 text-xs">
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {link.confirmed_contacts}
                  </span>
                  {link.notes && (
                    <span className="text-xs text-muted-foreground italic">— {link.notes}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Metric box ────────────────────────────────────────────────────────────────
function MetricBox({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-primary/5 border border-primary/20' : 'bg-background border border-border'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface CampaignTrackerProps {
  campaigns: NormalizedCampaign[];
  companyId: string | null;
  companyPhone: string | null;
  isLoadingCampaigns?: boolean;
}

export function CampaignTracker({
  campaigns,
  companyId,
  companyPhone,
  isLoadingCampaigns,
}: CampaignTrackerProps) {
  const { data: links = [], isLoading: linksLoading, refetch } = useCampaignTracking(companyId);

  const linksByCampaign = Object.fromEntries(links.map(l => [l.campaign_id, l]));

  const totalMetaLeads    = campaigns.reduce((a, c) => a + (c.insights.leads ?? 0), 0);
  const totalMetaClicks   = campaigns.reduce((a, c) => a + c.insights.clicks, 0);
  const totalMetaRef      = totalMetaLeads > 0 ? totalMetaLeads : totalMetaClicks;
  const totalLinkClicks   = links.reduce((a, l) => a + l.link_clicks, 0);
  const totalConfirmed    = links.reduce((a, l) => a + l.confirmed_contacts, 0);
  const totalSpend        = campaigns.reduce((a, c) => a + c.insights.spend, 0);

  const isLoading = isLoadingCampaigns || linksLoading;

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <Link2 className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm font-medium">Selecione um cliente acima</p>
        <p className="text-xs text-muted-foreground">Os links de rastreio são vinculados por empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumo geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Meta reportou" value={totalMetaRef} color="text-emerald-500" />
        <SummaryCard label="Cliques reais no link" value={totalLinkClicks} color="text-primary" highlight />
        <SummaryCard label="Contatos confirmados" value={totalConfirmed} color="text-emerald-600" />
        <SummaryCard
          label="Discrepância média"
          value={totalMetaRef > 0 && totalLinkClicks > 0
            ? `${Math.round(((totalLinkClicks - totalMetaRef) / totalMetaRef) * 100)}%`
            : '—'}
          color={totalLinkClicks < totalMetaRef ? 'text-red-500' : 'text-emerald-600'}
          rawString
        />
      </div>

      {/* CPL geral */}
      {totalSpend > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Investimento total</span>
            <p className="font-bold">R$ {totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          {totalMetaRef > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">CPL segundo Meta</span>
              <p className="font-bold">R$ {(totalSpend / totalMetaRef).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {totalLinkClicks > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">CPL pelo link (real)</span>
              <p className="font-bold text-primary">R$ {(totalSpend / totalLinkClicks).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {totalConfirmed > 0 && (
            <div>
              <span className="text-muted-foreground text-xs">CPL confirmado</span>
              <p className="font-bold text-emerald-600">R$ {(totalSpend / totalConfirmed).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de campanhas */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Campanhas ({campaigns.length})
        </p>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma campanha ativa no período selecionado.
          </div>
        ) : (
          campaigns.map(c => (
            <CampaignRow
              key={c.id}
              campaign={c}
              link={linksByCampaign[c.id]}
              companyId={companyId}
              companyPhone={companyPhone ?? ''}
              onCreated={refetch}
              onUpdated={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, color, highlight, rawString,
}: {
  label: string;
  value: number | string;
  color: string;
  highlight?: boolean;
  rawString?: boolean;
}) {
  const display = rawString
    ? String(value)
    : typeof value === 'number'
    ? value.toLocaleString('pt-BR')
    : value;

  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{display}</p>
    </div>
  );
}
