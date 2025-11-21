import { format } from 'date-fns';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OTRequest } from '@/types/otms';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { StatusBadge } from '@/components/StatusBadge';
import { Separator } from '@/components/ui/separator';

interface OTApprovalDetailsSheetProps {
  request: OTRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showRecertifyActions?: boolean;
  onRecertify?: (requestId: string, remarks: string) => void;
  onDecline?: (requestId: string, remarks: string) => void;
  isRecertifying?: boolean;
  isDeclining?: boolean;
}

export function OTApprovalDetailsSheet({ 
  request, 
  open, 
  onOpenChange,
  showRecertifyActions = false,
  onRecertify,
  onDecline,
  isRecertifying = false,
  isDeclining = false,
}: OTApprovalDetailsSheetProps) {
  const [remarks, setRemarks] = useState('');
  
  if (!request) return null;

  const handleRecertify = () => {
    if (onRecertify && request) {
      onRecertify(request.id, remarks);
      setRemarks('');
    }
  };

  const handleDecline = () => {
    if (onDecline && request) {
      onDecline(request.id, remarks);
      setRemarks('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>OT Request Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Request ID</Label>
                <p className="font-mono text-sm">{request.id.slice(0, 8)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <StatusBadge status={request.status} rejectionStage={request.rejection_stage} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">OT Date</Label>
                <p>{format(new Date(request.ot_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Day Type</Label>
                <p className="capitalize">{request.day_type.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">Start Time</Label>
                <p>{request.start_time}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">End Time</Label>
                <p>{request.end_time}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Hours</Label>
                <p className="font-semibold">{formatHours(request.total_hours)} hrs</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Calculation Details */}
          <div className="space-y-3">
            <h3 className="font-semibold">Calculation Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">ORP</Label>
                <p>{formatCurrency(request.orp || 0)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">HRP</Label>
                <p>{formatCurrency(request.hrp || 0)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">OT Amount</Label>
                <p className="font-semibold text-lg">{formatCurrency(request.ot_amount || 0)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reason */}
          <div>
            <Label className="text-muted-foreground">Reason</Label>
            <p className="mt-1">{request.reason}</p>
          </div>

          {/* Supervisor Remarks */}
          {request.supervisor_remarks && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Supervisor Remarks</Label>
                <p className="mt-1">{request.supervisor_remarks}</p>
                {request.supervisor_verified_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified on {format(new Date(request.supervisor_verified_at), 'dd MMM yyyy HH:mm')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* HR Remarks */}
          {request.hr_remarks && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground">HR Remarks</Label>
                <p className="mt-1">{request.hr_remarks}</p>
              </div>
            </>
          )}

          {/* Management Remarks */}
          {request.management_remarks && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Management Remarks</Label>
                <p className="mt-1">{request.management_remarks}</p>
                {request.management_reviewed_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reviewed on {format(new Date(request.management_reviewed_at), 'dd MMM yyyy HH:mm')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Employee Info */}
          {request.profiles && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold">Employee Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p>{request.profiles.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Employee ID</Label>
                    <p>{request.profiles.employee_id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p>{request.profiles.department?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Basic Salary</Label>
                    <p>{formatCurrency(request.profiles.basic_salary || 0)}</p>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {showRecertifyActions && (
          <>
            <Separator className="my-4" />
            <SheetFooter className="flex-col space-y-4 sm:space-y-0">
              <div className="w-full space-y-2">
                <Label htmlFor="recertify-remarks">Remarks (Optional)</Label>
                <Textarea
                  id="recertify-remarks"
                  placeholder="Add any remarks or notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  onClick={handleDecline}
                  variant="destructive"
                  disabled={isRecertifying || isDeclining}
                  className="flex-1"
                >
                  {isDeclining ? 'Declining...' : 'Decline'}
                </Button>
                <Button
                  onClick={handleRecertify}
                  disabled={isRecertifying || isDeclining}
                  className="flex-1"
                >
                  {isRecertifying ? 'Recertifying...' : 'Recertify'}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
