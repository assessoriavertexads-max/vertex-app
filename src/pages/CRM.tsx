import { useState } from 'react';
import { DndContext, DragEndEvent, closestCorners, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Building2, DollarSign, Clock, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const initialLeads = [
  { id: 'lead-1', title: 'Campanha Tráfego Pago', company: 'TechCorp Solutions', value: 5000, status: 'prospect' },
  { id: 'lead-2', title: 'Assessoria Completa', company: 'Padaria do João', value: 1500, status: 'negotiation' },
  { id: 'lead-3', title: 'Contrato Anual SEO', company: 'Construtora Apex', value: 12000, status: 'legal' },
  { id: 'lead-4', title: 'Identidade Visual', company: 'Advocacia Silva', value: 3500, status: 'closed' },
];

const COLUMNS = [
  { id: 'prospect', title: 'Prospecção', color: 'border-muted bg-muted/30' },
  { id: 'negotiation', title: 'Negociação', color: 'border-primary/30 bg-primary/5' },
  { id: 'legal', title: 'Análise Jurídica', color: 'border-accent/30 bg-accent/5' },
  { id: 'closed', title: 'Fechado (Ganho)', color: 'border-green-500/30 bg-green-500/5' },
];

interface Lead {
  id: string;
  title: string;
  company: string;
  value: number;
  status: string;
}

const LeadCard = ({ lead }: { lead: Lead }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: lead,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg border border-border bg-card shadow-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between">
        <p className="font-medium text-sm text-foreground">{lead.title}</p>
        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <Building2 className="h-3 w-3" />
        <span>{lead.company}</span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <DollarSign className="h-3 w-3" />
          R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> Hoje
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, leads }: { column: typeof COLUMNS[number]; leads: Lead[] }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[500px] rounded-xl border-2 border-dashed p-3 transition-colors ${column.color} ${isOver ? 'ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
          <span className="text-xs bg-background border border-border rounded-full px-2 py-0.5 text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>

      <div className="flex flex-col gap-2 flex-1">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
};

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as string;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM — Comercial & Jurídico</h1>
          <p className="text-muted-foreground text-sm mt-1">Arraste os cards para mover leads entre os estágios.</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              leads={leads.filter((l) => l.status === column.id)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
