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
import { CheckCircle, XCircle, Send } from 'lucide-react';
import type { PayrollRun, PayrollApprovalRole } from '@/types/payroll';

interface PayrollApprovalActionsProps {
  run: PayrollRun;
  role: PayrollApprovalRole;
  onApprove: (input: { runId: string; remarks?: string }) => Promise<void>;
  onReject: (input: { runId: string; remarks: string }) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
}

function getAvailableActions(status: string, role: PayrollApprovalRole): string[] {
  if (role === 'hr') {
    if (status === 'draft') return ['submit'];
    if (status === 'pending_hr_review') return ['approve', 'reject'];
    if (status === 'hr_approved') return ['send_to_director'];
  }
  if (role === 'management') {
    if (status === 'pending_director') return ['approve', 'reject'];
    if (status === 'director_approved') return ['send_to_finance'];
  }
  if (role === 'finance') {
    if (status === 'pending_finance') return ['approve', 'reject'];
  }
  return [];
}

function getApproveLabel(action: string): string {
  if (action === 'submit') return 'Submit for Review';
  if (action === 'send_to_director') return 'Send to Director';
  if (action === 'send_to_finance') return 'Send to Finance';
  return 'Approve';
}

export function PayrollApprovalActions({
  run,
  role,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: PayrollApprovalActionsProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);

  const actions = getAvailableActions(run.status, role);
  if (actions.length === 0) return null;

  const primaryAction = actions.find((a) => a !== 'reject') || actions[0];
  const canReject = actions.includes('reject');

  const handleApprove = async () => {
    await onApprove({ runId: run.id, remarks: approveRemarks || undefined });
    setApproveOpen(false);
    setApproveRemarks('');
  };

  const handleReject = async () => {
    if (!remarks.trim()) return;
    await onReject({ runId: run.id, remarks });
    setRejectOpen(false);
    setRemarks('');
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => {
          if (primaryAction === 'approve') {
            setApproveOpen(true);
          } else {
            onApprove({ runId: run.id });
          }
        }}
        disabled={isApproving}
      >
        {primaryAction === 'submit' || primaryAction === 'send_to_director' || primaryAction === 'send_to_finance' ? (
          <Send className="h-4 w-4 mr-2" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-2" />
        )}
        {isApproving ? 'Processing...' : getApproveLabel(primaryAction)}
      </Button>

      {canReject && (
        <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={isRejecting}>
          <XCircle className="h-4 w-4 mr-2" />
          {isRejecting ? 'Rejecting...' : 'Reject'}
        </Button>
      )}

      {/* Approve dialog (with optional remarks) */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll Run</DialogTitle>
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
            <DialogTitle>Reject Payroll Run</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Remarks (required)</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting || !remarks.trim()}>
              {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
