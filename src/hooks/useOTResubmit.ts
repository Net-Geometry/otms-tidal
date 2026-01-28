import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canSubmitOTForDate } from '@/utils/otValidation';

interface ResubmitData {
  parentRequestId: string;
  ot_date: string;
  ot_location_state: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  day_type: 'weekday' | 'saturday' | 'sunday' | 'public_holiday';
  reason: string;
  attachment_urls: string[];
  respective_supervisor_id?: string;
}

export function useOTResubmit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ResubmitData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get submission cutoff day from settings
      const { data: settings, error: settingsError } = await supabase
        .from('ot_settings')
        .select('ot_submission_cutoff_day, grace_period_enabled')
        .limit(1)
        .single();

      if (settingsError) {
        console.error('Error fetching OT settings:', settingsError);
        // Continue with default cutoff day
      }

      const cutoffDay = settings?.ot_submission_cutoff_day || 10;
      const gracePeriodEnabled = settings?.grace_period_enabled ?? false;

      // Validate OT date against submission deadline rules
      const otDateObj = new Date(data.ot_date);
      const validation = canSubmitOTForDate(otDateObj, new Date(), cutoffDay, gracePeriodEnabled);
      if (!validation.isAllowed) {
        throw new Error(validation.message || 'This date is not allowed for OT submission');
      }

      // Get original request info
      const { data: originalRequest, error: fetchError } = await supabase
        .from('ot_requests')
        .select('resubmission_count, rejection_stage, supervisor_remarks, hr_remarks, management_remarks, supervisor_id, respective_supervisor_denial_remarks')
        .eq('id', data.parentRequestId)
        .single();

      if (fetchError) throw fetchError;

      // Determine initial status based on whether respective supervisor was involved
      // Route B: If respective_supervisor_id is provided → pending_respective_supervisor_confirmation
      // Route A: Otherwise → pending_verification
      const initialStatus = data.respective_supervisor_id
        ? 'pending_respective_supervisor_confirmation'
        : 'pending_verification';

      // Create new request as resubmission
      const { data: newRequest, error } = await supabase
        .from('ot_requests')
        .insert({
          employee_id: user.id,
          supervisor_id: originalRequest.supervisor_id,
          parent_request_id: data.parentRequestId,
          is_resubmission: true,
          resubmission_count: (originalRequest.resubmission_count || 0) + 1,
          ot_date: data.ot_date,
          ot_location_state: data.ot_location_state,
          start_time: data.start_time,
          end_time: data.end_time,
          total_hours: data.total_hours,
          day_type: data.day_type,
          reason: data.reason,
          attachment_urls: data.attachment_urls,
          respective_supervisor_id: data.respective_supervisor_id || null,
          status: initialStatus
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Log resubmission history
      const rejectionReason = originalRequest.respective_supervisor_denial_remarks ||
                             originalRequest.supervisor_remarks ||
                             originalRequest.hr_remarks ||
                             originalRequest.management_remarks ||
                             'No remarks provided';

      await supabase.from('ot_resubmission_history').insert([{
        original_request_id: data.parentRequestId,
        resubmitted_request_id: newRequest.id,
        rejected_by_role: (originalRequest.rejection_stage || 'supervisor') as 'employee' | 'supervisor' | 'hr' | 'management' | 'admin',
        rejection_reason: rejectionReason
      }]);

      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      toast({
        title: 'Success',
        description: 'OT request resubmitted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
