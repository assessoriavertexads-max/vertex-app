import { Building2, Search, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const companies = [
  { id: 1, name: "Tech Corp", sector: "Tecnologia", status: "Ativo", demands: 3, revenue: "R$ 45.000", contact: "João Silva" },
  { id: 2, name: "Design Co", sector: "Design", status: "Ativo", demands: 2, revenue: "R$ 18.500", contact: "Maria Santos" },
  { id: 3, name: "Startup Inc", sector: "SaaS", status: "Ativo", demands: 5, revenue: "R$ 62.000", contact: "Pedro Lima" },
  { id: 4, name: "Global SA", sector: "Consultoria", status: "Inativo", demands: 0, revenue: "R$ 0", contact: "Ana Costa" },
  { id: 5, name: "Mega Ltd", sector: "E-commerce", status: "Ativo", demands: 1, revenue: "R$ 12.000", contact: "Carlos Souza" },
  { id: 6, name: "Alpha Co", sector: "Fintech", status: "Ativo", demands: 4, revenue: "R$ 38.000", contact: "Lucia Ferreira" },
];

export default function Companies() {
  const [search, setSearch] = useState("");
  const filtered = companies.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.sector.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Todas as empresas e suas demandas</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar empresas..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((company) => (
          <div key={company.id} className="stat-card cursor-pointer group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.sector}</p>
                </div>
              </div>
              <Badge variant={company.status === "Ativo" ? "default" : "secondary"} className="text-xs">
                {company.status}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Demandas</p>
                <p className="font-medium text-foreground">{company.demands}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Receita</p>
                <p className="font-medium text-foreground">{company.revenue}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{company.contact}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
