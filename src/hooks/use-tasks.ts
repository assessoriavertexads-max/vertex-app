import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useTasks = (listId: string | null) => {
  const queryClient = useQueryClient();

  // Buscar tarefas da lista seleccionada
  const { data: tasks = [], isLoading: loading } = useQuery({
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

  // Criar tarefa
  const createTask = useMutation({
    mutationFn: async (newTask: any) => {
      const { data, error } = await supabase.from('tasks').insert([{ ...newTask, list_id: listId }]).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', listId] }),
  });

  // Atualizar tarefa (status, nome, etc)
  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', listId] }),
  });

  return { tasks, loading, createTask: createTask.mutateAsync, updateTask: updateTask.mutateAsync };
};