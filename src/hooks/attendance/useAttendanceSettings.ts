import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceSettings } from '@/types/attendance';

export function useAttendanceSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const { data, error } = await db
        .from('attendance_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data as AttendanceSettings;
    },
    staleTime: 30 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<Omit<AttendanceSettings, 'id' | 'created_at' | 'updated_at'>>) => {
      const { error } = await db
        .from('attendance_settings')
        .update(values)
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast({ title: 'Saved', description: 'Attendance settings updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
