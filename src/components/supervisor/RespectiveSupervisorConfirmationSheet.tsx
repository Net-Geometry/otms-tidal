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

interface RespectiveSupervisorConfirmationSheetProps {
  request: GroupedOTRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requestIds: string[], remarks?: string) => Promise<void>;
  onDeny: (requestIds: string[], denialRemarks: string) => Promise<void>;
  isConfirming: boolean;
  isDenying: boolean;
}

const MAX_REMARKS_LENGTH = 500;

export function RespectiveSupervisorConfirmationSheet({
  request,
  open,
  onOpenChange,
  onConfirm,
  onDeny,
  isConfirming,
  isDenying,
}: RespectiveSupervisorConfirmationSheetProps) {
  const [remarks, setRemarks] = useState('');
  const [denialRemarks, setDenialRemarks] = useState('');
  const [showDenyDialog, setShowDenyDialog] = useState(false);

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

  const handleDeny = async () => {
    if (denialRemarks.trim().length < 10) {
      return; // Validation will prevent this
    }
    try {
      await onDeny(request.request_ids, denialRemarks.trim());
      setRemarks(''); // Reset remarks on success
      setDenialRemarks(''); // Reset denial remarks
      setShowDenyDialog(false);
      onOpenChange(false); // Close dialog
    } catch (error) {
      // Error is handled by the mutation
      console.error('Denial failed:', error);
    }
  };

  const handleCancel = () => {
    setRemarks(''); // Reset remarks
    setDenialRemarks(''); // Reset denial remarks
    setShowDenyDialog(false);
    onOpenChange(false);
  };

  const remainingChars = MAX_REMARKS_LENGTH - remarks.length;
  const isRemarksValid = remarks.length <= MAX_REMARKS_LENGTH;

  const denialRemainingChars = MAX_REMARKS_LENGTH - denialRemarks.length;
  const isDenialRemarksValid = denialRemarks.length <= MAX_REMARKS_LENGTH && denialRemarks.trim().length >= 10;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Verify OT Request</SheetTitle>
          <SheetDescription>
            As the instructing supervisor, please verify or deny this OT request. If denied, the employee will need to amend and resubmit.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
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

          {/* Supervisor Verification Details */}
          {request.supervisor_verified_at && (
            <>
              <Separator />
              <div className="space-y-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <div className="font-semibold text-blue-900 dark:text-blue-200">Supervisor's Verification</div>
                {request.supervisor_remarks && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Verification Remarks</Label>
                    <p className="mt-1 whitespace-pre-wrap text-sm bg-card p-2 rounded-md border border-border">
                      {request.supervisor_remarks}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Verified at: {format(new Date(request.supervisor_verified_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Supervisor Confirmation Status */}
          {request.supervisor_confirmation_at && (
            <>
              <Separator />
              <div className="space-y-3 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 rounded-lg p-4">
                <div className="font-semibold text-green-900 dark:text-green-200">Supervisor's Confirmation</div>
                {request.supervisor_confirmation_remarks && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Confirmation Remarks</Label>
                    <p className="mt-1 whitespace-pre-wrap text-sm bg-card p-2 rounded-md border border-border">
                      {request.supervisor_confirmation_remarks}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Confirmed at: {format(new Date(request.supervisor_confirmation_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Respective Supervisor Confirmation Remarks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="respective-confirmation-remarks">
                Respective Supervisor Remarks <span className="text-muted-foreground">(Optional)</span>
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
              id="respective-confirmation-remarks"
              placeholder="Add optional remarks for your confirmation as respective supervisor (max 500 characters)..."
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

        </div>
        </div>

        {/* Action Buttons - Sticky Footer */}
        <div className="border-t pt-4 mt-6 space-y-4">
          {!showDenyDialog ? (
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isConfirming || isDenying}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDenyDialog(true)}
                disabled={isConfirming || isDenying}
              >
                Deny OT
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || isDenying || !isRemarksValid}
              >
                {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm OT
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 border border-destructive rounded-lg p-4 bg-destructive/5">
                <div className="font-semibold text-destructive">Deny Overtime Request</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="denial-remarks">
                      Denial Remarks <span className="text-destructive">*</span>
                    </Label>
                    <span
                      className={`text-xs ${
                        !isDenialRemarksValid && denialRemarks.length > 0 ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {denialRemainingChars} characters remaining
                    </span>
                  </div>
                  <Textarea
                    id="denial-remarks"
                    placeholder="Please explain why you are denying this OT request (minimum 10 characters, max 500 characters)..."
                    value={denialRemarks}
                    onChange={(e) => setDenialRemarks(e.target.value)}
                    rows={4}
                    disabled={isDenying}
                    className={denialRemarks.length > 0 && !isDenialRemarksValid ? 'border-destructive' : ''}
                  />
                  {denialRemarks.length > 0 && denialRemarks.trim().length < 10 && (
                    <p className="text-xs text-destructive">
                      Denial remarks must be at least 10 characters
                    </p>
                  )}
                  {denialRemarks.length > MAX_REMARKS_LENGTH && (
                    <p className="text-xs text-destructive">
                      Remarks cannot exceed {MAX_REMARKS_LENGTH} characters
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDenialRemarks('');
                    setShowDenyDialog(false);
                  }}
                  disabled={isDenying}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeny}
                  disabled={isDenying || !isDenialRemarksValid}
                >
                  {isDenying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Denial
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
