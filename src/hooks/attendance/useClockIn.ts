import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceRecord, AttendanceSession } from '@/types/attendance';

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

  // Fetch today's attendance record
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

  // Fetch today's sessions
  const todaySessions = useQuery({
    queryKey: ['clock-in-sessions', todayRecord.data?.id],
    queryFn: async () => {
      const recordId = todayRecord.data?.id;
      if (!recordId) return [];
      const { data, error } = await db
        .from('attendance_sessions')
        .select('*')
        .eq('attendance_record_id', recordId)
        .order('session_number', { ascending: true });
      if (error) throw error;
      return (data || []) as AttendanceSession[];
    },
    enabled: !!todayRecord.data?.id,
    staleTime: 10 * 1000,
  });

  // Check if multiple clock-in is allowed (global setting OR per-employee override)
  const multipleClockInAllowed = useQuery({
    queryKey: ['multiple-clockin-allowed', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      // Check per-employee override first
      const { data: empShift } = await db
        .from('employee_shifts')
        .select('allow_multiple_clockin')
        .eq('employee_id', user.id)
        .eq('is_current', true)
        .maybeSingle();

      if (empShift?.allow_multiple_clockin === true) return true;

      // Fall back to global setting
      const { data: settings } = await db
        .from('attendance_settings')
        .select('allow_multiple_clockin')
        .eq('id', 1)
        .single();

      return settings?.allow_multiple_clockin === true;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['clock-in-today'] });
    queryClient.invalidateQueries({ queryKey: ['clock-in-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
  };

  const clockInMutation = useMutation({
    mutationFn: async (attachmentUrls: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (attachmentUrls.length === 0) throw new Error('At least one attachment is required');

      const record = todayRecord.data;
      const sessions = todaySessions.data || [];
      const now = nowTimestamp();

      // If record exists, check if we can add a new session
      if (record) {
        const lastSession = sessions[sessions.length - 1];

        // If there's an open session (no clock_out), can't clock in again
        if (lastSession && !lastSession.clock_out) {
          throw new Error('You have an open session. Please clock out first.');
        }

        // If first session is done and multiple not allowed, block
        if (sessions.length >= 1 && !multipleClockInAllowed.data) {
          throw new Error('Multiple clock-in is not allowed');
        }

        // Add new session
        const nextSessionNum = sessions.length + 1;
        const { error } = await db
          .from('attendance_sessions')
          .insert({
            attendance_record_id: record.id,
            session_number: nextSessionNum,
            clock_in: now,
          });
        if (error) throw error;
        return;
      }

      // First clock-in: create attendance record + session 1
      let shiftId: string | null = null;
      const { data: currentShift } = await db
        .from('employee_shifts')
        .select('shift_id')
        .eq('employee_id', user.id)
        .eq('is_current', true)
        .maybeSingle();

      if (currentShift?.shift_id) {
        shiftId = currentShift.shift_id;
      } else {
        const { data: regularShift } = await db
          .from('shifts')
          .select('id')
          .eq('code', 'REG')
          .eq('is_active', true)
          .maybeSingle();
        shiftId = regularShift?.id ?? null;
      }

      // Create attendance record
      const { data: newRecord, error: recordErr } = await db
        .from('attendance_records')
        .insert({
          employee_id: user.id,
          date: todayDateStr(),
          clock_in: now,
          shift_id: shiftId,
          status: 'present',
          source: 'clock_in',
          attachment_urls: attachmentUrls,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (recordErr) throw recordErr;

      // Create session 1
      const { error: sessionErr } = await db
        .from('attendance_sessions')
        .insert({
          attendance_record_id: newRecord.id,
          session_number: 1,
          clock_in: now,
        });
      if (sessionErr) throw sessionErr;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Clocked In', description: 'Your attendance has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const sessions = todaySessions.data || [];
      const lastSession = sessions[sessions.length - 1];

      if (!lastSession || lastSession.clock_out) {
        throw new Error('No open session to clock out');
      }

      const now = nowTimestamp();
      const { error } = await db
        .from('attendance_sessions')
        .update({ clock_out: now })
        .eq('id', lastSession.id);
      if (error) throw error;

      // Also update the main record's clock_out for backwards compatibility
      const record = todayRecord.data;
      if (record) {
        if (lastSession.session_number === 1) {
          await db.from('attendance_records').update({ clock_out: now }).eq('id', record.id);
        } else if (lastSession.session_number === 2) {
          await db.from('attendance_records').update({ clock_out_2: now }).eq('id', record.id);
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Clocked Out', description: 'Clock-out time recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const sessions = todaySessions.data || [];
  const lastSession = sessions[sessions.length - 1];
  const allowMultiple = !!multipleClockInAllowed.data;

  // Has any clock-in at all
  const hasClockIn = sessions.length > 0;
  // Current session is open (clocked in, not out yet)
  const hasOpenSession = !!lastSession && !lastSession.clock_out;
  // All sessions are closed
  const allSessionsClosed = sessions.length > 0 && sessions.every((s) => !!s.clock_out);
  // Can start a new session
  const canStartNewSession = allSessionsClosed && allowMultiple;
  // Fully done = has sessions, all closed, and either no multiple allowed OR user is done
  const allDone = allSessionsClosed && !allowMultiple;

  return {
    todayRecord: todayRecord.data,
    sessions,
    isLoading: todayRecord.isLoading,
    clockIn: clockInMutation.mutateAsync,
    isClockingIn: clockInMutation.isPending,
    clockOut: clockOutMutation.mutateAsync,
    isClockingOut: clockOutMutation.isPending,
    hasClockIn,
    hasOpenSession,
    allSessionsClosed,
    canStartNewSession,
    allDone,
    allowMultiple,
  };
}
