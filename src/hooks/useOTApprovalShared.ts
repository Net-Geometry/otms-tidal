/**
 * Shared OT Approval Utilities Hook
 *
 * Contains shared logic used across both Route A and Route B:
 * - Management approval/rejection flows
 * - Notification dispatch
 * - Batch operations helpers
 * - Status grouping and filtering utilities
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest, GroupedOTRequest, OTStatus, getRequestRoute } from '@/types/otms';
import { toast } from 'sonner';
import {
  validateManagementApproval,
  validateManagementRejection,
} from '@/services/ot-workflow';

export function useOTApprovalShared() {
  const queryClient = useQueryClient();

  /**
   * Group OT requests by employee and date for display
   */
  function groupOTRequestsByEmployee(requests: OTRequest[]): GroupedOTRequest[] {
    const grouped = new Map<string, GroupedOTRequest>();

    requests.forEach((request) => {
      const key = `${request.employee_id}_${request.ot_date}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...request,
          profiles: request.profiles,
          sessions: [],
          total_hours: 0,
          request_ids: [],
          ot_amount: 0,
        });
      }

      const group = grouped.get(key)!;
      group.sessions.push({
        id: request.id,
        start_time: request.start_time,
        end_time: request.end_time,
        total_hours: request.total_hours,
        status: request.status,
        reason: request.reason,
        attachment_urls: request.attachment_urls,
      });

      group.total_hours += request.total_hours;
      group.request_ids.push(request.id);

      if (request.ot_amount) {
        group.ot_amount = (group.ot_amount || 0) + request.ot_amount;
      }
    });

    return Array.from(grouped.values());
  }

  /**
   * Filter requests by status and role
   */
  function filterRequestsByRole(
    requests: OTRequest[],
    role: 'supervisor' | 'hr' | 'management',
    statusFilter?: string
  ): OTRequest[] {
    let filtered = requests;

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        filtered = filtered.filter((r) =>
          ['supervisor_confirmed', 'supervisor_verified', 'hr_certified', 'management_approved'].includes(
            r.status
          )
        );
      } else if (statusFilter === 'pending_certification') {
        filtered = filtered.filter((r) =>
          ['supervisor_confirmed', 'supervisor_verified'].includes(r.status)
        );
      } else if (statusFilter === 'rejected') {
        filtered = filtered.filter((r) => r.status === 'rejected');
      } else if (statusFilter === 'all') {
        // No filter
      } else {
        filtered = filtered.filter((r) => r.status === (statusFilter as OTStatus));
      }
    } else {
      // Default filters by role
      switch (role) {
        case 'supervisor':
          filtered = filtered.filter((r) =>
            ['pending_verification', 'pending_supervisor_verification', 'pending_respective_supervisor_confirmation'].includes(
              r.status
            )
          );
          break;
        case 'hr':
          filtered = filtered.filter((r) =>
            ['supervisor_confirmed', 'supervisor_verified'].includes(r.status)
          );
          break;
        case 'management':
          filtered = filtered.filter((r) => r.status === 'hr_certified');
          break;
      }
    }

    return filtered;
  }

  /**
   * Determine route type (A or B) for a request
   */
  function getRoute(request: OTRequest): 'A' | 'B' {
    return getRequestRoute(request);
  }

  /**
   * Check if request can be edited by the given role at current status
   */
  function canEditRequest(request: OTRequest, role: string): boolean {
    switch (role) {
      case 'supervisor':
        return ['pending_verification', 'pending_supervisor_verification', 'pending_respective_supervisor_confirmation'].includes(
          request.status
        );
      case 'hr':
        return ['supervisor_confirmed', 'supervisor_verified'].includes(request.status);
      case 'management':
        return request.status === 'hr_certified';
      default:
        return false;
    }
  }

  // Management approval mutation (hr_certified → management_approved)
  const managementApproveMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; remarks?: string }) => {
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

      // Notify employee
      try {
        for (const requestId of input.requestIds) {
          await supabase.functions.invoke('send-employee-ot-notification', {
            body: { requestId, notificationType: 'approved' },
          });
        }
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      toast.success('Requests approved by management');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve requests');
    },
  });

  // Management rejection mutation (management_approved → hr_certified)
  const managementRejectMutation = useMutation({
    mutationFn: async (input: { requestIds: string[]; remarks?: string }) => {
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
        await supabase.functions.invoke('send-hr-certification-notification', {
          body: { requestIds: input.requestIds, type: 'recertification' },
        });
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      toast.success('Requests sent back to HR for recertification');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject requests');
    },
  });

  return {
    // Helper functions
    groupOTRequestsByEmployee,
    filterRequestsByRole,
    getRoute,
    canEditRequest,

    // Management mutations
    managementApprove: managementApproveMutation.mutate,
    isManagementApproving: managementApproveMutation.isPending,
    managementReject: managementRejectMutation.mutate,
    isManagementRejecting: managementRejectMutation.isPending,
  };
}
