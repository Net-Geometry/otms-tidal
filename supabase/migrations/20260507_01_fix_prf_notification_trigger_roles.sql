-- Fix PRF notification trigger to include all management-equivalent roles
-- Bug: SGM users with role 'sgm' (not 'management') were not receiving
-- notifications for PRFs pending verification. The trigger only queried
-- for role = 'management', but the UI treats sgm/director/gm as management.

CREATE OR REPLACE FUNCTION public.notify_prf_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mgmt_users UUID[];
  asst_mgr_users UUID[];
  dmd_users UUID[];
  prf_num TEXT;
BEGIN
  prf_num := COALESCE(NEW.prf_number, 'Draft');

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'prepared' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role IN ('management', 'sgm', 'director', 'gm')
          AND p.deleted_at IS NULL
      ) INTO mgmt_users;

      IF mgmt_users IS NOT NULL AND array_length(mgmt_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(mgmt_users),
          'New PRF for Verification',
          'Purchase requisition #' || prf_num || ' is pending your verification.',
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- draft/rejected → prepared: notify management to verify
    IF NEW.status = 'prepared' AND OLD.status IN ('draft', 'rejected') THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role IN ('management', 'sgm', 'director', 'gm')
          AND p.deleted_at IS NULL
      ) INTO mgmt_users;

      IF mgmt_users IS NOT NULL AND array_length(mgmt_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(mgmt_users),
          CASE WHEN OLD.status = 'rejected' THEN 'PRF Resubmitted for Verification'
               ELSE 'New PRF for Verification' END,
          'Purchase requisition #' || prf_num || ' is pending your verification.',
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    -- prepared → verified: notify assistant_manager/manager to check
    IF NEW.status = 'verified' AND OLD.status = 'prepared' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role IN ('assistant_manager', 'manager')
          AND p.deleted_at IS NULL
      ) INTO asst_mgr_users;

      IF asst_mgr_users IS NOT NULL AND array_length(asst_mgr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(asst_mgr_users),
          'PRF Pending Your Check',
          'Purchase requisition #' || prf_num || ' has been verified and needs your check.',
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    -- verified → checked: notify dmd to approve
    IF NEW.status = 'checked' AND OLD.status = 'verified' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'dmd' AND p.deleted_at IS NULL
      ) INTO dmd_users;

      IF dmd_users IS NOT NULL AND array_length(dmd_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(dmd_users),
          'PRF Pending Your Approval',
          'Purchase requisition #' || prf_num || ' has been checked and needs your approval.',
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    -- checked → approved: notify the requester
    IF NEW.status = 'approved' AND OLD.status = 'checked' THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.requester_id,
        'PRF Approved',
        'Your purchase requisition #' || prf_num || ' has been approved.',
        '/finance/ap/prf',
        'prf_approved'
      );
    END IF;

    -- any → rejected: notify the requester
    IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.requester_id,
        'PRF Rejected',
        'Your purchase requisition #' || prf_num || ' has been rejected.',
        '/finance/ap/prf',
        'prf_rejected'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Also update the notification_type CHECK constraint to include prf_pending_review
-- (already included from the original migration, but ensure it's current)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
  notification_type = ANY (ARRAY[
    'ot_approved'::text,
    'ot_rejected'::text,
    'ot_pending_review'::text,
    'ot_requests_new'::text,
    'ot_requests_approved'::text,
    'ot_requests_rejected'::text,
    'ot_pending_confirmation'::text,
    'ot_supervisor_confirmed'::text,
    'leave_pending_review'::text,
    'leave_approved'::text,
    'leave_rejected'::text,
    'leave_weekly_summary'::text,
    'claim_pending_review'::text,
    'claim_approved'::text,
    'claim_rejected'::text,
    'prf_pending_review'::text,
    'prf_approved'::text,
    'prf_rejected'::text,
    'pv_submitted'::text,
    'pv_checked'::text,
    'pv_approved'::text,
    'pv_rejected'::text,
    'pv_paid'::text,
    'pv_posted'::text,
    'pv_pending_review'::text,
    'ap_invoice_submitted'::text,
    'ap_invoice_approved'::text,
    'ap_invoice_posted'::text,
    'ap_payment_submitted'::text,
    'ap_payment_checked'::text,
    'ap_payment_approved'::text,
    'ap_payment_posted'::text,
    'ar_invoice_submitted'::text,
    'ar_invoice_approved'::text,
    'ar_invoice_posted'::text,
    'or_submitted'::text,
    'or_approved'::text,
    'or_posted'::text,
    'ar_payment_submitted'::text,
    'ar_payment_approved'::text,
    'ar_payment_posted'::text
  ])
);
