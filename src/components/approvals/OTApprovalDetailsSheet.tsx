import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, FileText, AlertCircle, CheckCircle2, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { GroupedOTRequest } from '@/types/otms';
import { formatCurrency, formatHours, formatTime12Hour } from '@/lib/otCalculations';
import { getStatusTooltip } from '@/lib/otStatusTooltip';
import { useOTDailySessions } from '@/hooks/useOTDailySessions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type ApprovalRole = 'supervisor' | 'hr' | 'management';

interface OTApprovalDetailsSheetProps {
  request: GroupedOTRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ApprovalRole;
  currentUserId?: string;
  onApprove?: (request: GroupedOTRequest, sessionIds: string[]) => void;
  onReject?: (request: GroupedOTRequest, sessionIds: string[]) => void;
  onConfirm?: (requestIds: string[], remarks?: string) => Promise<void>;
  isApproving?: boolean;
  isRejecting?: boolean;
  isConfirming?: boolean;
  onConfirmRespectiveSupervisor?: (requestIds: string[], remarks?: string) => Promise<void>;
  onDenyRespectiveSupervisor?: (requestIds: string[], denialRemarks: string) => Promise<void>;
  onReviseDeniedRequest?: (requestIds: string[], remarks?: string) => Promise<void>;
  isConfirmingRespectiveSupervisor?: boolean;
  isDenyingRespectiveSupervisor?: boolean;
  isRevisingDeniedRequest?: boolean;
}

