import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle, XCircle, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { GroupedOTRequest } from '@/types/otms';
import { formatTime12Hour, formatHours } from '@/lib/otCalculations';
import { getStatusTooltip } from '@/lib/otStatusTooltip';
import { OTApprovalDetailsSheet } from './OTApprovalDetailsSheet';
import { RejectOTModal } from './RejectOTModal';
import { Badge } from '@/components/ui/badge';

type ApprovalRole = 'supervisor' | 'hr' | 'management';

interface OTApprovalTableProps {
  requests: GroupedOTRequest[];
  isLoading: boolean;
  role: ApprovalRole;
  currentUserId?: string;
  approveRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  rejectRequest?: (requestIds: string[], remarks: string) => Promise<void>;
  confirmRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  confirmRespectiveSupervisor?: (requestIds: string[], remarks?: string) => Promise<void>;
  denyRespectiveSupervisor?: (requestIds: string[], denialRemarks: string) => Promise<void>;
  reviseDeniedRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  isApproving?: boolean;
  isRejecting?: boolean;
  isConfirming?: boolean;
  isConfirmingRespectiveSupervisor?: boolean;
  isDenyingRespectiveSupervisor?: boolean;
  isRevisingDeniedRequest?: boolean;
  showActions?: boolean;
  showApprovalHistory?: boolean;
  initialSelectedRequestId?: string | null;
}

