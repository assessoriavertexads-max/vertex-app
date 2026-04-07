import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "alta" | "media" | "baixa";
  dueDate: string;
}

const initialTasks: Task[] = [
  { id: "1", title: "Contrato Tech Corp", description: "Finalizar revisão do contrato", status: "in_progress", priority: "alta", dueDate: "10/06/2026" },
  { id: "2", title: "Proposta Design Co", description: "Elaborar proposta comercial", status: "todo", priority: "media", dueDate: "12/06/2026" },
  { id: "3", title: "Relatório Mensal", description: "Preparar relatório financeiro", status: "todo", priority: "alta", dueDate: "15/06/2026" },
  { id: "4", title: "Onboarding Startup Inc", description: "Documentação de onboarding", status: "in_progress", priority: "media", dueDate: "08/06/2026" },
  { id: "5", title: "Reunião Alpha Co", description: "Preparar pauta da reunião", status: "done", priority: "baixa", dueDate: "05/06/2026" },
  { id: "6", title: "Atualizar Políticas", description: "Revisar políticas internas", status: "done", priority: "media", dueDate: "03/06/2026" },
];

const statusConfig = {
  a_receber: { label: "A Receber", icon: Circle, color: "text-muted-foreground" },
  em_progresso: { label: "Em Progresso", icon: Clock, color: "text-warning" },
  concluido: { label: "Concluído", icon: CheckCircle2, color: "text-success" },
};

const priorityColors = { alta: "destructive" as const, media: "default" as const, baixa: "secondary" as const, normal: "secondary" as const };

export default function Processes() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          lists (
            name,
            spaces (name)
          ),
          companies (name)
        `)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  const grouped = {
    a_receber: tasks.filter((t: any) => t.status === "a_receber"),
    em_progresso: tasks.filter((t: any) => t.status === "em_progresso"),
    concluido: tasks.filter((t: any) => t.status === "concluido"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground text-sm mt-1">Documentação e tarefas</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <h3 className="font-medium text-sm text-foreground">{config.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">{grouped[status].length}</Badge>
              </div>

              {grouped[status].map((task: any) => (
                <div key={task.id} className="stat-card !p-4 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-foreground">{task.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.lists?.spaces?.name} / {task.lists?.name}
                          {task.companies?.name && ` - ${task.companies.name}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <Badge variant={priorityColors[task.priority]} className="text-xs capitalize">{task.priority}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
