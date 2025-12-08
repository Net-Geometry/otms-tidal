/**
 * Route A Approval Hook - Simple direct supervisor flow
 *
 * Handles the straightforward approval workflow:
 * pending_verification → supervisor_confirmed → hr_certified → management_approved
 *
 * No respective supervisor involvement - single-step supervisor approval.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest } from '@/types/otms';
import { toast } from 'sonner';
import { validateSupervisorApproval, validateHRCertification, validateHRRejection, validateManagementApproval, validateManagementRejection } from '@/services/ot-workflow';

interface UseRouteAApprovalOptions {
  requestIds?: string[];
  enabled?: boolean;
}

interface MutationInput {
  requestIds: string[];
  remarks?: string;
}

export function useRouteAApproval(options?: UseRouteAApprovalOptions) {
  const queryClient = useQueryClient();
  const { requestIds = [], enabled = true } = options || {};

  // Fetch requests for Route A approval
  const fetchRequests = async () => {
    if (!enabled || requestIds.length === 0) return [];

    const { data, error } = await supabase
      .from('ot_requests')
      .select('*')
      .in('id', requestIds)
      .eq('respective_supervisor_id', null); // Only Route A requests

    if (error) throw error;
    return data as OTRequest[];
  };

  const { data: requests = [] } = useQuery({
    queryKey: ['route-a-requests', requestIds],
    queryFn: fetchRequests,
    enabled: enabled && requestIds.length > 0,
  });

  // Supervisor approval mutation (pending_verification → supervisor_confirmed)
  const supervisorApproveMutation = useMutation({
    mutationFn: async (input: MutationInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Validate each request
      const requestsData = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', input.requestIds)
        .single();

      const request = requestsData.data as OTRequest;
      const validation = validateSupervisorApproval(request, session.user.id);
      if (!validation.valid) throw new Error(validation.error);

      // Update status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'supervisor_confirmed',
          supervisor_verified_at: new Date().toISOString(),
          supervisor_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-a-requests'] });
      toast.success('Requests approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve requests');
    },
  });

  // HR certification mutation (supervisor_confirmed → hr_certified)
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

      // Notify management if enabled
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
      queryClient.invalidateQueries({ queryKey: ['route-a-requests'] });
      toast.success('Requests certified successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to certify requests');
    },
  });

  // HR rejection mutation (hr_certified → pending_verification)
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
      }

      // Reset to pending_verification for Route A
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'pending_verification',
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
      queryClient.invalidateQueries({ queryKey: ['route-a-requests'] });
      toast.success('Requests rejected and reset for amendment');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject requests');
    },
  });

  // Management approval mutation (hr_certified → management_approved)
  const managementApproveMutation = useMutation({
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
        const validation = validateManagementApproval(request);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Update status
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'management_approved',
          management_reviewed_at: new Date().toISOString(),
          management_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify employee of approval
      try {
        for (const requestId of input.requestIds) {
          await supabase.functions.invoke('send-employee-ot-notification', {
            body: { requestId, notificationType: 'approved' },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send employee notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-a-requests'] });
      toast.success('Requests approved by management');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve requests');
    },
  });

  // Management rejection mutation (management_approved → hr_certified)
  const managementRejectMutation = useMutation({
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
        const validation = validateManagementRejection(request);
        if (!validation.valid) throw new Error(validation.error);
      }

      // Reset to hr_certified for HR recertification
      const { error } = await supabase
        .from('ot_requests')
        .update({
          status: 'hr_certified',
          management_remarks: input.remarks,
        })
        .in('id', input.requestIds);

      if (error) throw error;

      // Notify HR for recertification
      try {
        await supabase.functions.invoke('send-hr-recertification-notification', {
          body: { requestIds: input.requestIds },
        });
      } catch (notifError) {
        console.warn('Failed to send recertification notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-a-requests'] });
      toast.success('Requests sent back to HR for recertification');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject requests');
    },
  });

  return {
    requests,
    supervisorApprove: supervisorApproveMutation.mutate,
    isSupervisorApproving: supervisorApproveMutation.isPending,
    hrCertify: hrCertifyMutation.mutate,
    isHRCertifying: hrCertifyMutation.isPending,
    hrReject: hrRejectMutation.mutate,
    isHRRejecting: hrRejectMutation.isPending,
    managementApprove: managementApproveMutation.mutate,
    isManagementApproving: managementApproveMutation.isPending,
    managementReject: managementRejectMutation.mutate,
    isManagementRejecting: managementRejectMutation.isPending,
  };
}
