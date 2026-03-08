import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ClaimApprovalActions } from '@/components/claims/ClaimApprovalActions';
import type { Claim, NextApproverOption } from '@/types/claims';
import { getClaimStatusDisplay, getClaimApproverName, isClaimFullyApproved } from '@/types/claims';
import { formatCurrency } from '@/lib/otCalculations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type DetailsRole = 'employee' | 'supervisor' | 'hr' | 'finance' | 'director' | 'gm' | 'head_finance';

function statusVariant(status: string) {
  if (isClaimFullyApproved(status as any)) return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

function canApprove(role: DetailsRole, req: Claim) {
  if (role === 'supervisor') return req.status === 'pending_supervisor';
  if (role === 'hr') return req.status === 'pending_hr' || req.status === 'supervisor_approved';
  if (role === 'finance') return req.status === 'pending_finance';
  if (role === 'director') return req.status === 'pending_director';
  if (role === 'gm') return req.status === 'pending_gm';
  if (role === 'head_finance') return req.status === 'pending_head_finance';
  return false;
}

function canForward(role: DetailsRole, req: Claim) {
  // Finance can forward claims that are pending their review
  return role === 'finance' && req.status === 'pending_finance';
}

function canCancel(role: DetailsRole, req: Claim) {
  if (role !== 'employee') return false;
  return (
    req.status === 'pending_supervisor' ||
    req.status === 'supervisor_approved' ||
    req.status === 'pending_hr' ||
    req.status === 'pending_finance'
  );
}

function canPost(role: DetailsRole, req: Claim) {
  if (role !== 'finance') return false;
  return isClaimFullyApproved(req.status) && !req.is_posted;
}

export function ClaimDetailsSheet({
  request,
  open,
  onOpenChange,
  role,
  onApprove,
  onForward,
  onReject,
  onCancel,
  onPost,
  isApproving,
  isForwarding,
  isRejecting,
  isCancelling,
  isPosting,
}: {
  request: Claim | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: DetailsRole;
  onApprove?: (requestIds: string[], remarks?: string) => Promise<void> | void;
  onForward?: (requestIds: string[], nextApprover: NextApproverOption, remarks?: string, approverUserId?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  onPost?: (claimId: string, reference?: string, remarks?: string) => Promise<void> | void;
  isApproving?: boolean;
  isForwarding?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
  isPosting?: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [postReference, setPostReference] = useState('');
  const [postRemarks, setPostRemarks] = useState('');
  const [forwardOpen, setForwardOpen] = useState(false);
  const [nextApprover, setNextApprover] = useState<NextApproverOption>('final_approve');
  const [forwardRemarks, setForwardRemarks] = useState('');
  const [approverUserId, setApproverUserId] = useState<string>('');
  const [approverCandidates, setApproverCandidates] = useState<{ id: string; full_name: string; employee_id: string }[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Fetch approver candidates when role changes
  useEffect(() => {
    if (nextApprover === 'final_approve') {
      setApproverCandidates([]);
      setApproverUserId('');
      return;
    }
    let cancelled = false;
    const fetchCandidates = async () => {
      setLoadingCandidates(true);
      const db = supabase as any;

      // Map nextApprover option to the actual app_role
      const roleMap: Record<string, string> = {
        director: 'director',
        gm: 'gm',
        head_finance: 'head_finance',
      };
      const targetRole = roleMap[nextApprover] || 'management';

      // Step 1: get user IDs with the specific role
      const { data: roles, error: rolesErr } = await db
        .from('user_roles')
        .select('user_id')
        .eq('role', targetRole);
      if (cancelled || rolesErr || !roles || roles.length === 0) {
        if (!cancelled) {
          setApproverCandidates([]);
          setLoadingCandidates(false);
        }
        return;
      }
      const userIds = roles.map((r: any) => r.user_id);
      // Step 2: fetch profiles
      const { data: profiles, error: profErr } = await db
        .from('profiles')
        .select('id, full_name, employee_id')
        .in('id', userIds);
      if (!cancelled && !profErr && profiles) {
        setApproverCandidates(profiles);
        if (profiles.length === 1) {
          setApproverUserId(profiles[0].id);
        } else {
          setApproverUserId('');
        }
      }
      if (!cancelled) setLoadingCandidates(false);
    };
    fetchCandidates();
    return () => { cancelled = true; };
  }, [nextApprover]);

  const approveLabel = useMemo(() => {
    if (!request) return 'Approve';
    if (role === 'supervisor') return 'Approve (To HR)';
    if (role === 'hr') return 'Send to Finance';
    if (role === 'finance') return 'Final Approve';
    if (role === 'director') return 'Director Approve';
    if (role === 'gm') return 'GM Approve';
    if (role === 'head_finance') return 'Head Finance Approve';
    return 'Approve';
  }, [request, role]);

  if (!request) return null;

  const typeName = request.claim_type?.name || request.claim_type_id;
  const employeeName = request.profiles?.full_name || request.employee_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Claim Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Ticket</div>
              <div className="font-semibold">{request.ticket_number}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(request.status) as any}>{getClaimStatusDisplay(request.status, getClaimApproverName(request))}</Badge>
              {request.is_posted && <Badge variant="secondary">posted</Badge>}
            </div>
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
              <div className="text-muted-foreground">Claim Type</div>
              <div className="font-semibold">{typeName}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Amount</div>
              <div className="font-semibold">{formatCurrency(Number(request.amount || 0))}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Receipt Date</div>
              <div className="font-semibold">{format(new Date(request.claim_date), 'dd MMM yyyy')}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Final Approver</div>
              <div className="font-semibold">{request.claim_type?.final_approver || '—'}</div>
            </div>
          </div>

          {request.limit_warning && (
            <div className="text-sm rounded-md border border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20 p-3">
              <div className="font-medium">Limit Warning</div>
              <div className="text-muted-foreground mt-1">{request.limit_warning}</div>
            </div>
          )}

          {request.purpose && (
            <div className="text-sm rounded-md border p-3">
              <div className="text-muted-foreground">Purpose</div>
              <div className="whitespace-pre-wrap">{request.purpose}</div>
            </div>
          )}

          {request.receipt_urls && request.receipt_urls.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Receipts</div>
              <div className="flex flex-wrap gap-2">
                {request.receipt_urls.map((url, i) => (
                  <Button key={i} variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Receipt {i + 1}
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
                <span>
                  {request.supervisor_approved_at
                    ? format(new Date(request.supervisor_approved_at), 'dd MMM yyyy HH:mm')
                    : '—'}
                </span>
              </div>
              {request.supervisor_remarks && (
                <div className="text-muted-foreground italic">"{request.supervisor_remarks}"</div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">HR</span>
                <span>
                  {request.hr_approved_at ? format(new Date(request.hr_approved_at), 'dd MMM yyyy HH:mm') : '—'}
                </span>
              </div>
              {request.hr_remarks && <div className="text-muted-foreground italic">"{request.hr_remarks}"</div>}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Finance</span>
                <span>
                  {request.finance_approved_at
                    ? format(new Date(request.finance_approved_at), 'dd MMM yyyy HH:mm')
                    : '—'}
                </span>
              </div>
              {request.finance_remarks && (
                <div className="text-muted-foreground italic">"{request.finance_remarks}"</div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span>
                  {request.posted_at ? format(new Date(request.posted_at), 'dd MMM yyyy HH:mm') : '—'}
                </span>
              </div>
              {request.posting_reference && (
                <div className="text-muted-foreground">Reference: {request.posting_reference}</div>
              )}

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
                  {request.cancellation_reason && (
                    <div className="text-sm text-muted-foreground mt-2">{request.cancellation_reason}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Finance Forward Action */}
          {canForward(role, request) && onForward && (
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setForwardOpen(true)} disabled={!!isForwarding}>
                Forward to Next Approver
              </Button>

              <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Forward Claim</DialogTitle>
                    <DialogDescription>
                      Select the next approver for this claim after finance review.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Next Approver</Label>
                      <Select value={nextApprover} onValueChange={(v) => setNextApprover(v as NextApproverOption)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select next approver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="final_approve">Finance Final Approval</SelectItem>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="gm">General Manager (GM)</SelectItem>
                          <SelectItem value="head_finance">Head of Finance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {nextApprover !== 'final_approve' && (
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        {loadingCandidates ? (
                          <div className="text-sm text-muted-foreground py-2">Loading...</div>
                        ) : approverCandidates.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">
                            No users with {nextApprover === 'director' ? 'Director' : nextApprover === 'gm' ? 'GM' : 'Head of Finance'} role found
                          </div>
                        ) : (
                          <Select value={approverUserId} onValueChange={setApproverUserId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select person..." />
                            </SelectTrigger>
                            <SelectContent>
                              {approverCandidates.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.full_name} ({c.employee_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        value={forwardRemarks}
                        onChange={(e) => setForwardRemarks(e.target.value)}
                        placeholder="Add remarks for the next approver..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setForwardOpen(false)} disabled={!!isForwarding}>
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        await onForward(
                          [request.id],
                          nextApprover,
                          forwardRemarks.trim() || undefined,
                          approverUserId || undefined,
                        );
                        setForwardRemarks('');
                        setApproverUserId('');
                        setForwardOpen(false);
                        onOpenChange(false);
                      }}
                      disabled={!!isForwarding || (nextApprover !== 'final_approve' && !approverUserId)}
                    >
                      {isForwarding ? 'Forwarding...' : 'Forward Claim'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {canApprove(role, request) && onApprove && onReject && (
            <div className="pt-2">
              <ClaimApprovalActions
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

          {canPost(role, request) && onPost && (
            <div className="pt-2">
              <Button onClick={() => setPostOpen(true)} disabled={!!isPosting}>
                Mark as Posted
              </Button>

              <Dialog open={postOpen} onOpenChange={setPostOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark Claim as Posted</DialogTitle>
                    <DialogDescription>
                      Save an optional reference/remarks for this posting action.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Posting Reference (Optional)</Label>
                      <Input
                        value={postReference}
                        onChange={(e) => setPostReference(e.target.value)}
                        placeholder="e.g. JV-2026-0012"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        value={postRemarks}
                        onChange={(e) => setPostRemarks(e.target.value)}
                        placeholder="Notes for posting"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPostOpen(false)} disabled={!!isPosting}>
                      Back
                    </Button>
                    <Button
                      onClick={async () => {
                        await onPost(request.id, postReference.trim() || undefined, postRemarks.trim() || undefined);
                        setPostReference('');
                        setPostRemarks('');
                        setPostOpen(false);
                        onOpenChange(false);
                      }}
                      disabled={!!isPosting}
                    >
                      {isPosting ? 'Posting...' : 'Mark Posted'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {canCancel(role, request) && onCancel && (
            <div className="pt-2">
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!isCancelling}>
                Cancel Claim
              </Button>

              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Claim</DialogTitle>
                    <DialogDescription>
                      This will cancel the claim if it has not been fully approved.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>Reason (Optional)</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Why are you cancelling?"
                    />
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
                      {isCancelling ? 'Cancelling...' : 'Cancel Claim'}
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
