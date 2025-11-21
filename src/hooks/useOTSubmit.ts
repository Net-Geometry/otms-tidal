import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canSubmitOTForDate } from '@/utils/otValidation';

interface OTSubmitData {
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  day_type: 'weekday' | 'saturday' | 'sunday' | 'public_holiday';
  reason: string;
  respective_supervisor_id?: string | null;
  attachment_urls: string[];
}

/**
 * Send supervisor notification via Edge Function (initial supervisor alert)
 * Wrapped in try-catch to ensure notification failures don't break OT submission
 */
async function sendSupervisorNotification(requestId: string, employeeId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.warn('No active session for sending supervisor notification');
    return;
  }

  const response = await supabase.functions.invoke('send-supervisor-ot-notification', {
    body: {
      requestId,
      employeeId
    }
  });

  if (response.error) {
    throw new Error(`Notification error: ${response.error.message}`);
  }

  console.log('Supervisor notification sent:', response.data);
}

export function useOTSubmit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: OTSubmitData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get employee profile to get supervisor_id and check OT eligibility
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('supervisor_id, is_ot_eligible')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Check if employee is eligible for OT
      if (!profile.is_ot_eligible) {
        throw new Error('You are not eligible to submit OT requests. Please contact HR.');
      }

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

      // Check for duplicate or overlapping OT requests
      const { data: existingRequests, error: checkError } = await supabase
        .from('ot_requests')
        .select('id, start_time, end_time, status')
        .eq('employee_id', user.id)
        .eq('ot_date', data.ot_date)
        .neq('status', 'rejected');

      if (checkError) throw checkError;

      if (existingRequests && existingRequests.length > 0) {
        // Check for time overlap
        for (const existing of existingRequests) {
          const existingStart = existing.start_time;
          const existingEnd = existing.end_time;
          const newStart = data.start_time;
          const newEnd = data.end_time;

          // Overlap occurs if: (newStart < existingEnd) AND (newEnd > existingStart)
          if (newStart < existingEnd && newEnd > existingStart) {
            throw new Error(
              `You already have an OT request for ${data.ot_date} from ${existingStart} to ${existingEnd}. ` +
              `Please cancel or modify the existing request before submitting a new one.`
            );
          }
        }
      }

      // All submissions begin in pending_verification so direct supervisor can review first
      const initialStatus = 'pending_verification';

      const { data: otRequest, error } = await supabase
        .from('ot_requests')
        .insert({
          employee_id: user.id,
          supervisor_id: profile.supervisor_id || null,
          ot_date: data.ot_date,
          start_time: data.start_time,
          end_time: data.end_time,
          total_hours: data.total_hours,
          day_type: data.day_type,
          reason: data.reason,
          respective_supervisor_id: data.respective_supervisor_id || null,
          attachment_urls: data.attachment_urls,
          status: initialStatus,
        })
        .select()
        .single();

      if (error) throw error;

      // Always notify direct supervisor first; respective supervisor is notified later when explicitly requested
      sendSupervisorNotification(otRequest.id, user.id).catch((notifError) => {
        console.error('Failed to send supervisor notification:', notifError);
        // Don't throw - notification failure should not prevent OT submission
      });

      return otRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      toast({
        title: 'Success',
        description: `OT request ${data.ticket_number} submitted successfully`,
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