export function OTApprovalDetailsSheet({
  request,
  open,
  onOpenChange,
  role,
  currentUserId,
  onApprove,
  onReject,
  onConfirm,
  isApproving,
  isRejecting,
  isConfirming,
  onConfirmRespectiveSupervisor,
  onDenyRespectiveSupervisor,
  onReviseDeniedRequest,
  isConfirmingRespectiveSupervisor,
  isDenyingRespectiveSupervisor,
  isRevisingDeniedRequest
}: OTApprovalDetailsSheetProps) {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [showDailyContext, setShowDailyContext] = useState(true);

  // Fetch all sessions for this day
  const { data: allDailySessions = [] } = useOTDailySessions({
    employeeId: request?.employee_id || '',
    otDate: request?.ot_date || '',
    enabled: open && !!request,
  });
  const [denialRemarks, setDenialRemarks] = useState('');
  const [showDenyDialog, setShowDenyDialog] = useState(false);

  // Initialize with all session IDs when sheet opens
  useEffect(() => {
    if (open && request) {
      setSelectedSessionIds(request.sessions.map(s => s.id));
    }
  }, [open, request]);

  if (!request) return null;

  // Calculate daily totals from ALL sessions
  const dailyTotalHours = allDailySessions.reduce((sum, s) => sum + s.total_hours, 0);
  const dailyTotalAmount = allDailySessions.reduce((sum, s) => sum + (s.ot_amount || 0), 0);
  const currentSessionIds = request.sessions.map(s => s.id);
  const otherSessions = allDailySessions.filter(s => !currentSessionIds.includes(s.id));

  const profile = (request as any).profiles;

  const hasThresholdViolations = request.threshold_violations &&
    Object.keys(request.threshold_violations).length > 0;

  const canApproveOrReject = (req: GroupedOTRequest) => {
    if (role === 'supervisor') return req.status === 'pending_verification';
    if (role === 'hr') return req.status === 'supervisor_verified' || req.status === 'supervisor_confirmed' || req.status === 'respective_supervisor_confirmed';
    if (role === 'management') return req.status === 'hr_certified';
    return false;
  };

  const canConfirmAsRespectiveSupervisor = (req: GroupedOTRequest) => {
    return req.status === 'pending_respective_supervisor_confirmation' &&
           req.respective_supervisor_id && // Must have respective supervisor assigned
           req.respective_supervisor_id === currentUserId && // Must be the actual respective supervisor
           onConfirmRespectiveSupervisor && onDenyRespectiveSupervisor; // Must have callbacks provided
  };


  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const toggleAllSessions = () => {
    if (selectedSessionIds.length === request.sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(request.sessions.map(s => s.id));
    }
  };

  const selectedHours = request.sessions
    .filter(s => selectedSessionIds.includes(s.id))
    .reduce((sum, s) => sum + s.total_hours, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>OT Request Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Employee Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Employee ID</p>
                <p className="font-medium">{profile?.employee_id || request.employee_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium">{(profile?.departments as any)?.name || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Basic Salary</p>
                <p className="font-medium">{formatCurrency(profile?.basic_salary || 0)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Daily Context Info */}
          {allDailySessions.length > request.sessions.length && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm">
                <p className="font-semibold mb-1">Daily OT Calculation Context</p>
                <p>
                  This employee has <strong>{allDailySessions.length} sessions</strong> totaling{' '}
                  <strong>{formatHours(dailyTotalHours)} hours</strong> on this day.
                  OT amount ({formatCurrency(dailyTotalAmount)}) is calculated for the entire day
                  and distributed proportionally across all sessions.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* OT Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">OT Details</h3>
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Date:</span>
              <span>{format(new Date(request.ot_date), 'dd MMM yyyy')}</span>
              <Badge variant="outline" className="ml-2">
                {request.day_type.replace('_', ' ')}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">OT Sessions in Current View:</span>
                </div>
                {allDailySessions.length > request.sessions.length && (
                  <Badge variant="secondary" className="text-xs">
                    {request.sessions.length} of {allDailySessions.length} sessions
                  </Badge>
                )}
              </div>
              <div className="space-y-2 ml-6">
                {canApproveOrReject(request) && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedSessionIds.length === request.sessions.length}
                      onCheckedChange={toggleAllSessions}
                    />
                    <span className="text-sm font-medium">Select All Sessions</span>
                  </div>
                )}
                
                {request.sessions.map((session, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {canApproveOrReject(request) && (
                        <Checkbox
                          checked={selectedSessionIds.includes(session.id)}
                          onCheckedChange={() => toggleSession(session.id)}
                        />
                      )}
                      <div className="flex-1 bg-muted/50 p-3 rounded space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            <span className="ml-2 text-muted-foreground">
                              ({formatHours(session.total_hours)} hours)
                            </span>
                          </div>
                          {session.status && <StatusBadge status={session.status} rejectionStage={request.rejection_stage} tooltip={getStatusTooltip(request)} />}
                        </div>
                        
                        {session.reason && (
                          <div className="text-sm">
                            <span className="font-medium text-muted-foreground">Reason: </span>
                            <span>{session.reason}</span>
                          </div>
                        )}
                        
                        {session.attachment_urls && session.attachment_urls.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {session.attachment_urls.map((url, i) => (
                              <Button key={i} variant="outline" size="sm" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs">
                                  Attachment {i + 1}
                                </a>
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {canApproveOrReject(request) && (
                  <div className="text-sm font-semibold pt-1 border-t border-border">
                    Selected: {selectedSessionIds.length} / {request.sessions.length} sessions
                    ({formatHours(selectedHours)} hours)
                  </div>
                )}
                
                {!canApproveOrReject(request) && (
                  <div className="text-sm font-semibold pt-1 border-t border-border">
                    Sessions Total: {formatHours(request.total_hours)} hours
                  </div>
                )}
              </div>

              {/* Other Sessions on Same Day */}
              {otherSessions.length > 0 && (
                <Collapsible open={showDailyContext} onOpenChange={setShowDailyContext}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                    <Info className="h-3 w-3" />
                    {showDailyContext ? 'Hide' : 'Show'} other sessions on this day ({otherSessions.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2 ml-6">
                    {otherSessions.map((session) => (
                      <div key={session.id} className="bg-muted/30 p-3 rounded border border-dashed space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            <span className="ml-2 text-muted-foreground">
                              ({formatHours(session.total_hours)} hours)
                            </span>
                          </div>
                          <StatusBadge status={session.status} rejectionStage={request.rejection_stage} tooltip={getStatusTooltip(request)} />
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground pt-2 border-t border-dashed">
                      These sessions are in a different approval status and not included in current action.
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Status:</span>
              <StatusBadge status={request.status} rejectionStage={request.rejection_stage} tooltip={getStatusTooltip(request)} />
            </div>
          </div>

          {/* Respective Supervisor Confirmation Indicator */}
          {request.respective_supervisor_id && request.respective_supervisor_confirmed_at && (
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                <div className="font-semibold mb-1">✓ Respective Supervisor Confirmed</div>
                <div className="text-sm">
                  {format(new Date(request.respective_supervisor_confirmed_at), 'dd MMM yyyy HH:mm')}
                </div>
                {request.respective_supervisor_remarks && (
                  <div className="text-sm mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <span className="font-medium">Remarks: </span>
                    <span>{request.respective_supervisor_remarks}</span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Calculation Details - Only visible to HR and Management */}
          {(role === 'hr' || role === 'management') && (
            <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm">Calculation Details</h4>
              
              {/* Always show daily totals */}
              <div className="grid grid-cols-3 gap-4 text-sm pb-3 border-b border-border/50">
                <div>
                  <p className="text-muted-foreground text-xs">Daily Total Hours</p>
                  <p className="font-semibold">{formatHours(dailyTotalHours)} hrs</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Daily Total OT Amount</p>
                  <p className="font-semibold text-lg">{formatCurrency(dailyTotalAmount)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-xs mb-2">
                  Session Calculation
                  {allDailySessions.length > request.sessions.length && (
                    <span className="text-muted-foreground"> (distributed across {allDailySessions.length} sessions)</span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">ORP</p>
                    <p className="font-medium">{formatCurrency(request.orp || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">HRP</p>
                    <p className="font-medium">{formatCurrency(request.hrp || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Threshold Violations */}
          {hasThresholdViolations && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Threshold Violations Detected</p>
                <div className="text-sm space-y-1">
                  {request.threshold_violations.violations?.map((v: any, idx: number) => (
                    <div key={idx}>
                      • {v.type}: Exceeded by {v.exceeded_by} (Limit: {v.limit}, Current: {v.current})
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Audit Trail */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Audit Trail</h3>

            {request.supervisor_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Supervisor Verification</span>
                  {request.supervisor_verified_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.supervisor_verified_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.supervisor_remarks}</p>
              </div>
            )}

            {request.respective_supervisor_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium text-sm">Respective Supervisor Confirmation</span>
                  {request.respective_supervisor_confirmed_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.respective_supervisor_confirmed_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.respective_supervisor_remarks}</p>
              </div>
            )}

            {request.respective_supervisor_denial_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1 border border-destructive/50">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">Respective Supervisor Denial</span>
                  {request.respective_supervisor_denied_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.respective_supervisor_denied_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.respective_supervisor_denial_remarks}</p>
              </div>
            )}

            {request.supervisor_confirmation_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Supervisor Confirmation</span>
                  {request.supervisor_confirmation_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.supervisor_confirmation_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.supervisor_confirmation_remarks}</p>
              </div>
            )}

            {request.hr_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                  <span className="font-medium text-sm">HR Certification</span>
                  {request.hr_approved_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.hr_approved_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.hr_remarks}</p>
              </div>
            )}

            {request.management_remarks && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Management Review</span>
                  {request.management_reviewed_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(request.management_reviewed_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm pl-6">{request.management_remarks}</p>
              </div>
            )}

            {!request.supervisor_remarks && !request.respective_supervisor_remarks &&
             !request.respective_supervisor_denial_remarks && !request.supervisor_confirmation_remarks &&
             !request.hr_remarks && !request.management_remarks && (
              <div className="text-sm text-muted-foreground italic">
                No audit trail entries yet
              </div>
            )}
          </div>

          {/* Action Buttons Footer - For Approve/Reject */}
          {onApprove && onReject && canApproveOrReject(request) && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 pt-4">
                {/* Warning if partial selection */}
                {selectedSessionIds.length < request.sessions.length && selectedSessionIds.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You have selected {selectedSessionIds.length} out of {request.sessions.length} sessions.
                      Unselected sessions will remain in their current status.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Main action buttons */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onApprove(request, selectedSessionIds)}
                    disabled={isApproving || isRejecting || selectedSessionIds.length === 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isApproving
                      ? (role === 'hr' ? 'Certifying...' : role === 'supervisor' ? 'Verifying...' : 'Approving...')
                      : (role === 'hr' ? 'Certify' : role === 'supervisor' ? 'Verify' : 'Approve')
                    }
                    {selectedSessionIds.length < request.sessions.length && ` (${selectedSessionIds.length})`}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onReject(request, selectedSessionIds)}
                    disabled={isApproving || isRejecting || selectedSessionIds.length === 0}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                    {selectedSessionIds.length < request.sessions.length && ` (${selectedSessionIds.length})`}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons Footer - For Respective Supervisor Confirm/Deny */}
          {onConfirmRespectiveSupervisor && onDenyRespectiveSupervisor && canConfirmAsRespectiveSupervisor(request) && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 pt-4">
                {!showDenyDialog ? (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={async () => {
                        try {
                          await onConfirmRespectiveSupervisor(request.request_ids);
                          onOpenChange(false);
                        } catch (error) {
                          console.error('Confirmation failed:', error);
                        }
                      }}
                      disabled={isConfirmingRespectiveSupervisor || isDenyingRespectiveSupervisor}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {isConfirmingRespectiveSupervisor ? 'Confirming...' : 'Confirm OT'}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowDenyDialog(true)}
                      disabled={isConfirmingRespectiveSupervisor || isDenyingRespectiveSupervisor}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Deny OT
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 border border-destructive rounded-lg p-4 bg-destructive/5">
                      <div className="font-semibold text-destructive">Deny Overtime Request</div>
                      <div className="space-y-2">
                        <Label htmlFor="denial-remarks-details">
                          Denial Remarks <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="denial-remarks-details"
                          placeholder="Please explain why you are denying this OT request (minimum 10 characters, max 500 characters)..."
                          value={denialRemarks}
                          onChange={(e) => setDenialRemarks(e.target.value)}
                          rows={4}
                          disabled={isDenyingRespectiveSupervisor}
                          className={denialRemarks.length > 0 && denialRemarks.trim().length < 10 ? 'border-destructive' : ''}
                        />
                        {denialRemarks.length > 0 && denialRemarks.trim().length < 10 && (
                          <p className="text-xs text-destructive">
                            Denial remarks must be at least 10 characters
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setDenialRemarks('');
                          setShowDenyDialog(false);
                        }}
                        disabled={isDenyingRespectiveSupervisor}
                      >
                        Back
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={async () => {
                          if (denialRemarks.trim().length < 10) return;
                          try {
                            await onDenyRespectiveSupervisor(request.request_ids, denialRemarks.trim());
                            setDenialRemarks('');
                            setShowDenyDialog(false);
                            onOpenChange(false);
                          } catch (error) {
                            console.error('Denial failed:', error);
                          }
                        }}
                        disabled={isDenyingRespectiveSupervisor || denialRemarks.trim().length < 10}
                      >
                        {isDenyingRespectiveSupervisor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Denial
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Action Buttons Footer - For Direct Supervisor Verification (after respective supervisor confirms) */}
          {onConfirm && role === 'supervisor' &&
           request.status === 'pending_supervisor_verification' &&
           request.respective_supervisor_id &&
           request.respective_supervisor_confirmed_at && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 pt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The respective supervisor has confirmed this OT request. Click the "Confirm" button to proceed with your final approval.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={async () => {
                    try {
                      await onConfirm(request.request_ids);
                      onOpenChange(false);
                    } catch (error) {
                      console.error('Confirmation failed:', error);
                    }
                  }}
                  disabled={isConfirming}
                >
                  {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isConfirming ? 'Confirming...' : 'Confirm'}
                </Button>
              </div>
            </>
          )}

          {/* Action Buttons Footer - For Direct Supervisor Review After Denial */}
          {onReviseDeniedRequest && onReject && role === 'supervisor' &&
           request.status === 'pending_supervisor_review' && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 pt-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The respective supervisor has denied this OT request. You can either revise and resubmit to the respective supervisor, or reject the request entirely.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={async () => {
                      try {
                        await onReviseDeniedRequest(request.request_ids);
                        onOpenChange(false);
                      } catch (error) {
                        console.error('Revise failed:', error);
                      }
                    }}
                    disabled={isRevisingDeniedRequest}
                  >
                    {isRevisingDeniedRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isRevisingDeniedRequest ? 'Resubmitting...' : 'Revise & Resubmit'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      if (onReject) {
                        onReject(request, request.request_ids);
                      }
                    }}
                    disabled={isRejecting}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
