import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, MoreVertical,
  ExternalLink, FileText, Loader2, Edit2, Trash2, X, Filter
} from 'lucide-react';
import { NewCompanyModal } from '@/components/companies/NewCompanyModal';
import { EditCompanyModal } from '@/components/companies/EditCompanyModal';
import { DeleteCompanyModal } from '@/components/companies/DeleteCompanyModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CompanyStatus, COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '@/lib/company-constants';

interface Company {
  id: string;
  name: string;
  document: string | null;
  status: string;
  asaas_customer_id: string | null;
  created_at: string;
}

const FILTERS_KEY = 'vertos_companies_filters';

interface CompanyFilters {
  search: string;
  statuses: CompanyStatus[];
  hasAsaas: boolean | null;
}

const DEFAULT_FILTERS: CompanyFilters = { search: '', statuses: [], hasAsaas: null };

function loadFilters(): CompanyFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FILTERS };
}

const ALL_STATUSES: CompanyStatus[] = ['lead', 'ativo', 'inativo', 'suspenso'];

export default function Companies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CompanyFilters>(loadFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  const updateFilter = useCallback(<K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleStatus = useCallback((status: CompanyStatus) => {
    setFilters(prev => {
      const exists = prev.statuses.includes(status);
      return {
        ...prev,
        statuses: exists ? prev.statuses.filter(s => s !== status) : [...prev.statuses, status],
      };
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  const hasActiveFilters = filters.search !== '' || filters.statuses.length > 0 || filters.hasAsaas !== null;

  const { data: companies = [], isLoading: loading, isError } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, document, status, asaas_customer_id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Company[];
    },
  });

  const handleSaveCompany = () => {
    setEditingCompany(null);
    setDeletingCompany(null);
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  };

  const filteredCompanies = companies.filter(company => {
    const q = filters.search.toLowerCase();
    if (q && !company.name.toLowerCase().includes(q) && !(company.document || '').includes(q)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(company.status as CompanyStatus)) return false;
    if (filters.hasAsaas === true && !company.asaas_customer_id) return false;
    if (filters.hasAsaas === false && company.asaas_customer_id) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const key = status as CompanyStatus;
    const label = COMPANY_STATUS_LABELS[key] || status;
    const colorClass = COMPANY_STATUS_COLORS[key] || 'bg-gray-500/20 text-gray-400';
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>{label}</span>;
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-destructive text-sm">Erro ao carregar empresas.</p>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['companies'] })}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie todos os clientes da Vertos.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Painel de filtros (persiste no localStorage) */}
      <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou CNPJ..."
              className="pl-9 h-8 text-sm"
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
            />
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {ALL_STATUSES.map(status => {
              const active = filters.statuses.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-transparent text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                  }`}
                >
                  {COMPANY_STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Filtro Asaas */}
          <button
            onClick={() => updateFilter('hasAsaas', filters.hasAsaas === true ? null : true)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
              filters.hasAsaas === true
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
            }`}
          >
            Com Asaas
          </button>

          {/* Limpar + Contador */}
          <div className="flex items-center gap-3 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </button>
            )}
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Tags de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Ativos:</span>
            {filters.search && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                "{filters.search}"
                <button onClick={() => updateFilter('search', '')} className="hover:text-primary/70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {filters.statuses.map(s => (
              <span key={s} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                {COMPANY_STATUS_LABELS[s]}
                <button onClick={() => toggleStatus(s)} className="hover:text-primary/70"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {filters.hasAsaas !== null && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                {filters.hasAsaas ? 'Com Asaas' : 'Sem Asaas'}
                <button onClick={() => updateFilter('hasAsaas', null)} className="hover:text-primary/70"><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters
                    ? 'Nenhuma empresa corresponde aos filtros ativos.'
                    : 'Nenhuma empresa encontrada.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map(company => (
                <TableRow key={company.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {company.name.charAt(0)}
                      </div>
                      <span className="font-medium text-foreground">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.document || '—'}</TableCell>
                  <TableCell>{getStatusBadge(company.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(`/companies/${company.id}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Abrir Workspace
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => navigate(`/companies/${company.id}/profile`)}>
                          <ExternalLink className="h-4 w-4 mr-2" /> Abrir Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => navigate(`/companies/${company.id}/contracts`)}>
                          <FileText className="h-4 w-4 mr-2" /> Ver Contratos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setEditingCompany(company)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDeletingCompany(company)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewCompanyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCompany} />
      <EditCompanyModal isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} onSave={handleSaveCompany} company={editingCompany} />
      <DeleteCompanyModal isOpen={!!deletingCompany} onClose={() => setDeletingCompany(null)} onSave={handleSaveCompany} company={deletingCompany} />
    </div>
  );
}