export function OTApprovalTable({
  requests,
  isLoading,
  role,
  currentUserId,
  approveRequest,
  rejectRequest,
  confirmRequest,
  confirmRespectiveSupervisor,
  denyRespectiveSupervisor,
  reviseDeniedRequest,
  isApproving,
  isRejecting,
  isConfirming,
  isConfirmingRespectiveSupervisor,
  isDenyingRespectiveSupervisor,
  isRevisingDeniedRequest,
  showActions = true,
  showApprovalHistory = false,
  initialSelectedRequestId = null
}: OTApprovalTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<GroupedOTRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<{ request: GroupedOTRequest; sessionIds: string[] } | null>(null);
  const [confirmingRequest, setConfirmingRequest] = useState<GroupedOTRequest | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);

  // Auto-open request from parent component
  useEffect(() => {
    if (initialSelectedRequestId && requests.length > 0) {
      const request = requests.find(r => r.id === initialSelectedRequestId);
      if (request) {
        setSelectedRequest(request);
      }
    }
  }, [initialSelectedRequestId, requests]);

  const handleApprove = async (request: GroupedOTRequest, sessionIds: string[]) => {
    if (!approveRequest) return;
    setApprovingRequestId(request.id);
    try {
      await approveRequest(sessionIds);
      setSelectedRequest(null);
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleReject = (request: GroupedOTRequest, sessionIds: string[]) => {
    setRejectingRequest({ request, sessionIds });
  };

  const handleRejectConfirm = async (remarks: string) => {
    if (!rejectRequest || !rejectingRequest) return;
    try {
      await rejectRequest(rejectingRequest.sessionIds, remarks);
      setRejectingRequest(null);
      setSelectedRequest(null);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleConfirm = (request: GroupedOTRequest) => {
    setSelectedRequest(request);
  };

  const handleConfirmSubmit = async (requestIds: string[], remarks?: string) => {
    if (!confirmRequest) return;
    try {
      await confirmRequest(requestIds, remarks);
      setConfirmingRequest(null);
    } catch (error) {
      // Error is handled by the hook
      throw error;
    }
  };

  // Route A: Supervisor approval (pending_verification → supervisor_confirmed)
  const canApproveSupervisor = (request: GroupedOTRequest) => {
    return role === 'supervisor' && request.status === 'pending_verification' && !request.respective_supervisor_id;
  };

  // Route B: Respective supervisor confirmation (pending_respective_supervisor_confirmation → respective_supervisor_confirmed or rejected)
  // Only the RESPECTIVE supervisor can confirm, not the direct supervisor
  // Note: Backend validation ensures only the actual respective supervisor can perform actions
  const canConfirmRespectiveSupervisor = (request: GroupedOTRequest) => {
    return role === 'supervisor' && 
           request.status === 'pending_respective_supervisor_confirmation' &&
           request.respective_supervisor_id &&
           confirmRespectiveSupervisor && denyRespectiveSupervisor; // Only if callbacks are provided
  };

  // Route B: Direct supervisor verification (pending_supervisor_verification → supervisor_verified)
  const canVerifySupervisor = (request: GroupedOTRequest) => {
    return role === 'supervisor' && request.status === 'pending_supervisor_verification' && request.respective_supervisor_id;
  };

  // HR Certification (supervisor_confirmed or supervisor_verified → hr_certified)
  const canHRCertify = (request: GroupedOTRequest) => {
    return role === 'hr' && (request.status === 'supervisor_confirmed' || request.status === 'supervisor_verified');
  };

  // HR Rejection (hr_certified → pending_verification or pending_respective_supervisor_confirmation)
  const canHRReject = (request: GroupedOTRequest) => {
    return role === 'hr' && request.status === 'hr_certified';
  };

  // Management Approval (hr_certified → management_approved)
  const canManagementApprove = (request: GroupedOTRequest) => {
    return role === 'management' && request.status === 'hr_certified';
  };

  // Management Rejection (management_approved → hr_certified)
  const canManagementReject = (request: GroupedOTRequest) => {
    return role === 'management' && request.status === 'management_approved';
  };

  // Supervisor/HR can review and revise a denied request
  const canReviewDeniedRequest = (request: GroupedOTRequest) => {
    return (role === 'supervisor' || role === 'hr') && request.status === 'rejected';
  };

  // Old compatibility method
  const canApproveOrReject = (request: GroupedOTRequest) => {
    // Direct supervisor should NOT be able to act on requests pending respective supervisor confirmation
    if (role === 'supervisor' && request.status === 'pending_respective_supervisor_confirmation') {
      return false;
    }
    if (role === 'supervisor') return canApproveSupervisor(request) || canVerifySupervisor(request);
    if (role === 'hr') return canHRCertify(request) || canHRReject(request);
    if (role === 'management') return canManagementApprove(request) || canManagementReject(request);
    return false;
  };

  // Helper to format approval history
  const renderApprovalHistory = (request: GroupedOTRequest) => {
    const steps: { stage: string; timestamp: string | null; remarks: string | null; approver: string | null }[] = [];
    const req = request as any;

    // Supervisor verification/confirmation
    if (req.supervisor_verified_at || req.supervisor_confirmation_at) {
      const timestamp = req.supervisor_verified_at || req.supervisor_confirmation_at;
      steps.push({
        stage: req.respective_supervisor_id ? 'Direct SV Verification' : 'SV Confirmation',
        timestamp,
        remarks: req.supervisor_remarks,
        approver: req.supervisor?.full_name || 'Unknown'
      });
    }

    // Respective supervisor confirmation/denial
    if (req.respective_supervisor_confirmed_at) {
      steps.push({
        stage: 'Resp. SV Confirmed',
        timestamp: req.respective_supervisor_confirmed_at,
        remarks: req.respective_supervisor_remarks,
        approver: req.respective_supervisor?.full_name || 'Unknown'
      });
    } else if (req.respective_supervisor_denied_at) {
      steps.push({
        stage: 'Resp. SV Denied',
        timestamp: req.respective_supervisor_denied_at,
        remarks: req.respective_supervisor_denial_remarks,
        approver: req.respective_supervisor?.full_name || 'Unknown'
      });
    }

    // HR certification
    if (req.hr_approved_at) {
      steps.push({
        stage: 'HR Certified',
        timestamp: req.hr_approved_at,
        remarks: req.hr_remarks,
        approver: 'HR'
      });
    }

    // Management approval
    if (req.management_reviewed_at) {
      steps.push({
        stage: 'Management Approved',
        timestamp: req.management_reviewed_at,
        remarks: req.management_remarks,
        approver: 'Management'
      });
    }

    if (steps.length === 0) {
      return <span className="text-muted-foreground text-sm">Pending approval</span>;
    }

    return (
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div key={idx} className="text-xs border-l-2 border-muted pl-2 py-1">
            <div className="font-medium">{step.stage}</div>
            {step.timestamp && (
              <div className="text-muted-foreground">
                {format(new Date(step.timestamp), 'dd MMM yyyy HH:mm')}
              </div>
            )}
            {step.approver && (
              <div className="text-muted-foreground">By: {step.approver}</div>
            )}
            {step.remarks && (
              <div className="text-muted-foreground italic line-clamp-2">
                "{step.remarks}"
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };




  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No OT requests found
      </div>
    );
  }


  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Submitted OT Sessions</TableHead>
              <TableHead>Total OT Hours</TableHead>
              <TableHead>Status</TableHead>
              {showApprovalHistory && <TableHead>Approval History</TableHead>}
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => {
              const profile = (request as any).profiles;
              const isPendingSupervisorVerification = request.status === 'pending_supervisor_verification';
              const isPendingRespectiveSupervisorConfirmation = request.status === 'pending_respective_supervisor_confirmation';
              return (
                <TableRow
                  key={request.id}
                  className={`transition-colors cursor-pointer ${
                    isPendingRespectiveSupervisorConfirmation
                      ? 'bg-indigo-50 dark:bg-indigo-950/10 border-l-4 border-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/20'
                      : isPendingSupervisorVerification
                      ? 'bg-teal-50 dark:bg-teal-950/10 border-l-4 border-teal-400 hover:bg-teal-100 dark:hover:bg-teal-950/20'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <TableCell>
                    <span className="font-mono text-sm font-medium text-primary">
                      {request.ticket_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div 
                      className="font-semibold cursor-pointer hover:underline"
                      onClick={() => setSelectedRequest(request)}
                    >
                      {profile?.full_name || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {profile?.employee_id || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(request.ot_date), 'dd MMM yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {request.sessions.map((session, idx) => (
                        <div key={idx} className="text-sm">
                          {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                          <span className="text-muted-foreground ml-2">
                            ({formatHours(session.total_hours)} hrs)
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">
                      {formatHours(request.total_hours)} hours
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={request.status}
                        rejectionStage={request.rejection_stage}
                        tooltip={getStatusTooltip(request)}
                      />
                      {request.threshold_violations && Object.keys(request.threshold_violations).length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Violation
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {showApprovalHistory && (
                    <TableCell>
                      {renderApprovalHistory(request)}
                    </TableCell>
                  )}
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {canReviewDeniedRequest(request) && reviseDeniedRequest && rejectRequest && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setSelectedRequest(request)}
                              disabled={isRevisingDeniedRequest}
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <CheckCheck className="h-4 w-4 mr-1" />
                              {isRevisingDeniedRequest ? 'Revising...' : 'Revise & Resubmit'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request, request.request_ids)}
                              disabled={isRejecting}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {canApproveOrReject(request) && approveRequest && rejectRequest && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(request, request.request_ids)}
                              disabled={isApproving || approvingRequestId === request.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                  {approvingRequestId === request.id
                    ? (role === 'hr' ? 'Certifying...' : role === 'supervisor' ? 'Verifying...' : 'Approving...')
                    : (role === 'hr' ? 'Certify' : role === 'supervisor' ? 'Verify' : 'Approve')
                  }
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request, request.request_ids)}
                              disabled={isRejecting}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <OTApprovalDetailsSheet
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        role={role}
        currentUserId={currentUserId}
        onApprove={approveRequest ? handleApprove : undefined}
        onReject={rejectRequest ? handleReject : undefined}
        onConfirm={confirmRequest ? handleConfirmSubmit : undefined}
        isApproving={isApproving || !!approvingRequestId}
        isRejecting={isRejecting}
        isConfirming={isConfirming}
        onConfirmRespectiveSupervisor={confirmRespectiveSupervisor}
        onDenyRespectiveSupervisor={denyRespectiveSupervisor}
        onReviseDeniedRequest={reviseDeniedRequest}
        isConfirmingRespectiveSupervisor={isConfirmingRespectiveSupervisor}
        isDenyingRespectiveSupervisor={isDenyingRespectiveSupervisor}
        isRevisingDeniedRequest={isRevisingDeniedRequest}
      />

      <RejectOTModal
        request={rejectingRequest?.request || null}
        selectedSessionIds={rejectingRequest?.sessionIds}
        open={!!rejectingRequest}
        onOpenChange={(open) => !open && setRejectingRequest(null)}
        onConfirm={handleRejectConfirm}
        isLoading={isRejecting}
      />


    </>
  );
}
