import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeDependent } from '@/types/dependents';

export function useEmployeeDependents(employeeId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['employee-dependents', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await db
        .from('employee_dependents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('relationship', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as EmployeeDependent[];
    },
    enabled: !!employeeId,
  });

  const addMutation = useMutation({
    mutationFn: async (dep: Omit<EmployeeDependent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await db.from('employee_dependents').insert([dep]).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-dependents', employeeId] });
      toast({ title: 'Dependent added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmployeeDependent> & { id: string }) => {
      const { error } = await db.from('employee_dependents').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-dependents', employeeId] });
      toast({ title: 'Dependent updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('employee_dependents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-dependents', employeeId] });
      toast({ title: 'Dependent removed' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return {
    dependents: query.data || [],
    isLoading: query.isLoading,
    addDependent: addMutation,
    updateDependent: updateMutation,
    deleteDependent: deleteMutation,
  };
}
