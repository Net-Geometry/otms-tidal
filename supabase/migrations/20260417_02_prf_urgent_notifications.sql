-- Update PRF notification trigger to highlight urgent PRFs in titles & messages.
-- Reads NEW.priority and prefixes "URGENT:" so approvers can spot urgent items
-- in their notification list without opening each PRF.

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
  is_urgent BOOLEAN;
  urgent_prefix TEXT;
  urgent_msg TEXT;
BEGIN
  prf_num := COALESCE(NEW.prf_number, 'Draft');
  is_urgent := COALESCE(NEW.priority, 'normal') = 'urgent';
  urgent_prefix := CASE WHEN is_urgent THEN 'URGENT: ' ELSE '' END;
  urgent_msg := CASE WHEN is_urgent THEN ' [marked URGENT]' ELSE '' END;

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
          urgent_prefix || 'New PRF for Verification',
          'Purchase requisition #' || prf_num || ' is pending your verification.' || urgent_msg,
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    IF NEW.status = 'prepared' AND OLD.status IN ('draft', 'rejected') THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'management' AND p.deleted_at IS NULL
      ) INTO mgmt_users;

      IF mgmt_users IS NOT NULL AND array_length(mgmt_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(mgmt_users),
          urgent_prefix ||
            CASE WHEN OLD.status = 'rejected' THEN 'PRF Resubmitted for Verification'
                 ELSE 'New PRF for Verification' END,
          'Purchase requisition #' || prf_num || ' is pending your verification.' || urgent_msg,
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    IF NEW.status = 'verified' AND OLD.status = 'prepared' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'assistant_manager' AND p.deleted_at IS NULL
      ) INTO asst_mgr_users;

      IF asst_mgr_users IS NOT NULL AND array_length(asst_mgr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(asst_mgr_users),
          urgent_prefix || 'PRF Pending Your Check',
          'Purchase requisition #' || prf_num || ' has been verified and needs your check.' || urgent_msg,
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

    IF NEW.status = 'checked' AND OLD.status = 'verified' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role = 'dmd' AND p.deleted_at IS NULL
      ) INTO dmd_users;

      IF dmd_users IS NOT NULL AND array_length(dmd_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(dmd_users),
          urgent_prefix || 'PRF Pending Your Approval',
          'Purchase requisition #' || prf_num || ' has been checked and needs your approval.' || urgent_msg,
          '/management/approve-prf',
          'prf_pending_review';
      END IF;
    END IF;

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
