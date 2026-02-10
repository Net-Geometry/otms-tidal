import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Shift } from '@/types/attendance';

export function useShifts(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? true;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['attendance-shifts', includeInactive ? 'all' : 'active'],
    queryFn: async () => {
      let q = db
        .from('shifts')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Shift[];
    },
    staleTime: 30 * 1000,
  });

  const createShift = useMutation({
    mutationFn: async (input: Omit<Shift, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await db.from('shifts').insert([
        {
          code: input.code,
          name: input.name,
          start_time: input.start_time,
          end_time: input.end_time,
          grace_period_minutes: input.grace_period_minutes,
          is_overnight: input.is_overnight,
          is_active: input.is_active,
          sort_order: input.sort_order,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-shifts'] });
      toast({ title: 'Saved', description: 'Shift created' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateShift = useMutation({
    mutationFn: async (input: Partial<Omit<Shift, 'created_at' | 'updated_at'>> & { id: string }) => {
      const { id, ...values } = input;
      const { error } = await db.from('shifts').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-shifts'] });
      toast({ title: 'Saved', description: 'Shift updated' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteShift = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await db.from('shifts').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-shifts'] });
      toast({ title: 'Deleted', description: 'Shift deleted' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  return {
    ...query,
    createShift: createShift.mutateAsync,
    isCreating: createShift.isPending,
    updateShift: updateShift.mutateAsync,
    isUpdating: updateShift.isPending,
    deleteShift: deleteShift.mutateAsync,
    isDeleting: deleteShift.isPending,
  };
}
