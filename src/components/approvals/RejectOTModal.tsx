import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { XCircle, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GroupedOTRequest } from '@/types/otms';
import { formatTime12Hour, formatHours } from '@/lib/otCalculations';

interface RejectOTModalProps {
  request: GroupedOTRequest | null;
  selectedSessionIds?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (remarks: string) => Promise<void>;
  isLoading: boolean;
  rejectionStage?: string;
}

export function RejectOTModal({ 
  request, 
  selectedSessionIds,
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading,
  rejectionStage
}: RejectOTModalProps) {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setRemarks('');
      setError('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!remarks.trim()) {
      setError('Reason for rejection is required');
      return;
    }
    if (remarks.trim().length < 10) {
      setError('Please provide a detailed reason (at least 10 characters)');
      return;
    }
    
    onConfirm(remarks);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!request) return null;

  const profile = (request as any).profiles;
  const selectedSessions = selectedSessionIds 
    ? request.sessions.filter(s => selectedSessionIds.includes(s.id))
    : request.sessions;
  const isPartialRejection = selectedSessions.length < request.sessions.length;

  // Calculate if button should be enabled
  const isButtonDisabled = isLoading || remarks.trim().length < 10;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-foreground">
            Reject OT {isPartialRejection ? 'Sessions' : 'Request'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {isPartialRejection 
              ? `You are rejecting ${selectedSessions.length} out of ${request.sessions.length} sessions. Please provide a reason.`
              : 'This action will reject the OT request. Please provide a reason for the rejection.'
            }
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
            {/* Employee Info */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Employee:</span>
                  <p className="font-semibold text-foreground">{profile?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee ID:</span>
                  <p className="font-semibold text-foreground">{profile?.employee_id || request.employee_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-semibold text-foreground">{format(new Date(request.ot_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {isPartialRejection ? 'Selected Hours:' : 'Total Hours:'}
                  </span>
                  <p className="font-semibold text-foreground">
                    {formatHours(selectedSessions.reduce((sum, s) => sum + s.total_hours, 0))} hours
                  </p>
                </div>
              </div>

              {/* Sessions */}
              <div className="pt-2 border-t border-border">
                <span className="text-muted-foreground text-sm">
                  {isPartialRejection ? 'Sessions to Reject:' : 'OT Sessions:'}
                </span>
                <div className="space-y-1 mt-1">
                  {selectedSessions.map((session, idx) => (
                    <div key={idx} className="text-sm text-foreground">
                      • {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)} 
                      <span className="text-muted-foreground ml-2">({formatHours(session.total_hours)} hrs)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Employee's Reason for OT */}
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">
                Employee's Reason for OT
              </Label>
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-md">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {request.reason || 'No reason provided'}
                </p>
              </div>
            </div>

            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label htmlFor="rejection-remarks" className="text-foreground font-semibold">
                Reason for Rejection <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-remarks"
                placeholder="Please provide a detailed reason for rejecting this OT request (minimum 10 characters)..."
                value={remarks}
                onChange={(e) => {
                  setRemarks(e.target.value);
                  setError('');
                }}
                rows={4}
                className="resize-none"
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {remarks.length}/10 characters minimum
              </p>
            </div>
          </div>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isButtonDisabled}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {isLoading ? 'Rejecting...' : 'Submit Rejection'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
