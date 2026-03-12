import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { CheckCircle, XCircle, Send, RotateCcw, FileCheck, Trash2 } from 'lucide-react';
import type { PayrollMemo, PayrollApprovalRole } from '@/types/payroll';

interface MemoApprovalActionsProps {
  memo: PayrollMemo;
  role: PayrollApprovalRole;
  onApprove: (input: { memoId: string; role: PayrollApprovalRole; remarks?: string }) => Promise<void>;
  onReject: (input: { memoId: string; role: PayrollApprovalRole; remarks: string }) => Promise<void>;
  onResubmit: (memoId: string) => Promise<void>;
  onPost: (memoId: string) => Promise<void>;
  onDelete: (memoId: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
  isResubmitting: boolean;
  isPosting: boolean;
  isDeleting: boolean;
}

type MemoAction = 'submit' | 'approve' | 'reject' | 'resubmit' | 'post' | 'delete';

function getAvailableActions(status: string, role: PayrollApprovalRole): MemoAction[] {
  if (role === 'hr') {
    if (status === 'draft') return ['submit', 'delete'];
    if (status === 'rejected') return ['resubmit', 'delete'];
  }
  if (role === 'management' || role === 'dmd') {
    if (status === 'pending_director') return ['approve', 'reject'];
  }
  if (role === 'finance') {
    if (status === 'pending_finance') return ['approve', 'reject'];
    if (status === 'finance_approved') return ['post'];
  }
  return [];
}

export function MemoApprovalActions({
  memo,
  role,
  onApprove,
  onReject,
  onResubmit,
  onPost,
  onDelete,
  isApproving,
  isRejecting,
  isResubmitting,
  isPosting,
  isDeleting,
}: MemoApprovalActionsProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const actions = getAvailableActions(memo.status, role);
  if (actions.length === 0) return null;

  const isBusy = isApproving || isRejecting || isResubmitting || isPosting || isDeleting;

  const handleApprove = async () => {
    await onApprove({ memoId: memo.id, role, remarks: approveRemarks || undefined });
    setApproveOpen(false);
    setApproveRemarks('');
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) return;
    await onReject({ memoId: memo.id, role, remarks: rejectRemarks });
    setRejectOpen(false);
    setRejectRemarks('');
  };

  const handleDelete = async () => {
    await onDelete(memo.id);
    setDeleteOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Submit to Director (hr + draft) */}
      {actions.includes('submit') && (
        <Button
          onClick={() => onApprove({ memoId: memo.id, role })}
          disabled={isBusy}
        >
          <Send className="h-4 w-4 mr-2" />
          {isApproving ? 'Processing...' : 'Submit to Director'}
        </Button>
      )}

      {/* Resubmit to Director (hr + rejected) */}
      {actions.includes('resubmit') && (
        <Button
          onClick={() => onResubmit(memo.id)}
          disabled={isBusy}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {isResubmitting ? 'Processing...' : 'Resubmit to Director'}
        </Button>
      )}

      {/* Approve (management/finance) */}
      {actions.includes('approve') && (
        <Button
          onClick={() => setApproveOpen(true)}
          disabled={isBusy}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isApproving ? 'Processing...' : 'Approve'}
        </Button>
      )}

      {/* Reject (management/finance) */}
      {actions.includes('reject') && (
        <Button
          variant="destructive"
          onClick={() => setRejectOpen(true)}
          disabled={isBusy}
        >
          <XCircle className="h-4 w-4 mr-2" />
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </Button>
      )}

      {/* Post Payroll (finance + finance_approved) */}
      {actions.includes('post') && (
        <Button
          onClick={() => onPost(memo.id)}
          disabled={isBusy}
        >
          <FileCheck className="h-4 w-4 mr-2" />
          {isPosting ? 'Posting...' : 'Post Payroll'}
        </Button>
      )}

      {/* Delete Memo (hr + draft/rejected) */}
      {actions.includes('delete') && (
        <Button
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={isBusy}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? 'Deleting...' : 'Delete Memo'}
        </Button>
      )}

      {/* Approve dialog (with optional remarks) */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll Memo</DialogTitle>
            <DialogDescription>
              Optionally add remarks for this approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Remarks (optional)</Label>
            <Textarea
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="Add any notes..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              {isApproving ? 'Approving...' : 'Confirm Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog (remarks required) */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payroll Memo</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Remarks (required)</Label>
            <Textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting || !rejectRemarks.trim()}>
              {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payroll Memo</DialogTitle>
            <DialogDescription>
              This will unlink all payroll runs from this memo. The runs themselves are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
