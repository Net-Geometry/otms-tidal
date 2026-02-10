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

export function ClaimApprovalActions({
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: {
  onApprove: (remarks?: string) => Promise<void> | void;
  onReject: (remarks: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');

  const handleApprove = async () => {
    await onApprove(approveRemarks.trim() || undefined);
    setApproveRemarks('');
    setApproveOpen(false);
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) return;
    await onReject(rejectRemarks.trim());
    setRejectRemarks('');
    setRejectOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => setApproveOpen(true)} disabled={!!isApproving || !!isRejecting}>
        {approveLabel}
      </Button>
      <Button
        variant="destructive"
        onClick={() => setRejectOpen(true)}
        disabled={!!isApproving || !!isRejecting}
      >
        {rejectLabel}
      </Button>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approveLabel} Claim</DialogTitle>
            <DialogDescription>Optional remarks will be saved in the approval record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Remarks (Optional)</Label>
            <Textarea
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="Add remarks..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={!!isApproving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={!!isApproving}>
              {isApproving ? 'Approving...' : approveLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectLabel} Claim</DialogTitle>
            <DialogDescription>Remarks are required for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Remarks *</Label>
            <Textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Reason for rejection..."
            />
            {!rejectRemarks.trim() && <div className="text-xs text-destructive">Remarks are required.</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={!!isRejecting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!isRejecting || !rejectRemarks.trim()}
            >
              {isRejecting ? 'Rejecting...' : rejectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
