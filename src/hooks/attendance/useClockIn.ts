import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceRecord } from '@/types/attendance';

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowTimestamp(): string {
  const d = new Date();
  const offset = '+08:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`;
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const db = supabase as any;

  const todayRecord = useQuery({
    queryKey: ['clock-in-today', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await db
        .from('attendance_records')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', todayDateStr())
        .maybeSingle();
      if (error) throw error;
      return data as AttendanceRecord | null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 1000,
  });

  const clockInMutation = useMutation({
    mutationFn: async (attachmentUrls: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (attachmentUrls.length === 0) throw new Error('At least one attachment is required');

      const now = nowTimestamp();
      const { error } = await db
        .from('attendance_records')
        .insert({
          employee_id: user.id,
          date: todayDateStr(),
          clock_in: now,
          status: 'present',
          source: 'clock_in',
          attachment_urls: attachmentUrls,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-in-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      toast({ title: 'Clocked In', description: 'Your attendance has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const record = todayRecord.data;
      if (!record) throw new Error('No clock-in record found for today');

      const now = nowTimestamp();
      const { error } = await db
        .from('attendance_records')
        .update({ clock_out: now })
        .eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-in-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      toast({ title: 'Clocked Out', description: 'Clock-out time recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const hasClockIn = !!todayRecord.data?.clock_in;
  const hasClockOut = !!todayRecord.data?.clock_out;

  return {
    todayRecord: todayRecord.data,
    isLoading: todayRecord.isLoading,
    clockIn: clockInMutation.mutateAsync,
    isClockingIn: clockInMutation.isPending,
    clockOut: clockOutMutation.mutateAsync,
    isClockingOut: clockOutMutation.isPending,
    hasClockIn,
    hasClockOut,
  };
}
