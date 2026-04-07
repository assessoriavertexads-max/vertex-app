import { useState } from 'react';
import { DndContext, DragEndEvent, closestCorners, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Building2, DollarSign, Clock, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NewLeadModal } from '@/components/crm/NewLeadModal';

const COLUMNS = [
  { id: 'prospect', title: 'Prospecção', color: 'border-slate-200 bg-slate-100/50' },
  { id: 'negotiation', title: 'Negociação', color: 'border-blue-200 bg-blue-50/50' },
  { id: 'legal', title: 'Análise Jurídica', color: 'border-amber-200 bg-amber-50/50' },
  { id: 'closed', title: 'Fechado (Ganho)', color: 'border-emerald-200 bg-emerald-50/50' },
];

const LeadCard = ({ lead }: { lead: any }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: lead,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  // Extrai o nome da empresa do JOIN relacional do Supabase
  const companyName = lead.companies?.name || 'Empresa não vinculada';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors ${
        isDragging ? 'opacity-50 ring-2 ring-blue-500 shadow-xl z-50 relative' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-800 text-sm">{lead.title}</h4>
        <button className="text-slate-400 hover:text-slate-600">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
        <Building2 className="w-3.5 h-3.5" />
        {companyName}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 font-medium text-emerald-600 text-sm">
          <DollarSign className="w-3.5 h-3.5" />
          {Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" /> Hoje
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ column, leads }: { column: any; leads: any[] }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          {column.title}
          <span className="bg-slate-200 text-slate-600 text-xs py-0.5 px-2 rounded-full">
            {leads.length}
          </span>
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-800">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl border-2 border-dashed p-3 flex flex-col gap-3 min-h-[500px] transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50/50' : column.color
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && !isOver && (
          <div className="text-center p-4 text-sm text-slate-400 font-medium">
            Arraste um lead para cá
          </div>
        )}
      </div>
    </div>
  );
};

export const CRM = () => {
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      // AQUI ESTÁ A MÁGICA: O select('*, companies(name)') faz o JOIN com a tabela de empresas
      const { data, error } = await supabase
        .from('leads')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createLead = useMutation({
    mutationFn: async (newLead: any) => {
      const { error } = await supabase.from('leads').insert(newLead);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead criado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar lead.');
    }
  });

  const handleCreateLead = (leadData: any) => {
    createLead.mutate(leadData);
  };

  const updateLeadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (newLeadInfo) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData(['leads']);
      
      queryClient.setQueryData(['leads'], (old: any) => 
        old.map((lead: any) => lead.id === newLeadInfo.id ? { ...lead, status: newLeadInfo.status } : lead)
      );

      return { previousLeads };
    },
    onError: (err, newLeadInfo, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads'], context.previousLeads);
      }
      toast.error('Erro ao mover o card.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const newStatus = String(over.id);
    const lead = leads.find((l: any) => l.id === leadId);

    if (lead && lead.status !== newStatus) {
      updateLeadStatus.mutate({ id: leadId, status: newStatus });
    }
  };

  const totalValue = leads.reduce((acc: number, lead: any) => acc + Number(lead.value), 0);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM Comercial</h1>
          <p className="text-slate-500 mt-1">Gerencie suas prospecções e contratos jurídicos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg border border-emerald-200">
            <span className="text-sm block">Pipeline Total</span>
            <span className="font-bold text-lg">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => setIsNewLeadOpen(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <NewLeadModal isOpen={isNewLeadOpen} onClose={() => setIsNewLeadOpen(false)} onSave={handleCreateLead} />

      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full items-start">
            {COLUMNS.map((column) => (
              <KanbanColumn 
                key={column.id} 
                column={column} 
                leads={leads.filter((lead: any) => lead.status === column.id)} 
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
};

export default CRM;
