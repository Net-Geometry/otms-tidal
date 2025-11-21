import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calendarAssignmentKeys } from './useEmployeeCalendarAssignment';

interface UpdateCalendarAssignmentData {
  employeeId: string;
  calendarId: string;
  notes?: string;
}

interface RemoveCalendarAssignmentData {
  employeeId: string;
}

export function useUpdateEmployeeCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCalendarAssignmentData) => {
      // First, delete any existing assignment for this employee
      const { error: deleteError } = await supabase
        .from('employee_calendar_assignments')
        .delete()
        .eq('employee_id', data.employeeId);

      if (deleteError) throw deleteError;

      // Then, insert the new assignment as a manual override
      const { error: insertError } = await supabase
        .from('employee_calendar_assignments')
        .insert({
          employee_id: data.employeeId,
          calendar_id: data.calendarId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          is_manual_override: true,
          notes: data.notes || null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: (_, data) => {
      // Invalidate the calendar assignment query for this employee
      queryClient.invalidateQueries({
        queryKey: calendarAssignmentKeys.employee(data.employeeId),
      });

      // Invalidate all calendar assignment queries
      queryClient.invalidateQueries({
        queryKey: calendarAssignmentKeys.all,
      });

      toast({
        title: 'Success',
        description: 'Calendar assignment updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update calendar assignment',
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveCalendarAssignmentOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RemoveCalendarAssignmentData) => {
      // Delete the assignment to revert to auto-assignment
      const { error } = await supabase
        .from('employee_calendar_assignments')
        .delete()
        .eq('employee_id', data.employeeId);

      if (error) throw error;
    },
    onSuccess: (_, data) => {
      // Invalidate the calendar assignment query for this employee
      queryClient.invalidateQueries({
        queryKey: calendarAssignmentKeys.employee(data.employeeId),
      });

      toast({
        title: 'Success',
        description: 'Calendar assignment reset to auto-assign based on location',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset calendar assignment',
        variant: 'destructive',
      });
    },
  });
}
