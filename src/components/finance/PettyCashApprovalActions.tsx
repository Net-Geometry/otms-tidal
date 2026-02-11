import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PettyCashApprovalActionsProps {
  onApprove: (remarks?: string) => Promise<void>;
  onReject: (remarks?: string) => Promise<void>;
  isLoading?: boolean;
}

export function PettyCashApprovalActions({ onApprove, onReject, isLoading }: PettyCashApprovalActionsProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');

  const submit = async () => {
    if (mode === 'approve') await onApprove(remarks || undefined);
    else await onReject(remarks || undefined);
    setRemarks('');
    setOpen(false);
  };

  return (
    <>
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => {
            setMode('approve');
            setOpen(true);
          }}
          disabled={isLoading}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setMode('reject');
            setOpen(true);
          }}
          disabled={isLoading}
        >
          Reject
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}</DialogTitle>
            <DialogDescription>
              {mode === 'approve'
                ? 'Add optional approval remarks before confirming.'
                : 'Add rejection remarks for audit tracking.'}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder={mode === 'approve' ? 'Optional remarks...' : 'Reason for rejection...'}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={mode === 'approve' ? 'default' : 'destructive'}
              onClick={submit}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : mode === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
