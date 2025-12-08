/**
 * Route B Approval Hook - Respective supervisor + direct supervisor flow
 *
 * Handles the multi-step approval workflow:
 * pending_respective_supervisor_confirmation → respective_supervisor_confirmed
 *                                            → rejected (if denied)
 * respective_supervisor_confirmed → pending_supervisor_verification → supervisor_verified
 * supervisor_verified → hr_certified (via shared hook)
 *
 * Two-step supervisor approval with respective supervisor (instructing supervisor) first.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest } from '@/types/otms';
import { toast } from 'sonner';
import {
  validateRespectiveSupervisorConfirmation,
  validateRespectiveSupervisorDenial,
  validateSupervisorVerification,
  validateHRCertification,
  validateHRRejection,
} from '@/services/ot-workflow';

interface UseRouteBApprovalOptions {
  requestIds?: string[];
  enabled?: boolean;
}

interface MutationInput {
  requestIds: string[];
  remarks?: string;
  denialRemarks?: string;
}

export function useRouteBApproval(options?: UseRouteBApprovalOptions) {
  const queryClient = useQueryClient();
  const { requestIds = [], enabled = true } = options || {};

  // Fetch requests for Route B approval
  const fetchRequests = async () => {
    if (!enabled || requestIds.length === 0) return [];

    const { data, error } = await supabase
      .from('ot_requests')
      .select('*')
      .in('id', requestIds)
      .not('respective_supervisor_id', 'is', null); // Only Route B requests

    if (error) throw error;
    return data as OTRequest[];
  };

  const { data: requests = [] } = useQuery({
    queryKey: ['route-b-requests', requestIds],
    queryFn: fetchRequests,
    enabled: enabled && requestIds.length > 0,
  });

  // Respective supervisor confirmation (pending_respective_supervisor_confirmation → respective_supervisor_confirmed)
  const respectiveSVConfirmMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch and validate each request
      const { data: requestsData } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds);

      if (!requestsData) throw new Error('Requests not found');

      for (const request of requestsData) {
        const validation = validateRespectiveSupervisorConfirmation(request, session.user.id);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Update status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'respective_supervisor_confirmed',
          respective_supervisor_confirmed_at: new Date().toISOString(),
          respective_supervisor_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify direct supervisor for verification
      try {
        for (const requestId of input.requestIds) {
          await supabase.functions.invoke('send-supervisor-verified-notification', {
            body: { requestId },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send supervisor notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-b-requests'] });
      toast.success('Respective supervisor confirmation recorded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to confirm');
    },
  });

  // Respective supervisor denial (pending_respective_supervisor_confirmation → rejected)
  const respectiveSVDenyMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch and validate
      const { data: requestsData } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds);

      if (!requestsData) throw new Error('Requests not found');

      for (const request of requestsData) {
        const validation = validateRespectiveSupervisorDenial(request, session.user.id, input.denialRemarks);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Update status to rejected
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'rejected',
          respective_supervisor_denied_at: new Date().toISOString(),
          respective_supervisor_denial_remarks: input.denialRemarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify employee to amend
      try {
        for (const requestId of input.requestIds) {
          await supabase.functions.invoke('send-employee-ot-notification', {
            body: { requestId, notificationType: 'denied' },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send employee notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-b-requests'] });
      toast.success('Request denied. Employee notified to amend.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deny request');
    },
  });

  // Direct supervisor verification (pending_supervisor_verification → supervisor_verified)
  const supervisorVerifyMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch and validate
      const { data: requestsData } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds);

      if (!requestsData) throw new Error('Requests not found');

      for (const request of requestsData) {
        const validation = validateSupervisorVerification(request, session.user.id);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Update status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'supervisor_verified',
          supervisor_verified_at: new Date().toISOString(),
          supervisor_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify HR for certification
      try {
        await supabase.functions.invoke('send-hr-certification-notification', {
          body: { requestIds: input.requestIds },
        });
      } catch (notifError) {
        console.warn('Failed to send HR notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-b-requests'] });
      toast.success('Requests verified. HR notified for certification.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify requests');
    },
  });

  // HR certification for Route B (supervisor_verified → hr_certified)
  const hrCertifyMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch and validate
      const { data: requestsData } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds);

      if (!requestsData) throw new Error('Requests not found');

      for (const request of requestsData) {
        const validation = validateHRCertification(request);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Update status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'hr_certified',
          hr_id: session.user.id,
          hr_approved_at: new Date().toISOString(),
          hr_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify management
      try {
        await supabase.functions.invoke('send-management-ot-notification', {
          body: { requestIds: input.requestIds },
        });
      } catch (notifError) {
        console.warn('Failed to send management notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-b-requests'] });
      toast.success('Requests certified successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to certify requests');
    },
  });

  // HR rejection for Route B (hr_certified → pending_respective_supervisor_confirmation)
  const hrRejectMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Fetch and validate
      const { data: requestsData } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds);

      if (!requestsData) throw new Error('Requests not found');

      for (const request of requestsData) {
        const validation = validateHRRejection(request);
        if (!validation.valid) throw new Error(validation.error);
        // For Route B, should reset to pending_respective_supervisor_confirmation
        if (!request.respective_supervisor_id) {
          throw new Error('Expected Route B request with respective supervisor');
        }
      }

      // Reset to pending_respective_supervisor_confirmation for Route B
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'pending_respective_supervisor_confirmation',
          hr_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify employee
      try {
        for (const requestId of input.requestIds) {
          await supabase.functions.invoke('send-employee-ot-notification', {
            body: { requestId, notificationType: 'amendment_needed' },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send employee notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-b-requests'] });
      toast.success('Requests rejected and reset for amendment');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject requests');
    },
  });

  return {
    requests,
    respectiveSVConfirm: respectiveSVConfirmMutation.mutate,
    isRespectiveSVConfirming: respectiveSVConfirmMutation.isPending,
    respectiveSVDeny: respectiveSVDenyMutation.mutate,
    isRespectiveSVDenying: respectiveSVDenyMutation.isPending,
    supervisorVerify: supervisorVerifyMutation.mutate,
    isSupervisorVerifying: supervisorVerifyMutation.isPending,
    hrCertify: hrCertifyMutation.mutate,
    isHRCertifying: hrCertifyMutation.isPending,
    hrReject: hrRejectMutation.mutate,
    isHRRejecting: hrRejectMutation.isPending,
  };
}
