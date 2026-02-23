ALTER TABLE notifications DROP CONSTRAINT notifications_notification_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check
CHECK (notification_type = ANY (ARRAY[
  'ot_approved', 'ot_rejected', 'ot_pending_review',
  'ot_requests_new', 'ot_requests_approved', 'ot_requests_rejected',
  'ot_pending_confirmation', 'ot_supervisor_confirmed',
  'leave_pending_review', 'leave_approved', 'leave_rejected',
  'claim_pending_review', 'claim_approved', 'claim_rejected'
]));
