import { OTForm } from './OTForm';
import { useOTResubmit } from '@/hooks/useOTResubmit';
import { OTRequest } from '@/types/otms';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResubmitOTFormProps {
  request: OTRequest;
  onSuccess?: () => void;
}

export function ResubmitOTForm({ request, onSuccess }: ResubmitOTFormProps) {
  const { mutate: resubmitOT, isPending } = useOTResubmit();
  
  // Pre-populate form with existing data
  const defaultValues = {
    ot_date: new Date(request.ot_date),
    ot_location_state: request.ot_location_state || '',
    start_time: request.start_time,
    end_time: request.end_time,
    reason: request.reason,
    attachment_urls: request.attachment_urls || [],
  };
  
  const handleResubmit = (data: any) => {
    resubmitOT({
      parentRequestId: request.id,
      ot_date: data.ot_date,
      ot_location_state: data.ot_location_state,
      start_time: data.start_time,
      end_time: data.end_time,
      total_hours: data.total_hours,
      day_type: data.day_type,
      reason: data.reason,
      attachment_urls: data.attachment_urls,
    }, {
      onSuccess
    });
  };
  
  const rejectionReason = request.supervisor_remarks || request.hr_remarks || request.management_remarks;
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {rejectionReason && (
        <Alert variant="destructive" className="border-l-4">
          <AlertDescription className="text-sm sm:text-base">
            <strong>Previous Rejection Reason:</strong>
            <p className="mt-2 text-xs sm:text-sm">{rejectionReason}</p>
          </AlertDescription>
        </Alert>
      )}

      <OTForm
        onSubmit={handleResubmit}
        isSubmitting={isPending}
        employeeId={request.profiles?.employee_id || ''}
        fullName={request.profiles?.full_name || ''}
        onCancel={() => onSuccess?.()}
        defaultValues={defaultValues}
      />
    </div>
  );
}
