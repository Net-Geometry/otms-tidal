import { format } from 'date-fns';
import { ExternalLink, FileText, Pencil, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/StatusBadge';
import { OTRequest } from '@/types/otms';
import { formatCurrency, formatHours, getDayTypeColor, getDayTypeLabel } from '@/lib/otCalculations';

interface OTDetailsSheetProps {
  request: OTRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (request: OTRequest) => void;
}

export function OTDetailsSheet({ request, open, onOpenChange, onEdit }: OTDetailsSheetProps) {
  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>OT Request Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status with Edit/Resubmit button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-2">Status</p>
              <StatusBadge status={request.status} />
            </div>
            
            {/* Edit button - only for pending_verification status */}
            {request.status === 'pending_verification' && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(request);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit Request
              </Button>
            )}

            {/* Resubmit button - only for rejected status */}
            {request.status === 'rejected' && onEdit && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onEdit(request);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Resubmit Request
              </Button>
            )}
          </div>

          <Separator />

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="text-base font-medium">{format(new Date(request.ot_date), 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Day Type</p>
              <Badge className={getDayTypeColor(request.day_type)}>
                {getDayTypeLabel(request.day_type)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Time</p>
              <p className="text-base font-medium">{request.start_time}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Time</p>
              <p className="text-base font-medium">{request.end_time}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
              <p className="text-base font-medium">{formatHours(request.total_hours)} hrs</p>
            </div>
          </div>

          <Separator />

          {/* Reason */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Reason</p>
            <p className="text-sm">{request.reason}</p>
          </div>

          {/* Attachments */}
          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Attachments ({request.attachment_urls.length})</p>
                <div className="space-y-2">
                  {request.attachment_urls.map((url, index) => (
                    <Button key={index} variant="outline" size="sm" asChild className="w-full justify-start">
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Attachment {index + 1}
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Remarks */}
          {(request.supervisor_remarks || request.supervisor_confirmation_remarks || request.hr_remarks || request.management_remarks) && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Remarks</p>
                {request.supervisor_remarks && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Supervisor Verification</p>
                    <p className="text-sm">{request.supervisor_remarks}</p>
                    {request.supervisor_verified_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Verified: {format(new Date(request.supervisor_verified_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                )}
                {request.supervisor_confirmation_remarks && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Supervisor Confirmation</p>
                    <p className="text-sm">{request.supervisor_confirmation_remarks}</p>
                    {request.supervisor_confirmation_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confirmed: {format(new Date(request.supervisor_confirmation_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                )}
                {request.hr_remarks && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">HR</p>
                    <p className="text-sm">{request.hr_remarks}</p>
                  </div>
                )}
                {request.management_remarks && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Management</p>
                    <p className="text-sm">{request.management_remarks}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Timeline */}
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Timeline</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div>
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(request.created_at), 'PPp')}
                  </p>
                </div>
              </div>
              {request.supervisor_verified_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="text-sm font-medium">Verified by Supervisor</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.supervisor_verified_at), 'PPp')}
                    </p>
                  </div>
                </div>
              )}
              {request.hr_approved_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="text-sm font-medium">Approved by HR</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.hr_approved_at), 'PPp')}
                    </p>
                  </div>
                </div>
              )}
              {request.management_reviewed_at && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  <div>
                    <p className="text-sm font-medium">Reviewed by Management</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.management_reviewed_at), 'PPp')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
