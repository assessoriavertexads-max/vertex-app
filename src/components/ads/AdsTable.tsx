import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SlidersHorizontal } from 'lucide-react';
import type { NormalizedCampaign, AdColumnDef } from '@/types/ads';

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR');
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtRoas = (v: number) => (v > 0 ? `${v.toFixed(2)}×` : '—');
const fmtDec = (v: number) => v.toFixed(2);

const DEFAULT_COLUMNS: AdColumnDef[] = [
  { id: 'spend',       label: 'Investimento', visible: true,  description: 'Total gasto no período',                             formatter: fmtBRL  },
  { id: 'impressions', label: 'Impressões',   visible: true,  description: 'Número de exibições do anúncio',                    formatter: fmtInt  },
  { id: 'clicks',      label: 'Cliques',      visible: true,  description: 'Total de cliques no anúncio',                       formatter: fmtInt  },
  { id: 'ctr',         label: 'CTR',          visible: true,  description: 'Click-through rate: % de impressões que geraram clique', formatter: fmtPct  },
  { id: 'roas',        label: 'ROAS',         visible: true,  description: 'Retorno sobre investimento em anúncios (receita/gasto)', formatter: fmtRoas },
  { id: 'cpc',         label: 'CPC',          visible: false, description: 'Custo por clique médio',                            formatter: fmtBRL  },
  { id: 'cpm',         label: 'CPM',          visible: false, description: 'Custo por mil impressões',                          formatter: fmtBRL  },
  { id: 'conversions', label: 'Conversões',   visible: false, description: 'Total de conversões (compras, formulários)',         formatter: fmtInt  },
  { id: 'reach',       label: 'Alcance',      visible: false, description: 'Pessoas únicas alcançadas (somente Meta)',           formatter: fmtInt  },
  { id: 'frequency',   label: 'Frequência',   visible: false, description: 'Média de vezes que cada pessoa viu o anúncio (Meta)', formatter: fmtDec  },
  { id: 'leads',       label: 'Leads',        visible: false, description: 'Total de leads gerados (somente Meta)',              formatter: fmtInt  },
];

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'ENABLED')
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs hover:bg-green-100">Ativo</Badge>;
  if (s === 'PAUSED')
    return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs hover:bg-yellow-100">Pausado</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === 'google')
    return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs hover:bg-emerald-100">Google</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs hover:bg-emerald-100">Meta</Badge>;
}

interface AdsTableProps {
  campaigns: NormalizedCampaign[];
  isLoading?: boolean;
  hidePlatformColumn?: boolean;
}

export function AdsTable({ campaigns, isLoading, hidePlatformColumn }: AdsTableProps) {
  const [columns, setColumns] = useState<AdColumnDef[]>(DEFAULT_COLUMNS);

  const visibleCols = columns.filter((c) => c.visible);

  const toggleColumn = (id: string) =>
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhuma campanha encontrada para o período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Métricas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.visible}
                onCheckedChange={() => toggleColumn(col.id)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold min-w-[200px]">Campanha</TableHead>
              {!hidePlatformColumn && (
                <TableHead className="font-semibold w-28">Plataforma</TableHead>
              )}
              <TableHead className="font-semibold w-28">Status</TableHead>
              {visibleCols.map((col) => (
                <TableHead key={col.id} className="font-semibold text-right whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">
                        {col.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      {col.description}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow
                key={`${campaign.platform}-${campaign.id}`}
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-medium max-w-xs">
                  <span className="truncate block">{campaign.name}</span>
                </TableCell>
                {!hidePlatformColumn && (
                  <TableCell>
                    <PlatformBadge platform={campaign.platform} />
                  </TableCell>
                )}
                <TableCell>
                  <StatusBadge status={campaign.status} />
                </TableCell>
                {visibleCols.map((col) => {
                  const val = campaign.insights[col.id];
                  return (
                    <TableCell key={col.id} className="text-right tabular-nums text-sm">
                      {val != null ? (
                        col.formatter(val as number)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
