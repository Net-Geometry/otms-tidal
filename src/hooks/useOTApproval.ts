import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest, OTStatus, AppRole, GroupedOTRequest, ConfirmRequestInput } from '@/types/otms';
import { toast } from 'sonner';
import { validateConfirmationTransition, validateRemarks, isLegacyRequest } from '@/services/ot-workflow';

/**
 * Send employee notification via Edge Function
 * Wrapped in try-catch to ensure notification failures don't break approval/rejection workflow
 */
async function sendEmployeeNotification(requestId: string, notificationType: 'approved' | 'rejected'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.warn('No active session for sending employee notification');
    return;
  }

  const response = await supabase.functions.invoke('send-employee-ot-notification', {
    body: {
      requestId,
      notificationType
    }
  });

  if (response.error) {
    throw new Error(`Notification error: ${response.error.message}`);
  }

  console.log('Employee notification sent:', response.data);
}

type ApprovalRole = 'supervisor' | 'hr' | 'management';

interface UseOTApprovalOptions {
  role: ApprovalRole;
  status?: string;
}

interface ApprovalAction {
  requestIds: string[];
  remarks?: string;
}

// Helper function to group OT requests by employee and date
function groupOTRequestsByEmployee(requests: any[]): GroupedOTRequest[] {
  const grouped = new Map<string, any>();
  
  requests.forEach(request => {
    const key = `${request.employee_id}_${request.ot_date}`;
    
    if (!grouped.has(key)) {
      // Preserve the first request's profile data
      grouped.set(key, {
        ...request,
        profiles: request.profiles, // Explicitly preserve the profiles object
        sessions: [],
        total_hours: 0,
        request_ids: [],
        start_time: '',
        end_time: '',
      });
      
      // Add debug warning if profile data is missing
      if (!request.profiles) {
        console.warn(`Missing profile data for employee_id: ${request.employee_id}`);
      }
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
    
    // Accumulate OT amounts
    if (request.ot_amount) {
      group.ot_amount = (group.ot_amount || 0) + request.ot_amount;
    }
  });
  
  return Array.from(grouped.values());
}

// Map roles to their respective status filters
const getStatusFilter = (role: ApprovalRole, statusFilter?: string): OTStatus[] => {
  if (statusFilter && statusFilter !== 'all') {
    // Handle "completed" as a special case that includes multiple statuses
    if (statusFilter === 'completed') {
      return ['supervisor_verified', 'hr_certified', 'management_approved'];
    }
    return [statusFilter as OTStatus];
  }

  // Handle "all" case specifically for each role
  if (statusFilter === 'all') {
    if (role === 'supervisor') {
      return ['pending_verification', 'supervisor_verified', 'hr_certified', 'management_approved', 'rejected'];
    }
    if (role === 'hr') {
      return ['pending_verification', 'supervisor_verified', 'rejected'];
    }
    if (role === 'management') {
      return ['hr_certified', 'management_approved', 'rejected'];
    }
  }

  switch (role) {
    case 'supervisor':
      return ['pending_verification'];
    case 'hr':
      // HR sees supervisor-confirmed requests and legacy supervisor-verified requests
      return ['supervisor_confirmed', 'supervisor_verified'];
    case 'management':
      return ['hr_certified'];
    default:
      return [];
  }
};

// Map roles to their next status after approval
const getApprovedStatus = (role: ApprovalRole): OTStatus => {
  switch (role) {
    case 'supervisor':
      // Updated: After supervisor verification, request goes to pending confirmation
      return 'pending_supervisor_confirmation';
    case 'hr':
      return 'hr_certified';
    case 'management':
      return 'management_approved';
    default:
      return 'hr_certified';
  }
};

// Map roles to their remarks field names
const getRemarksField = (role: ApprovalRole): string => {
  switch (role) {
    case 'supervisor':
      return 'supervisor_remarks';
    case 'hr':
      return 'hr_remarks';
    case 'management':
      return 'management_remarks';
    default:
      return 'management_remarks';
  }
};

// Map roles to their timestamp field names
const getTimestampField = (role: ApprovalRole): string => {
  switch (role) {
    case 'supervisor':
      return 'supervisor_verified_at';
    case 'hr':
      return 'hr_approved_at';
    case 'management':
      return 'management_reviewed_at';
    default:
      return 'management_reviewed_at';
  }
};

// Map roles to their ID field names
const getIdField = (role: ApprovalRole): string | null => {
  switch (role) {
    case 'supervisor':
      return 'supervisor_id';
    case 'hr':
      return 'hr_id';
    case 'management':
      return null; // Management doesn't have a dedicated ID field
    default:
      return null;
  }
};

export function useOTApproval(options: UseOTApprovalOptions) {
  const queryClient = useQueryClient();
  const { role, status } = options;
  const queryKey = [`${role}-ot-approvals`, status];

  // Fetch OT requests based on role
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('ot_requests')
        .select(`
          *,
          profiles!ot_requests_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            basic_salary,
            departments(name)
          )
        `)
        .order('ot_date', { ascending: false });

      // Apply status filter
      const statuses = getStatusFilter(role, status);
      if (statuses.length > 0) {
        // Use .in() for multi-status filters ('completed', 'all' for supervisor)
        if (status === 'completed' || (status === 'all' && role === 'supervisor')) {
          query = query.in('status', statuses);
        } else if (status && status !== 'all') {
          // Single status filter
          query = query.eq('status', status as OTStatus);
        } else {
          // Fallback for other 'all' cases
          query = query.in('status', statuses);
        }
      }

      // Apply role-specific filters
      if (role === 'supervisor') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // First, get employee IDs that this supervisor manages
          const { data: employees } = await supabase
            .from('profiles')
            .select('id')
            .eq('supervisor_id', user.id);
          
          if (employees && employees.length > 0) {
            const employeeIds = employees.map(e => e.id);
            query = query.in('employee_id', employeeIds);
          } else {
            // No employees found, return empty result
            query = query.eq('employee_id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as OTRequest[];
    },
  });

  // Approve mutation - now supports batch operations
  const approveMutation = useMutation({
    mutationFn: async ({ requestIds, remarks }: ApprovalAction) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const updateData: any = {
        status: getApprovedStatus(role),
        [getRemarksField(role)]: remarks || null,
        [getTimestampField(role)]: new Date().toISOString(),
      };

      // Add ID field if applicable
      const idField = getIdField(role);
      if (idField) {
        updateData[idField] = user.id;
      }

      // Batch update all request IDs
      const { error } = await supabase
        .from('ot_requests')
        .update(updateData)
        .in('id', requestIds);

      if (error) throw error;

      // Send approval notifications to employees asynchronously (don't block approval workflow)
      requestIds.forEach(requestId => {
        sendEmployeeNotification(requestId, 'approved').catch((notifError) => {
          console.error('Failed to send employee approval notification:', notifError);
          // Don't throw - notification failure should not prevent approval
        });
      });

      return { requestIds };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey });
      const actionLabel = role === 'supervisor' ? 'verified' : role === 'hr' ? 'approved' : 'reviewed';
      toast.success(`OT request ${actionLabel} successfully`);

      // For supervisor role: trigger confirmation request notification
      if (role === 'supervisor' && data?.requestIds) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.warn('No user session for sending confirmation notification');
            return;
          }

          // Send notification for each verified request
          for (const requestId of data.requestIds) {
            try {
              const response = await supabase.functions.invoke('send-supervisor-confirmation-notification', {
                body: {
                  requestId,
                  employeeId: user.id
                }
              });

              if (response.error) {
                console.error('Failed to send confirmation notification:', response.error);
              } else {
                console.log('Confirmation notification sent successfully:', response.data);
              }
            } catch (notifError) {
              console.error('Error sending confirmation notification (non-blocking):', notifError);
            }
          }
        } catch (error) {
          console.error('Failed to trigger confirmation notifications (non-blocking):', error);
        }
      }
    },
    onError: (error) => {
      toast.error(`Failed to approve request: ${error.message}`);
    },
  });

  // Reject mutation - now supports batch operations with rejection stage
  const rejectMutation = useMutation({
    mutationFn: async ({ requestIds, remarks, rejectionStage }: ApprovalAction & { rejectionStage?: string }) => {
      if (!remarks || remarks.trim() === '') {
        throw new Error('Remarks are required when rejecting a request');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Management rejection goes to HR recertification instead of final rejection
      const status = role === 'management' ? 'pending_hr_recertification' : 'rejected';

      const updateData: any = {
        status: status,
        [getRemarksField(role)]: remarks,
        [getTimestampField(role)]: new Date().toISOString(),
        rejection_stage: rejectionStage || role,
      };

      // Add ID field if applicable
      const idField = getIdField(role);
      if (idField) {
        updateData[idField] = user.id;
      }

      // Batch update all request IDs
      const { error } = await supabase
        .from('ot_requests')
        .update(updateData)
        .in('id', requestIds);

      if (error) throw error;

      // Send rejection notifications to employees asynchronously (don't block rejection workflow)
      requestIds.forEach(requestId => {
        sendEmployeeNotification(requestId, 'rejected').catch((notifError) => {
          console.error('Failed to send employee rejection notification:', notifError);
          // Don't throw - notification failure should not prevent rejection
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('OT request rejected');
    },
    onError: (error) => {
      toast.error(`Failed to reject request: ${error.message}`);
    },
  });

  // Confirm mutation - new supervisor confirmation step after verification
  const confirmMutation = useMutation({
    mutationFn: async ({ requestIds, remarks }: ConfirmRequestInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate remarks length if provided
      const remarksValidation = validateRemarks(remarks);
      if (!remarksValidation.valid) {
        throw new Error(remarksValidation.error);
      }

      // Fetch the requests to validate
      const { data: requests, error: fetchError } = await supabase
        .from('ot_requests')
        .select('*')
        .in('id', requestIds);

      if (fetchError) throw fetchError;
      if (!requests || requests.length === 0) {
        throw new Error('No requests found');
      }

      // Validate each request
      const validationErrors: string[] = [];
      requests.forEach((request: any) => {
        // Skip legacy requests
        if (isLegacyRequest(request)) {
          validationErrors.push(`Request ${request.id} is a legacy request and cannot be confirmed`);
          return;
        }

        const validation = validateConfirmationTransition(request, user.id);
        if (!validation.valid) {
          validationErrors.push(`Request ${request.id}: ${validation.error}`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Perform batch confirmation
      const updateData = {
        status: 'supervisor_confirmed' as OTStatus,
        supervisor_confirmation_at: new Date().toISOString(),
        supervisor_confirmation_remarks: remarks || null,
      };

      const { error } = await supabase
        .from('ot_requests')
        .update(updateData)
        .in('id', requestIds);

      if (error) throw error;

      return { requestIds, success: true };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-dashboard-metrics'] });
      
      const count = data.requestIds.length;
      toast.success(`${count} OT request${count > 1 ? 's' : ''} confirmed successfully`);

      // Send confirmation success notification to employees
      try {
        for (const requestId of data.requestIds) {
          try {
            const response = await supabase.functions.invoke('send-employee-confirmation-notification', {
              body: {
                requestId
              }
            });

            if (response.error) {
              console.error('Failed to send employee confirmation notification:', response.error);
            } else {
              console.log('Employee confirmation notification sent successfully:', response.data);
            }
          } catch (notifError) {
            console.error('Error sending employee confirmation notification (non-blocking):', notifError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger employee notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to confirm request: ${error.message}`);
    },
  });

  return {
    requests: groupOTRequestsByEmployee(data || []),
    isLoading,
    error,
    approveRequest: approveMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    confirmRequest: confirmMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isConfirming: confirmMutation.isPending,
  };
}
