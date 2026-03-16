import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ClaimApprovalActions } from '@/components/claims/ClaimApprovalActions';
import type { Claim } from '@/types/claims';
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
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

type DetailsRole = 'employee' | 'supervisor' | 'hr' | 'finance' | 'director' | 'gm' | 'head_finance';

function statusVariant(status: string) {
  if (isClaimFullyApproved(status as any)) return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

function canApprove(role: DetailsRole, req: Claim) {
  if (role === 'supervisor') return req.status === 'pending_supervisor';
  if (role === 'finance') return req.status === 'pending_finance';
  if (role === 'hr') return req.status === 'pending_hr';
  if (role === 'director') return req.status === 'pending_director';
  if (role === 'gm') return req.status === 'pending_gm';
  if (role === 'head_finance') return req.status === 'pending_head_finance';
  return false;
}

function canCancel(role: DetailsRole, req: Claim) {
  if (role !== 'employee') return false;
  return (
    req.status === 'pending_supervisor' ||
    req.status === 'pending_finance' ||
    req.status === 'pending_hr'
  );
}

function canPost(role: DetailsRole, req: Claim) {
  if (role !== 'finance') return false;
  return isClaimFullyApproved(req.status) && !req.is_posted;
}

export function ClaimDetailsSheet({
  claims,
  open,
  onOpenChange,
  role,
  onApprove,
  onReject,
  onCancel,
  onPost,
  isApproving,
  isRejecting,
  isCancelling,
  isPosting,
}: {
  claims: Claim[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: DetailsRole;
  onApprove?: (requestIds: string[], remarks?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  onPost?: (claimId: string, reference?: string, remarks?: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
  isPosting?: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [postReference, setPostReference] = useState('');
  const [postRemarks, setPostRemarks] = useState('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const openPreview = (urls: string[], startIndex: number) => {
    setPreviewUrls(urls);
    setPreviewIndex(startIndex);
  };

  const isImageUrl = (url: string) => {
    const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  // Use the first claim as representative for shared info
  const request = claims[0] ?? null;
  const isBatch = claims.length > 1;
  const totalAmount = claims.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const approveLabel = useMemo(() => {
    if (!request) return 'Approve';
    if (role === 'supervisor') return 'Approve (To Finance)';
    if (role === 'finance') return 'Approve (To HR)';
    if (role === 'hr') return 'Approve';
    if (role === 'director') return 'Director Approve';
    if (role === 'gm') return 'GM Approve';
    if (role === 'head_finance') return 'Head Finance Approve';
    return 'Approve';
  }, [request, role]);

  if (!request) return null;

  const employeeName = request.profiles?.full_name || request.employee_id;

  // For batch actions: check if any claim in batch supports the action
  const showApprove = claims.some((c) => canApprove(role, c));
  const showCancel = claims.some((c) => canCancel(role, c));
  const approvableIds = claims.filter((c) => canApprove(role, c)).map((c) => c.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Claim Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Header: Ticket & Status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Ticket</div>
              <div className="font-semibold">{request.ticket_number}</div>
              {isBatch && (
                <div className="text-sm text-muted-foreground mt-0.5">{claims.length} items</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(request.status) as any}>{getClaimStatusDisplay(request.status, getClaimApproverName(request))}</Badge>
              {request.is_posted && <Badge variant="secondary">posted</Badge>}
            </div>
          </div>

          <Separator />

          {/* Employee Info */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Employee</div>
            <div className="font-medium">{employeeName}</div>
            {request.profiles?.departments?.name && (
              <div className="text-sm text-muted-foreground">{request.profiles.departments.name}</div>
            )}
          </div>

          {/* Claim Items */}
          {isBatch ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">Items</div>
              {claims.map((c, idx) => (
                <div key={c.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{idx + 1}. {c.claim_type?.name || c.claim_type_id}</div>
                    <div className="font-semibold text-sm">{formatCurrency(Number(c.amount || 0))}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Receipt: {format(new Date(c.claim_date), 'dd MMM yyyy')}</div>
                    {c.claim_type?.final_approver && <div>Approver: {c.claim_type.final_approver}</div>}
                  </div>
                  {c.purpose && <div className="text-sm text-muted-foreground">{c.purpose}</div>}
                  {c.limit_warning && (
                    <div className="text-xs rounded border border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20 p-2">
                      {c.limit_warning}
                    </div>
                  )}
                  {c.receipt_urls && c.receipt_urls.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.receipt_urls.map((url, i) => (
                        <Button key={i} variant="outline" size="sm" className="h-7 text-xs" onClick={() => openPreview(c.receipt_urls!, i)}>
                          Receipt {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center pt-1 font-semibold text-sm">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">Claim Type</div>
                  <div className="font-semibold">{request.claim_type?.name || request.claim_type_id}</div>
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
                      <Button key={i} variant="outline" size="sm" onClick={() => openPreview(request.receipt_urls!, i)}>
                        Receipt {i + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Separator />

          {/* Approval Timeline */}
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
                <span className="text-muted-foreground">HR</span>
                <span>
                  {request.hr_approved_at ? format(new Date(request.hr_approved_at), 'dd MMM yyyy HH:mm') : '—'}
                </span>
              </div>
              {request.hr_remarks && <div className="text-muted-foreground italic">"{request.hr_remarks}"</div>}

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

          {showApprove && onApprove && onReject && (
            <div className="pt-2">
              <ClaimApprovalActions
                approveLabel={approveLabel}
                onApprove={async (remarks) => {
                  await onApprove(approvableIds, remarks);
                  onOpenChange(false);
                }}
                onReject={async (remarks) => {
                  await onReject(approvableIds, remarks);
                  onOpenChange(false);
                }}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
            </div>
          )}

          {claims.some((c) => canPost(role, c)) && onPost && (
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

          {showCancel && onCancel && (
            <div className="pt-2">
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!isCancelling}>
                Cancel Claim
              </Button>

              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Claim</DialogTitle>
                    <DialogDescription>
                      This will cancel {isBatch ? `all ${claims.length} items in` : ''} the claim if it has not been fully approved.
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
                        // Cancel all cancellable claims in the batch
                        for (const c of claims) {
                          if (canCancel(role, c)) {
                            await onCancel(c.id, cancelReason.trim() || undefined);
                          }
                        }
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

        {/* Attachment Preview Modal */}
        <Dialog open={previewUrls.length > 0} onOpenChange={() => setPreviewUrls([])}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                {previewUrls.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex((i) => i - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={previewIndex === previewUrls.length - 1}
                      onClick={() => setPreviewIndex((i) => i + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <DialogTitle className="text-sm font-medium">
                  Attachment {previewIndex + 1} of {previewUrls.length}
                </DialogTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                  <a href={previewUrls[previewIndex]} target="_blank" rel="noopener noreferrer" title="Download">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <DialogDescription className="sr-only">Preview of claim receipt attachment</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center min-h-[400px] max-h-[75vh] overflow-auto bg-muted/30 p-4">
              {previewUrls[previewIndex] && isImageUrl(previewUrls[previewIndex]) ? (
                <img
                  src={previewUrls[previewIndex]}
                  alt={`Receipt ${previewIndex + 1}`}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              ) : (
                <iframe
                  src={previewUrls[previewIndex]}
                  title={`Receipt ${previewIndex + 1}`}
                  className="w-full h-[70vh] rounded border-0"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
