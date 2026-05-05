import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TaskInsert, TaskItem, TaskUpdate } from '@/lib/backend-types';
import { toast } from 'sonner';
import { runAutomations } from '@/lib/automation';

export const useTasks = (listId: string | null) => {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: loading } = useQuery<TaskItem[]>({
    queryKey: ['tasks', listId],
    queryFn: async () => {
      if (!listId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*, companies(name)')
        .eq('list_id', listId);
      if (error) throw error;
      return data;
    },
    enabled: !!listId,
  });

  const createTask = useMutation({
    mutationFn: async (newTask: Omit<TaskInsert, 'list_id'>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...newTask, list_id: listId }])
        .select('id, name, company_id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', listId] });
      try {
        const result = await runAutomations('task_created', 'any', {
          entityTitle: data.name,
          companyId: data.company_id,
        });
        if (result.executed > 0) {
          toast.success(result.ruleName ? `Automação: "${result.ruleName}"` : `${result.executed} automações executadas`);
        }
      } catch { /* silent */ }
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & TaskUpdate) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      if (updates.status === 'concluido') {
        const { data } = await supabase.from('tasks').select('name, company_id').eq('id', id).single();
        return data as { name: string; company_id: string | null } | null;
      }
      return null;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', listId] });
      if (variables.status === 'concluido' && data) {
        try {
          const result = await runAutomations('task_completed', 'any', {
            entityTitle: data.name,
            companyId: data.company_id,
          });
          if (result.executed > 0) {
            toast.success(result.ruleName ? `Automação: "${result.ruleName}"` : `${result.executed} automações executadas`);
          }
        } catch { /* silent */ }
      }
    },
  });

  return { tasks, loading, createTask: createTask.mutateAsync, updateTask: updateTask.mutateAsync };
};
