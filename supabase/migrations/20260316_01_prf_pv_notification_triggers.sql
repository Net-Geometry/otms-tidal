-- Add PRF and PV notification types and create database triggers
-- Following the same pattern as claim/leave notification triggers

-------------------------------------------------------
-- 1. Update notification_type constraint to include PRF and PV types
-------------------------------------------------------
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
    'pv_pending_review'::text,
    'pv_approved'::text,
    'pv_rejected'::text
  ])
);

-------------------------------------------------------
-- 2. PRF notification trigger
-------------------------------------------------------
-- PRF Workflow: draft → prepared (finance_admin) → verified (management)
--               → checked (assistant_manager) → approved (dmd)
-- Rejection can happen at prepared, verified, or checked stages.

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
  finance_admin_users UUID[];
  prf_num TEXT;
BEGIN
  prf_num := COALESCE(NEW.prf_number, 'Draft');

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'prepared' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'management' AND p.deleted_at IS NULL
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
        WHERE ur.role = 'management' AND p.deleted_at IS NULL
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

    -- prepared → verified: notify assistant_manager to check
    IF NEW.status = 'verified' AND OLD.status = 'prepared' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'assistant_manager' AND p.deleted_at IS NULL
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

    -- checked → approved: notify the requester (finance_admin who created it)
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

DROP TRIGGER IF EXISTS trg_prf_status_notification ON public.purchase_requisitions;
CREATE TRIGGER trg_prf_status_notification
  AFTER INSERT OR UPDATE OF status ON public.purchase_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_prf_status_change();

-------------------------------------------------------
-- 3. PV notification trigger
-------------------------------------------------------
-- PV Workflow: draft → pending (finance_admin) → checked (assistant_manager)
--              → approved (dmd) → paid (finance_admin)
-- Rejection can happen at pending or checked stages.

CREATE OR REPLACE FUNCTION public.notify_pv_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asst_mgr_users UUID[];
  dmd_users UUID[];
  finance_admin_users UUID[];
  pv_num TEXT;
BEGIN
  pv_num := COALESCE(NEW.pv_number, 'Draft');

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'assistant_manager' AND p.deleted_at IS NULL
      ) INTO asst_mgr_users;

      IF asst_mgr_users IS NOT NULL AND array_length(asst_mgr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(asst_mgr_users),
          'New PV for Checking',
          'Payment voucher #' || pv_num || ' is pending your check.',
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Get finance_admin users for approval/rejection notifications
    SELECT ARRAY(
      SELECT ur.user_id FROM user_roles ur
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.role = 'finance_admin' AND p.deleted_at IS NULL
    ) INTO finance_admin_users;

    -- draft → pending: notify assistant_manager to check
    IF NEW.status = 'pending' AND OLD.status = 'draft' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'assistant_manager' AND p.deleted_at IS NULL
      ) INTO asst_mgr_users;

      IF asst_mgr_users IS NOT NULL AND array_length(asst_mgr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(asst_mgr_users),
          'New PV for Checking',
          'Payment voucher #' || pv_num || ' is pending your check.',
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    -- pending → checked: notify dmd to approve
    IF NEW.status = 'checked' AND OLD.status = 'pending' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'dmd' AND p.deleted_at IS NULL
      ) INTO dmd_users;

      IF dmd_users IS NOT NULL AND array_length(dmd_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(dmd_users),
          'PV Pending Your Approval',
          'Payment voucher #' || pv_num || ' has been checked and needs your approval.',
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    -- checked → approved: notify finance_admin users (they process payment)
    IF NEW.status = 'approved' AND OLD.status = 'checked' THEN
      IF finance_admin_users IS NOT NULL AND array_length(finance_admin_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(finance_admin_users),
          'PV Approved',
          'Payment voucher #' || pv_num || ' has been approved and is ready for payment.',
          '/finance/ap/payment-vouchers',
          'pv_approved';
      END IF;
    END IF;

    -- any → rejected: notify finance_admin users
    IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      IF finance_admin_users IS NOT NULL AND array_length(finance_admin_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(finance_admin_users),
          'PV Rejected',
          'Payment voucher #' || pv_num || ' has been rejected.',
          '/finance/ap/payment-vouchers',
          'pv_rejected';
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pv_status_notification ON public.payment_vouchers;
CREATE TRIGGER trg_pv_status_notification
  AFTER INSERT OR UPDATE OF status ON public.payment_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_status_change();
