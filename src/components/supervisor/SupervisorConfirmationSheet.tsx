import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { GroupedOTRequest } from '@/types/otms';
import { StatusBadge } from '@/components/StatusBadge';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

interface SupervisorConfirmationSheetProps {
  request: GroupedOTRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requestIds: string[], remarks?: string) => Promise<void>;
  isConfirming: boolean;
}

const MAX_REMARKS_LENGTH = 500;

export function SupervisorConfirmationSheet({
  request,
  open,
  onOpenChange,
  onConfirm,
  isConfirming,
}: SupervisorConfirmationSheetProps) {
  const [remarks, setRemarks] = useState('');

  if (!request) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm(request.request_ids, remarks.trim() || undefined);
      setRemarks(''); // Reset remarks on success
      onOpenChange(false); // Close dialog
    } catch (error) {
      // Error is handled by the mutation (toast shown in useOTApproval)
      console.error('Confirmation failed:', error);
    }
  };

  const handleCancel = () => {
    setRemarks(''); // Reset remarks
    onOpenChange(false);
  };

  const remainingChars = MAX_REMARKS_LENGTH - remarks.length;
  const isRemarksValid = remarks.length <= MAX_REMARKS_LENGTH;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Confirm OT Request</SheetTitle>
          <SheetDescription>
            Review the details below and provide optional confirmation remarks.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Employee Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Employee Name</Label>
                <p className="font-medium">
                  {request.profiles?.full_name || 'Unknown Employee'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Employee ID</Label>
                <p className="font-mono text-sm">
                  {request.profiles?.employee_id || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* OT Request Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">OT Request Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">OT Date</Label>
                <p>{format(new Date(request.ot_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <StatusBadge status={request.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Day Type</Label>
                <p className="capitalize">{request.day_type.replace('_', ' ')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Hours</Label>
                <p className="font-semibold text-lg">{request.total_hours.toFixed(1)} hrs</p>
              </div>
            </div>

            {/* Sessions Details */}
            {request.sessions && request.sessions.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Time Sessions</Label>
                <div className="mt-2 space-y-2">
                  {request.sessions.map((session, index) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 text-sm border rounded-md p-2"
                    >
                      <span className="font-medium">Session {index + 1}:</span>
                      <span>{session.start_time} - {session.end_time}</span>
                      <span className="text-muted-foreground">
                        ({session.total_hours.toFixed(1)} hrs)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Reason */}
          <div>
            <Label className="text-muted-foreground">Reason for OT</Label>
            <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
          </div>

          {/* Previous Verification Remarks */}
          {request.supervisor_remarks && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Previous Verification Remarks</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm bg-muted p-3 rounded-md">
                  {request.supervisor_remarks}
                </p>
                {request.supervisor_verified_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified at: {format(new Date(request.supervisor_verified_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Confirmation Remarks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirmation-remarks">
                Confirmation Remarks <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <span
                className={`text-xs ${
                  !isRemarksValid ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {remainingChars} characters remaining
              </span>
            </div>
            <Textarea
              id="confirmation-remarks"
              placeholder="Add optional remarks for this confirmation (max 500 characters)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              disabled={isConfirming}
              className={!isRemarksValid ? 'border-destructive' : ''}
            />
            {!isRemarksValid && (
              <p className="text-xs text-destructive">
                Remarks cannot exceed {MAX_REMARKS_LENGTH} characters
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isConfirming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming || !isRemarksValid}
            >
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
