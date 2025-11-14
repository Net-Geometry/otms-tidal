import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle, XCircle, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { GroupedOTRequest } from '@/types/otms';
import { formatTime12Hour, formatHours } from '@/lib/otCalculations';
import { OTApprovalDetailsSheet } from './OTApprovalDetailsSheet';
import { RejectOTModal } from './RejectOTModal';
import { SupervisorConfirmationSheet } from '@/components/supervisor/SupervisorConfirmationSheet';
import { Badge } from '@/components/ui/badge';

type ApprovalRole = 'supervisor' | 'hr' | 'management';

interface OTApprovalTableProps {
  requests: GroupedOTRequest[];
  isLoading: boolean;
  role: ApprovalRole;
  approveRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  rejectRequest?: (requestIds: string[], remarks: string) => Promise<void>;
  confirmRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  isApproving?: boolean;
  isRejecting?: boolean;
  isConfirming?: boolean;
  showActions?: boolean;
  initialSelectedRequestId?: string | null;
}

export function OTApprovalTable({ 
  requests, 
  isLoading, 
  role,
  approveRequest,
  rejectRequest,
  confirmRequest,
  isApproving,
  isRejecting,
  isConfirming,
  showActions = true,
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
    setConfirmingRequest(request);
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

  const canApproveOrReject = (request: GroupedOTRequest) => {
    if (role === 'supervisor') return request.status === 'pending_verification';
    if (role === 'hr') return request.status === 'supervisor_verified' || request.status === 'supervisor_confirmed';
    if (role === 'management') return request.status === 'hr_certified';
    return false;
  };

  const canConfirm = (request: GroupedOTRequest) => {
    return role === 'supervisor' && request.status === 'pending_supervisor_confirmation';
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
              <TableHead>Employee Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Submitted OT Sessions</TableHead>
              <TableHead>Total OT Hours</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => {
              const profile = (request as any).profiles;
              const isPendingConfirmation = request.status === 'pending_supervisor_confirmation';
              return (
                <TableRow 
                  key={request.id} 
                  className={`transition-colors cursor-pointer ${
                    isPendingConfirmation 
                      ? 'bg-amber-50 dark:bg-amber-950/10 border-l-4 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/20' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
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
                      <StatusBadge status={request.status} />
                      {request.threshold_violations && Object.keys(request.threshold_violations).length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Violation
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {canConfirm(request) && confirmRequest && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleConfirm(request)}
                            disabled={isConfirming}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <CheckCheck className="h-4 w-4 mr-1" />
                            {isConfirming ? 'Confirming...' : 'Confirm'}
                          </Button>
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
        onApprove={approveRequest ? handleApprove : undefined}
        onReject={rejectRequest ? handleReject : undefined}
        isApproving={isApproving || !!approvingRequestId}
        isRejecting={isRejecting}
      />

      <RejectOTModal
        request={rejectingRequest?.request || null}
        selectedSessionIds={rejectingRequest?.sessionIds}
        open={!!rejectingRequest}
        onOpenChange={(open) => !open && setRejectingRequest(null)}
        onConfirm={handleRejectConfirm}
        isLoading={isRejecting}
      />

      <SupervisorConfirmationSheet
        request={confirmingRequest}
        open={!!confirmingRequest}
        onOpenChange={(open) => !open && setConfirmingRequest(null)}
        onConfirm={handleConfirmSubmit}
        isConfirming={isConfirming || false}
      />
    </>
  );
}
