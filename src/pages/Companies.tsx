import { useState } from 'react';
import { 
  Search, Plus, Building2, MoreVertical, 
  ExternalLink, FileText, Activity 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table';

const mockCompanies = [
  { id: '1', name: 'TechCorp Solutions', document: '12.345.678/0001-90', status: 'active', demands: 3 },
  { id: '2', name: 'Padaria do João', document: '98.765.432/0001-10', status: 'lead', demands: 1 },
  { id: '3', name: 'Advocacia Silva', document: '11.222.333/0001-44', status: 'active', demands: 5 },
  { id: '4', name: 'Construtora Apex', document: '55.666.777/0001-88', status: 'churn', demands: 0 },
];

export const Companies = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [companies] = useState(mockCompanies);

  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.document.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">Ativo</span>;
      case 'lead': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-400">Lead (Em negociação)</span>;
      case 'churn': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400">Cancelado</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da Página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie todos os clientes, leads e demandas da Vertex.</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Barra de Ferramentas */}
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

      {/* Tabela de Empresas */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Demandas Ativas</TableHead>
              <TableHead className="w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma empresa encontrada com "{searchTerm}".
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
                  <TableCell className="text-muted-foreground">{company.document}</TableCell>
                  <TableCell>{getStatusBadge(company.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Activity className={`h-4 w-4 ${company.demands > 0 ? 'text-primary' : 'text-muted-foreground/40'}`} />
                      <span>{company.demands}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <ExternalLink className="h-4 w-4 mr-2" /> Abrir Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" /> Ver Contratos
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
    </div>
  );
};

export default Companies;
