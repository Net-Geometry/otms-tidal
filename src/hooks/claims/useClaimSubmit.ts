import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ClaimType } from '@/types/claims';
import { isSubmissionOpen, getClaimCyclePeriod } from '@/lib/submissionCycles';

/**
 * Send push notification for claim status change (non-blocking).
 * In-app notification is handled by DB trigger.
 */
async function sendClaimPushNotification(requestId: string, newStatus: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.functions.invoke('send-claim-push-notification', {
    body: { requestId, newStatus },
  });
}

export interface ClaimSubmitData {
  claim_type_id: string;
  claim_date: string; // yyyy-mm-dd
  amount: number;
  purpose?: string | null;
  receipt_urls?: string[];
}

function uniqueUpperSuffix(len = 4) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function fetchClaimType(claimTypeId: string): Promise<ClaimType> {
  const db = supabase as any;
  const { data, error } = await db.from('claim_types').select('*').eq('id', claimTypeId).single();
  if (error) throw error;
  return data as ClaimType;
}

function buildLimitWarning(input: { amount: number; limit_amount: number | null; limit_period: string | null }) {
  if (input.limit_amount == null) return null;
  const period = input.limit_period || 'period';
  const limitText = `RM${Number(input.limit_amount).toFixed(2)}/${period}`;
  if (Number(input.amount) > Number(input.limit_amount)) {
    return `Soft limit: ${limitText}. Submitted RM${Number(input.amount).toFixed(2)} exceeds limit.`;
  }
  return `Soft limit: ${limitText}.`;
}

export function useClaimSubmit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClaimSubmitData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      const user = authData.user;

      if (!input.claim_type_id) throw new Error('Claim type is required');
      if (!input.claim_date) throw new Error('Receipt date is required');
      if (input.amount == null || Number.isNaN(Number(input.amount))) throw new Error('Amount is required');
      if (Number(input.amount) <= 0) throw new Error('Amount must be greater than 0');

      const claimDate = parseISO(input.claim_date);
      if (Number.isNaN(claimDate.getTime())) throw new Error('Invalid receipt date');

      const claimType = await fetchClaimType(input.claim_type_id);
      const limitWarning = buildLimitWarning({
        amount: Number(input.amount),
        limit_amount: claimType.limit_amount ?? null,
        limit_period: claimType.limit_period ?? null,
      });

      // Fetch profile for supervisor
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('supervisor_id, is_director')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;

      const db = supabase as any;

      // Duplicate check (exclude rejected/cancelled)
      const { data: dup, error: dupError } = await db
        .from('claims')
        .select('id, ticket_number, status')
        .eq('employee_id', user.id)
        .eq('claim_type_id', input.claim_type_id)
        .eq('claim_date', input.claim_date)
        .eq('amount', Number(input.amount))
        .not('status', 'in', '(rejected,cancelled)')
        .limit(1);
      if (dupError) throw dupError;
      if (dup && dup.length > 0) {
        throw new Error('Possible duplicate claim detected for the same date/type/amount');
      }

      // Check submission cutoff cycle
      const today = format(new Date(), 'yyyy-MM-dd');
      if (!isSubmissionOpen(input.claim_date, today)) {
        const cycle = getClaimCyclePeriod(input.claim_date);
        throw new Error(`Submission period for this claim date has closed. The cycle ended on ${cycle.end}.`);
      }

      let supervisorId: string | null = profile?.supervisor_id || null;
      let initialStatus: any = 'pending_supervisor';

      // Director bypass: skip supervisor, go directly to pending_hr
      if (profile?.is_director) {
        initialStatus = 'pending_hr';
        supervisorId = null;
      } else if (!supervisorId) {
        initialStatus = 'pending_hr';
      } else {
        // If supervisor is a privileged role, skip supervisor stage
        const { data: svRoles, error: svRoleError } = await db
          .from('user_roles')
          .select('role')
          .eq('user_id', supervisorId)
          .in('role', ['hr', 'admin', 'finance', 'management'])
          .limit(1);
        if (svRoleError) throw svRoleError;
        if (svRoles && svRoles.length > 0) {
          initialStatus = 'pending_hr';
        }
      }

      // Ticket number: CL-YYYYMMDD-RANDOM
      const dateStr = format(claimDate, 'yyyyMMdd');
      const ticketNumber = `CL-${dateStr}-${uniqueUpperSuffix(4)}`;

      const { data: created, error: insertError } = await db
        .from('claims')
        .insert([
          {
            ticket_number: ticketNumber,
            employee_id: user.id,
            claim_type_id: input.claim_type_id,
            claim_date: input.claim_date,
            amount: Number(input.amount),
            purpose: input.purpose || null,
            receipt_urls: input.receipt_urls || [],
            limit_warning: limitWarning,
            supervisor_id: supervisorId,
            status: initialStatus,
          },
        ])
        .select('*')
        .single();

      if (insertError) throw insertError;

      // Push notification (non-blocking, failure doesn't affect submission)
      sendClaimPushNotification(created.id, initialStatus).catch((e) => {
        console.warn('Failed to send claim push notification:', e);
      });

      return created as any;
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
      toast({
        title: 'Success',
        description: `Claim ${created.ticket_number} submitted successfully`,
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
