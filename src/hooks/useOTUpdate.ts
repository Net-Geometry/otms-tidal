import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canSubmitOTForDate } from '@/utils/otValidation';

interface UpdateOTParams {
  requestId: string;
  data: {
    ot_date: string;
    ot_location_state: string;
    start_time: string;
    end_time: string;
    total_hours: number;
    day_type: 'weekday' | 'saturday' | 'sunday' | 'public_holiday';
    reason: string;
    attachment_urls: string[];
    employee_id: string;
  };
}

export function useOTUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ requestId, data }: UpdateOTParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get submission cutoff day from settings
      const { data: settings, error: settingsError } = await supabase
        .from('ot_settings')
        .select('ot_submission_cutoff_day')
        .single();

      if (settingsError) {
        console.error('Error fetching OT settings:', settingsError);
        // Continue with default cutoff day
      }

      const cutoffDay = settings?.ot_submission_cutoff_day || 10;

      // Validate OT date against submission deadline rules
      const otDateObj = new Date(data.ot_date);
      const validation = canSubmitOTForDate(otDateObj, new Date(), cutoffDay);
      if (!validation.isAllowed) {
        throw new Error(validation.message || 'This date is not allowed for OT submission');
      }

      // Check for overlapping requests (excluding the current one being edited)
      const { data: overlapping, error: overlapError } = await supabase
        .from('ot_requests')
        .select('*')
        .eq('employee_id', data.employee_id)
        .eq('ot_date', data.ot_date)
        .neq('id', requestId)
        .or(`and(start_time.lte.${data.end_time},end_time.gte.${data.start_time})`);

      if (overlapError) throw overlapError;

      if (overlapping && overlapping.length > 0) {
        throw new Error('This time slot overlaps with another OT request on the same date');
      }

      // Update the request - calculations will be done by the database trigger
      const { data: updated, error } = await supabase
        .from('ot_requests')
        .update({
          ot_date: data.ot_date,
          ot_location_state: data.ot_location_state,
          start_time: data.start_time,
          end_time: data.end_time,
          total_hours: data.total_hours,
          day_type: data.day_type,
          reason: data.reason,
          attachment_urls: data.attachment_urls,
        })
        .eq('id', requestId)
        .eq('employee_id', user.id)
        .eq('status', 'pending_verification')
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      toast({
        title: 'Success',
        description: 'OT request updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update OT request',
        variant: 'destructive',
      });
    },
  });
}
