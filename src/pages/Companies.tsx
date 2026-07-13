import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, MoreVertical,
  ExternalLink, FileText, Loader2, Edit2, Trash2
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

export default function Companies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

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

  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.document || '').includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    const statusKey = status as CompanyStatus;
    const label = COMPANY_STATUS_LABELS[statusKey] || status;
    const colorClass = COMPANY_STATUS_COLORS[statusKey] || 'bg-gray-500/20 text-gray-400';
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

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredCompanies.length} empresas encontradas
        </span>
      </div>

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
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map((company) => (
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
