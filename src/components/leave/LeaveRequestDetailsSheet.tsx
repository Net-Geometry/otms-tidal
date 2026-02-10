import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { LeaveRequest } from '@/types/leave';
import { LeaveApprovalActions } from '@/components/leave/LeaveApprovalActions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type DetailsRole = 'employee' | 'supervisor' | 'hr' | 'management';

function statusVariant(status: string) {
  if (status === 'management_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

function canApprove(role: DetailsRole, req: LeaveRequest) {
  if (role === 'supervisor') return req.status === 'pending_supervisor';
  if (role === 'hr') return req.status === 'pending_hr' || req.status === 'supervisor_approved';
  if (role === 'management') return req.status === 'hr_approved' || req.status === 'pending_management';
  return false;
}

function canCancel(role: DetailsRole, req: LeaveRequest) {
  if (role !== 'employee') return false;
  return (
    req.status === 'pending_supervisor' ||
    req.status === 'pending_hr' ||
    req.status === 'supervisor_approved' ||
    req.status === 'hr_approved' ||
    req.status === 'pending_management'
  );
}

export function LeaveRequestDetailsSheet({
  request,
  open,
  onOpenChange,
  role,
  onApprove,
  onReject,
  onCancel,
  isApproving,
  isRejecting,
  isCancelling,
}: {
  request: LeaveRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: DetailsRole;
  onApprove?: (requestIds: string[], remarks?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!request) return null;

  const typeName = request.leave_type?.name || request.leave_type_id;
  const employeeName = request.profiles?.full_name || request.employee_id;

  const approveLabel = role === 'supervisor' ? 'Approve (To HR)' : role === 'hr' ? 'Approve (To Management)' : 'Final Approve';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Leave Request Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Ticket</div>
              <div className="font-semibold">{request.ticket_number}</div>
            </div>
            <Badge variant={statusVariant(request.status) as any}>{request.status.replace(/_/g, ' ')}</Badge>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Employee</div>
            <div className="font-medium">{employeeName}</div>
            {request.profiles?.departments?.name && (
              <div className="text-sm text-muted-foreground">{request.profiles.departments.name}</div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Leave Type</div>
              <div className="font-semibold">{typeName}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Total Days</div>
              <div className="font-semibold">{Number(request.total_days || 0).toFixed(1)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Start</div>
              <div className="font-semibold">{format(new Date(request.start_date), 'dd MMM yyyy')}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">End</div>
              <div className="font-semibold">{format(new Date(request.end_date), 'dd MMM yyyy')}</div>
            </div>
          </div>

          {request.is_half_day && (
            <div className="text-sm rounded-md border p-3">
              <div className="text-muted-foreground">Half Day</div>
              <div className="font-medium">{request.half_day_period || '—'}</div>
            </div>
          )}

          {request.reason && (
            <div className="text-sm rounded-md border p-3">
              <div className="text-muted-foreground">Reason</div>
              <div className="whitespace-pre-wrap">{request.reason}</div>
            </div>
          )}

          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Attachments</div>
              <div className="flex flex-wrap gap-2">
                {request.attachment_urls.map((url, i) => (
                  <Button key={i} variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Attachment {i + 1}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-medium">Approval Timeline</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span>{format(new Date(request.created_at), 'dd MMM yyyy HH:mm')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Supervisor</span>
                <span>{request.supervisor_approved_at ? format(new Date(request.supervisor_approved_at), 'dd MMM yyyy HH:mm') : '—'}</span>
              </div>
              {request.supervisor_remarks && <div className="text-muted-foreground italic">"{request.supervisor_remarks}"</div>}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">HR</span>
                <span>{request.hr_approved_at ? format(new Date(request.hr_approved_at), 'dd MMM yyyy HH:mm') : '—'}</span>
              </div>
              {request.hr_remarks && <div className="text-muted-foreground italic">"{request.hr_remarks}"</div>}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Management</span>
                <span>{request.management_approved_at ? format(new Date(request.management_approved_at), 'dd MMM yyyy HH:mm') : '—'}</span>
              </div>
              {request.management_remarks && <div className="text-muted-foreground italic">"{request.management_remarks}"</div>}

              {request.rejected_at && (
                <div className="rounded-md border border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Rejected</span>
                    <span className="text-sm">{format(new Date(request.rejected_at), 'dd MMM yyyy HH:mm')}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Stage: {request.rejection_stage || '—'}</div>
                  {request.rejection_remarks && <div className="text-sm mt-2">{request.rejection_remarks}</div>}
                </div>
              )}

              {request.cancelled_at && (
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Cancelled</span>
                    <span className="text-sm">{format(new Date(request.cancelled_at), 'dd MMM yyyy HH:mm')}</span>
                  </div>
                  {request.cancellation_reason && <div className="text-sm text-muted-foreground mt-2">{request.cancellation_reason}</div>}
                </div>
              )}
            </div>
          </div>

          {canApprove(role, request) && onApprove && onReject && (
            <div className="pt-2">
              <LeaveApprovalActions
                approveLabel={approveLabel}
                onApprove={async (remarks) => {
                  await onApprove([request.id], remarks);
                  onOpenChange(false);
                }}
                onReject={async (remarks) => {
                  await onReject([request.id], remarks);
                  onOpenChange(false);
                }}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
            </div>
          )}

          {canCancel(role, request) && onCancel && (
            <div className="pt-2">
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!isCancelling}>
                Cancel Request
              </Button>

              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Leave Request</DialogTitle>
                    <DialogDescription>
                      This will cancel the request if it has not been fully approved.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>Reason (Optional)</Label>
                    <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why are you cancelling?" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={!!isCancelling}>
                      Back
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await onCancel(request.id, cancelReason.trim() || undefined);
                        setCancelReason('');
                        setCancelOpen(false);
                        onOpenChange(false);
                      }}
                      disabled={!!isCancelling}
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
