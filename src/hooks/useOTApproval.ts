import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OTRequest, OTStatus, AppRole, GroupedOTRequest, ConfirmRequestInput, ConfirmRespectiveSupervisorInput, DenyRespectiveSupervisorInput, RequestRespectiveSupervisorConfirmationInput } from '@/types/otms';
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

/**
 * Send management notification via Edge Function
 * Called when HR certifies an OT request to notify management users
 */
async function sendManagementNotification(requestId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.warn('No active session for sending management notification');
    return;
  }

  const response = await supabase.functions.invoke('send-management-ot-notification', {
    body: {
      requestId
    }
  });

  if (response.error) {
    throw new Error(`Management notification error: ${response.error.message}`);
  }

  console.log('Management notification sent:', response.data);
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
        ot_amount: 0, // Initialize to 0 - will sum proportional amounts from each session
        orp: request.orp || 0,
        hrp: request.hrp || 0,
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
    // Handle "pending_certification" - HR's pending certification tab that shows all certifiable statuses
    if (statusFilter === 'pending_certification' && role === 'hr') {
      return ['supervisor_verified', 'supervisor_confirmed', 'respective_supervisor_confirmed'];
    }
    return [statusFilter as OTStatus];
  }

  // Handle "all" case specifically for each role
  if (statusFilter === 'all') {
    if (role === 'supervisor') {
      return ['pending_verification', 'pending_supervisor_confirmation', 'pending_respective_supervisor_confirmation', 'pending_supervisor_review', 'supervisor_verified', 'supervisor_confirmed', 'respective_supervisor_confirmed', 'hr_certified', 'management_approved', 'rejected'];
    }
    if (role === 'hr') {
      return ['pending_verification', 'supervisor_verified', 'supervisor_confirmed', 'respective_supervisor_confirmed', 'rejected'];
    }
    if (role === 'management') {
      return ['hr_certified', 'management_approved', 'rejected', 'pending_hr_recertification'];
    }
  }

  switch (role) {
    case 'supervisor':
      return ['pending_verification'];
    case 'hr':
      // HR sees supervisor-confirmed, respective supervisor confirmed, and legacy supervisor-verified requests
      return ['supervisor_confirmed', 'respective_supervisor_confirmed', 'supervisor_verified'];
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
      return 'hr_remarks';
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
      return 'hr_approved_at';
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
        // Use .in() for multi-status filters ('completed', 'all' for supervisor, 'pending_certification' for HR)
        if (status === 'completed' || (status === 'all' && role === 'supervisor') || (status === 'pending_certification' && role === 'hr')) {
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
          // Get employee IDs that this supervisor manages
          const { data: employees } = await supabase
            .from('profiles')
            .select('id')
            .eq('supervisor_id', user.id);

          const employeeIds = employees?.map(e => e.id) || [];

          // Apply status-specific filtering for supervisors
          // This ensures proper separation of roles based on request status
          // Note: RLS policy now restricts supervisors to only their direct reports or as respective supervisor
          if (status === 'pending_supervisor_confirmation') {
            // Only show pending_supervisor_confirmation for direct supervisors
            // (requests from employees they manage)
            if (employeeIds.length > 0) {
              query = query.in('employee_id', employeeIds);
            } else {
              // If supervisor has no direct employees, return empty by filtering on a false condition
              query = query.filter('id', 'is', null);
            }
          } else if (status === 'pending_respective_supervisor_confirmation') {
            // Only show pending_respective_supervisor_confirmation for respective supervisors
            query = query.eq('respective_supervisor_id', user.id);
          } else if (status === 'pending_supervisor_review') {
            // Only direct supervisors see this (requests from their employees that were denied)
            if (employeeIds.length > 0) {
              query = query.in('employee_id', employeeIds);
            } else {
              // If supervisor has no direct employees, return empty by filtering on a false condition
              query = query.filter('id', 'is', null);
            }
          } else if (status === 'pending_verification') {
            // For pending_verification, show requests for direct reports (with or without respective supervisor)
            if (employeeIds.length > 0) {
              query = query.in('employee_id', employeeIds);
            } else {
              // If supervisor has no direct employees, return empty by filtering on a false condition
              query = query.filter('id', 'is', null);
            }
          } else {
            // For other statuses (completed, rejected, etc.), show both:
            // 1. Requests for managed employees
            // 2. Requests where user is the respective supervisor
            if (employeeIds.length > 0) {
              const employeeFilter = employeeIds.map(id => `employee_id.eq.${id}`).join(',');
              query = query.or(`${employeeFilter},respective_supervisor_id.eq.${user.id}`);
            } else {
              // No managed employees, but still show requests where user is the respective supervisor
              query = query.eq('respective_supervisor_id', user.id);
            }
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

      // For supervisor role in Flow A (no respective supervisor), do single-step approval
      let targetStatus = getApprovedStatus(role);

      if (role === 'supervisor') {
        // Fetch requests to check if they have respective supervisors
        const { data: requests, error: fetchError } = await supabase
          .from('ot_requests')
          .select('id, respective_supervisor_id, status')
          .in('id', requestIds);

        if (fetchError) throw fetchError;

        // Check if all requests are Flow A (no respective supervisor and in pending_verification)
        const allFlowA = requests?.every(
          req => req.status === 'pending_verification' && !req.respective_supervisor_id
        );

        if (allFlowA) {
          // Flow A: Single-step approval directly to supervisor_confirmed
          targetStatus = 'supervisor_confirmed';
        }
        // Otherwise: Flow B or legacy flow - use normal pending_supervisor_confirmation
      }

      const updateData: any = {
        status: targetStatus,
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

      // If HR is certifying, send notifications to management users
      if (role === 'hr' && getApprovedStatus(role) === 'hr_certified') {
        requestIds.forEach(requestId => {
          sendManagementNotification(requestId).catch((notifError) => {
            console.error('Failed to send management notification:', notifError);
            // Don't throw - notification failure should not prevent approval
          });
        });
      }
      // Return target status for use in onSuccess
      return { requestIds, targetStatus };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey });
      const actionLabel = role === 'supervisor' ? 'verified' : role === 'hr' ? 'approved' : 'reviewed';
      toast.success(`OT request ${actionLabel} successfully`);

      // For supervisor role: trigger confirmation request notification (only for Flow B, not Flow A)
      // Flow A goes directly to supervisor_confirmed, so no confirmation notification needed
      if (role === 'supervisor' && data?.requestIds && data?.targetStatus === 'pending_supervisor_confirmation') {
        try {
          // Fetch the OT requests to get employee IDs
          const { data: requests, error: fetchError } = await supabase
            .from('ot_requests')
            .select('id, employee_id')
            .in('id', data.requestIds);

          if (fetchError) {
            console.error('Failed to fetch OT requests for notifications:', fetchError);
            return;
          }

          if (!requests || requests.length === 0) {
            console.warn('No OT requests found for confirmation notifications');
            return;
          }

          // Send notification for each verified request
          for (const request of requests) {
            try {
              const response = await supabase.functions.invoke('send-supervisor-confirmation-notification', {
                body: {
                  requestId: request.id,
                  employeeId: request.employee_id
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

      // Management rejection sends back to HR for recertification, others get final rejection
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
      requests.forEach((request: OTRequest) => {
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

      // Perform batch confirmation with status determination per request
      // Multi-step flow (with respective supervisor already confirmed) → supervisor_verified
      // Single-step flow (no respective supervisor) → supervisor_confirmed
      const baseUpdateData = {
        supervisor_confirmation_at: new Date().toISOString(),
        supervisor_confirmation_remarks: remarks || null,
      };

      // Group requests by target status
      const multiStepRequests = requests.filter(
        req => req.respective_supervisor_id && req.respective_supervisor_confirmed_at
      );
      const singleStepRequests = requests.filter(
        req => !req.respective_supervisor_id || !req.respective_supervisor_confirmed_at
      );

      // Update multi-step requests to supervisor_verified
      if (multiStepRequests.length > 0) {
        const { error } = await supabase
          .from('ot_requests')
          .update({
            ...baseUpdateData,
            status: 'supervisor_verified' as OTStatus,
          })
          .in('id', multiStepRequests.map(r => r.id));

        if (error) throw error;
      }

      // Update single-step requests to supervisor_confirmed
      if (singleStepRequests.length > 0) {
        const { error } = await supabase
          .from('ot_requests')
          .update({
            ...baseUpdateData,
            status: 'supervisor_confirmed' as OTStatus,
          })
          .in('id', singleStepRequests.map(r => r.id));

        if (error) throw error;
      }

      return { requestIds, success: true };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['ot-requests'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-dashboard-metrics'] });
      
      const count = data.requestIds.length;
      toast.success(`${count} OT request${count > 1 ? 's' : ''} confirmed successfully`);

      // Send confirmation success notifications
      try {
        for (const requestId of data.requestIds) {
          try {
            // Fetch request to check if respective supervisor is involved
            const { data: request, error: fetchError } = await supabase
              .from('ot_requests')
              .select('respective_supervisor_id, respective_supervisor_confirmed_at')
              .eq('id', requestId)
              .maybeSingle();

            if (fetchError) {
              console.error('Failed to fetch request details:', fetchError);
            } else if (request && request.respective_supervisor_id && request.respective_supervisor_confirmed_at) {
              // Notify respective supervisor that direct supervisor completed final approval
              try {
                const respSvResponse = await supabase.functions.invoke('send-supervisor-confirmation-approved-notification', {
                  body: {
                    requestId
                  }
                });

                if (respSvResponse.error) {
                  console.error('Failed to send respective supervisor notification:', respSvResponse.error);
                } else {
                  console.log('Respective supervisor notification sent successfully:', respSvResponse.data);
                }
              } catch (notifError) {
                console.error('Error sending respective supervisor notification (non-blocking):', notifError);
              }
            }

            // Send HR certification notification
            try {
              const hrResponse = await supabase.functions.invoke('send-hr-certification-notification', {
                body: {
                  requestId
                }
              });

              if (hrResponse.error) {
                console.error('Failed to send HR certification notification:', hrResponse.error);
              } else {
                console.log('HR certification notification sent successfully:', hrResponse.data);
              }
            } catch (notifError) {
              console.error('Error sending HR certification notification (non-blocking):', notifError);
            }

            // Send employee confirmation notification
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
          } catch (requestError) {
            console.error('Error processing notifications for request:', requestError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to confirm request: ${error.message}`);
    },
  });

  // Request respective supervisor confirmation mutation
  const requestRespectiveSupervisorConfirmationMutation = useMutation({
    mutationFn: async ({ requestIds }: RequestRespectiveSupervisorConfirmationInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

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
      requests.forEach((request: OTRequest) => {
        if (request.status !== 'pending_supervisor_confirmation') {
          validationErrors.push(`Request ${request.id} is not pending supervisor confirmation`);
        }

        if (request.supervisor_id !== user.id) {
          validationErrors.push(`Request ${request.id} is not assigned to you`);
        }

        if (!request.respective_supervisor_id) {
          validationErrors.push(`Request ${request.id} does not have a respective supervisor assigned`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Update status to pending_respective_supervisor_confirmation
      const updateData = {
        status: 'pending_respective_supervisor_confirmation' as OTStatus,
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
      toast.success(`Confirmation requested from respective supervisor for ${count} OT request${count > 1 ? 's' : ''}`);

      // Send notification to respective supervisor
      try {
        for (const requestId of data.requestIds) {
          try {
            const response = await supabase.functions.invoke('send-respective-supervisor-confirmation-request', {
              body: {
                requestId
              }
            });

            if (response.error) {
              console.error('Failed to send respective supervisor notification:', response.error);
            } else {
              console.log('Respective supervisor notification sent successfully:', response.data);
            }
          } catch (notifError) {
            console.error('Error sending respective supervisor notification (non-blocking):', notifError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger respective supervisor notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to request confirmation: ${error.message}`);
    },
  });

  // Respective supervisor confirm mutation - confirms supervisor's verification
  const confirmRespectiveSupervisorMutation = useMutation({
    mutationFn: async ({ requestIds, remarks }: ConfirmRespectiveSupervisorInput) => {
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

      // Validate each request - must be in pending_respective_supervisor_confirmation status
      const validationErrors: string[] = [];
      requests.forEach((request: OTRequest) => {
        if (request.status !== 'pending_respective_supervisor_confirmation') {
          validationErrors.push(`Request ${request.id} is not pending respective supervisor confirmation`);
        }

        if (request.respective_supervisor_id !== user.id) {
          validationErrors.push(`Request ${request.id} is not assigned to you for confirmation`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Perform batch confirmation - send back to pending_supervisor_confirmation
      const updateData = {
        status: 'pending_supervisor_confirmation' as OTStatus,
        respective_supervisor_confirmed_at: new Date().toISOString(),
        respective_supervisor_remarks: remarks || null,
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

      // Send confirmation success notifications to direct supervisor and employee
      try {
        for (const requestId of data.requestIds) {
          try {
            // Notify direct supervisor that respective supervisor confirmed
            const supervisorResponse = await supabase.functions.invoke('send-respective-supervisor-confirmed-notification', {
              body: {
                requestId
              }
            });

            if (supervisorResponse.error) {
              console.error('Failed to send direct supervisor notification:', supervisorResponse.error);
            } else {
              console.log('Direct supervisor notification sent successfully:', supervisorResponse.data);
            }
          } catch (notifError) {
            console.error('Error sending direct supervisor notification (non-blocking):', notifError);
          }

          try {
            // Also notify employee that request is progressing through respective supervisor
            const employeeResponse = await supabase.functions.invoke('send-employee-confirmation-notification', {
              body: {
                requestId
              }
            });

            if (employeeResponse.error) {
              console.error('Failed to send employee progress notification:', employeeResponse.error);
            } else {
              console.log('Employee progress notification sent successfully:', employeeResponse.data);
            }
          } catch (notifError) {
            console.error('Error sending employee progress notification (non-blocking):', notifError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to confirm request: ${error.message}`);
    },
  });

  // Respective supervisor deny mutation - sends back to supervisor for review
  const denyRespectiveSupervisorMutation = useMutation({
    mutationFn: async ({ requestIds, denialRemarks }: DenyRespectiveSupervisorInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate denial remarks
      if (!denialRemarks || denialRemarks.trim().length < 10) {
        throw new Error('Denial remarks must be at least 10 characters');
      }

      const remarksValidation = validateRemarks(denialRemarks);
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
      requests.forEach((request: OTRequest) => {
        if (request.status !== 'pending_respective_supervisor_confirmation') {
          validationErrors.push(`Request ${request.id} is not pending respective supervisor confirmation`);
        }

        if (request.respective_supervisor_id !== user.id) {
          validationErrors.push(`Request ${request.id} is not assigned to you for confirmation`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Update status to pending_supervisor_review
      const updateData = {
        status: 'pending_supervisor_review' as OTStatus,
        respective_supervisor_denied_at: new Date().toISOString(),
        respective_supervisor_denial_remarks: denialRemarks,
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
      toast.success(`${count} OT request${count > 1 ? 's' : ''} sent back to supervisor for review`);

      // Send denial notification to direct supervisor
      try {
        for (const requestId of data.requestIds) {
          try {
            const response = await supabase.functions.invoke('send-respective-supervisor-denied-notification', {
              body: {
                requestId
              }
            });

            if (response.error) {
              console.error('Failed to send denial notification:', response.error);
            } else {
              console.log('Denial notification sent successfully:', response.data);
            }
          } catch (notifError) {
            console.error('Error sending denial notification (non-blocking):', notifError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger denial notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to deny request: ${error.message}`);
    },
  });

  // Revise and resubmit denied requests back to respective supervisor
  const reviseDeniedRequestMutation = useMutation({
    mutationFn: async ({ requestIds, remarks }: { requestIds: string[], remarks?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate remarks length if provided
      if (remarks) {
        const remarksValidation = validateRemarks(remarks);
        if (!remarksValidation.valid) {
          throw new Error(remarksValidation.error);
        }
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
      requests.forEach((request: OTRequest) => {
        if (request.status !== 'pending_supervisor_review') {
          validationErrors.push(`Request ${request.id} is not pending supervisor review`);
        }

        if (request.supervisor_id !== user.id) {
          validationErrors.push(`Request ${request.id} is not assigned to you`);
        }

        if (!request.respective_supervisor_id) {
          validationErrors.push(`Request ${request.id} has no respective supervisor assigned`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Update status back to pending_respective_supervisor_confirmation
      // Keep the denial records for audit trail but add supervisor's revision remarks
      const updateData: any = {
        status: 'pending_respective_supervisor_confirmation' as OTStatus,
      };

      // If supervisor adds remarks about the revision, update supervisor_remarks
      if (remarks) {
        updateData.supervisor_remarks = remarks;
      }

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
      toast.success(`${count} OT request${count > 1 ? 's' : ''} resubmitted to respective supervisor`);

      // Send notification to respective supervisor that request has been revised and resubmitted
      try {
        for (const requestId of data.requestIds) {
          try {
            const response = await supabase.functions.invoke('send-respective-supervisor-confirmation-request', {
              body: {
                requestId
              }
            });

            if (response.error) {
              console.error('Failed to send resubmission notification:', response.error);
            } else {
              console.log('Resubmission notification sent successfully:', response.data);
            }
          } catch (notifError) {
            console.error('Error sending resubmission notification (non-blocking):', notifError);
          }
        }
      } catch (error) {
        console.error('Failed to trigger resubmission notifications (non-blocking):', error);
      }
    },
    onError: (error) => {
      toast.error(`Failed to resubmit request: ${error.message}`);
    },
  });

  return {
    requests: groupOTRequestsByEmployee(data || []),
    isLoading,
    error,
    approveRequest: approveMutation.mutateAsync,
    rejectRequest: rejectMutation.mutateAsync,
    confirmRequest: confirmMutation.mutateAsync,
    requestRespectiveSupervisorConfirmation: requestRespectiveSupervisorConfirmationMutation.mutateAsync,
    confirmRespectiveSupervisor: confirmRespectiveSupervisorMutation.mutateAsync,
    denyRespectiveSupervisor: denyRespectiveSupervisorMutation.mutateAsync,
    reviseDeniedRequest: reviseDeniedRequestMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isConfirming: confirmMutation.isPending,
    isRequestingRespectiveSupervisorConfirmation: requestRespectiveSupervisorConfirmationMutation.isPending,
    isConfirmingRespectiveSupervisor: confirmRespectiveSupervisorMutation.isPending,
    isDenyingRespectiveSupervisor: denyRespectiveSupervisorMutation.isPending,
    isRevisingDeniedRequest: reviseDeniedRequestMutation.isPending,
  };
}
