import { useState } from "react";
import { Plus, Search, MoreHorizontal, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  name: string;
  company: string;
  value: string;
  email: string;
  phone: string;
}

const stages = [
  { id: "new", label: "Novos", color: "bg-info" },
  { id: "contact", label: "Em Contato", color: "bg-primary" },
  { id: "proposal", label: "Proposta", color: "bg-warning" },
  { id: "negotiation", label: "Negociação", color: "bg-success" },
];

const initialLeads: Record<string, Lead[]> = {
  new: [
    { id: "1", name: "João Silva", company: "Tech Corp", value: "R$ 15.000", email: "joao@tech.com", phone: "(11) 99999-0001" },
    { id: "2", name: "Maria Santos", company: "Design Co", value: "R$ 8.500", email: "maria@design.com", phone: "(11) 99999-0002" },
  ],
  contact: [
    { id: "3", name: "Pedro Lima", company: "Startup Inc", value: "R$ 22.000", email: "pedro@startup.com", phone: "(11) 99999-0003" },
  ],
  proposal: [
    { id: "4", name: "Ana Costa", company: "Global SA", value: "R$ 45.000", email: "ana@global.com", phone: "(11) 99999-0004" },
    { id: "5", name: "Carlos Souza", company: "Mega Ltd", value: "R$ 12.000", email: "carlos@mega.com", phone: "(11) 99999-0005" },
  ],
  negotiation: [
    { id: "6", name: "Lucia Ferreira", company: "Alpha Co", value: "R$ 38.000", email: "lucia@alpha.com", phone: "(11) 99999-0006" },
  ],
};

export default function CRM() {
  const [leads] = useState(initialLeads);
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${stage.color}`} />
              <h3 className="font-medium text-sm text-foreground">{stage.label}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {leads[stage.id]?.length || 0}
              </Badge>
            </div>

            <div className="space-y-2">
              {leads[stage.id]
                ?.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase()))
                .map((lead) => (
                  <div key={lead.id} className="stat-card !p-4 cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.company}</p>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-primary mt-2">{lead.value}</p>
                    <div className="flex gap-2 mt-2">
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
