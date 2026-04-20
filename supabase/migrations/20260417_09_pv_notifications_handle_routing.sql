-- Update PV notification trigger so it handles the new flexible approval routing.
-- - target='fa'       : draft → approved (no AM, no DMD notification)
-- - target='asst_mgr' : draft → pending → approved (AM gets pending notif, then FA gets approved notif)
-- - target='dmd'      : draft → pending → checked → approved (full chain, current behavior)
--
-- Change: the "approved" notification now fires on ANY transition into 'approved' status
-- (not just from 'checked'), so the FA-only and FA→AM paths still notify finance_admin users.

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
  is_urgent BOOLEAN;
  urgent_prefix TEXT;
  urgent_msg TEXT;
  target TEXT;
BEGIN
  pv_num := COALESCE(NEW.pv_number, 'Draft');
  is_urgent := COALESCE(NEW.priority, 'normal') = 'urgent';
  urgent_prefix := CASE WHEN is_urgent THEN 'URGENT: ' ELSE '' END;
  urgent_msg := CASE WHEN is_urgent THEN ' [marked URGENT]' ELSE '' END;
  target := COALESCE(NEW.target_approval_level, 'dmd');

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
          urgent_prefix || 'New PV for Checking',
          'Payment voucher #' || pv_num || ' is pending your check.' || urgent_msg,
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT ARRAY(
      SELECT ur.user_id FROM user_roles ur
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.role = 'finance_admin' AND p.deleted_at IS NULL
    ) INTO finance_admin_users;

    IF NEW.status = 'pending' AND OLD.status = 'draft' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'assistant_manager' AND p.deleted_at IS NULL
      ) INTO asst_mgr_users;

      IF asst_mgr_users IS NOT NULL AND array_length(asst_mgr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(asst_mgr_users),
          urgent_prefix || 'New PV for Checking',
          'Payment voucher #' || pv_num || ' is pending your check.' || urgent_msg,
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    IF NEW.status = 'checked' AND OLD.status = 'pending' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'dmd' AND p.deleted_at IS NULL
      ) INTO dmd_users;

      IF dmd_users IS NOT NULL AND array_length(dmd_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(dmd_users),
          urgent_prefix || 'PV Pending Your Approval',
          'Payment voucher #' || pv_num || ' has been checked and needs your approval.' || urgent_msg,
          '/management/approve-pv',
          'pv_pending_review';
      END IF;
    END IF;

    -- ANY → approved: covers 'fa' draft→approved, 'asst_mgr' pending→approved, 'dmd' checked→approved
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      IF finance_admin_users IS NOT NULL AND array_length(finance_admin_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(finance_admin_users),
          'PV Approved',
          'Payment voucher #' || pv_num || ' has been approved and is ready for payment.',
          '/finance/ap/payment-vouchers',
          'pv_approved';
      END IF;
    END IF;

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
