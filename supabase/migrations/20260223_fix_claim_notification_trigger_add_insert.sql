-- Fix: Claims notification trigger missing INSERT event
-- Root cause: trigger was AFTER UPDATE only, so when employee submits a claim
-- (INSERT with status pending_supervisor or pending_hr), no notification fires.

CREATE OR REPLACE FUNCTION public.notify_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hr_users UUID[];
  finance_users UUID[];
  employee_id UUID;
  ticket TEXT;
BEGIN
  employee_id := NEW.employee_id;
  ticket := NEW.ticket_number;

  -- ===================== INSERT: new claim submitted =====================
  IF TG_OP = 'INSERT' THEN
    -- pending_supervisor → notify supervisor
    IF NEW.status = 'pending_supervisor' AND NEW.supervisor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.supervisor_id,
        'New Claim for Approval',
        'A new claim #' || ticket || ' is pending your approval.',
        '/supervisor/approve-claims',
        'claim_pending_review'
      );
    END IF;

    -- pending_hr (no supervisor or supervisor is privileged role) → notify HR
    IF NEW.status = 'pending_hr' THEN
      SELECT ARRAY(
        SELECT ur.user_id FROM user_roles ur
        JOIN profiles p ON ur.user_id = p.id
        WHERE ur.role IN ('hr', 'admin') AND p.deleted_at IS NULL
      ) INTO hr_users;

      IF hr_users IS NOT NULL AND array_length(hr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(hr_users),
          'New Claim for HR Review',
          'A new claim #' || ticket || ' is pending HR review.',
          '/hr/claims',
          'claim_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ===================== UPDATE: status transitions =====================
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Get HR users (only when needed below)
    SELECT ARRAY(
      SELECT ur.user_id FROM user_roles ur
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.role = 'hr' AND p.deleted_at IS NULL
    ) INTO hr_users;

    -- Get Finance users (only when needed below)
    SELECT ARRAY(
      SELECT ur.user_id FROM user_roles ur
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.role = 'finance' AND p.deleted_at IS NULL
    ) INTO finance_users;

    -- Supervisor approved → notify HR
    IF NEW.status = 'supervisor_approved' THEN
      IF hr_users IS NOT NULL AND array_length(hr_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(hr_users),
          'Claim Ready for HR Review',
          'Supervisor approved claim #' || ticket,
          '/hr/claims',
          'claim_pending_review';
      END IF;
    END IF;

    -- HR approved (pending_finance) → notify Finance
    IF NEW.status = 'pending_finance' AND OLD.status IN ('pending_hr', 'supervisor_approved') THEN
      IF finance_users IS NOT NULL AND array_length(finance_users, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(finance_users),
          'Claim Ready for Finance Review',
          'HR forwarded claim #' || ticket || ' for finance review',
          '/finance/claims',
          'claim_pending_review';
      END IF;
    END IF;

    -- Finance forwarded to director/gm/head_finance → notify the assigned approver
    IF NEW.status = 'pending_director' AND NEW.director_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.director_id,
        'Claim Pending Your Approval',
        'Finance forwarded claim #' || ticket || ' for your approval',
        '/management/approve-claims',
        'claim_pending_review'
      );
    END IF;

    IF NEW.status = 'pending_gm' AND NEW.gm_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.gm_id,
        'Claim Pending Your Approval',
        'Finance forwarded claim #' || ticket || ' for your approval',
        '/management/approve-claims',
        'claim_pending_review'
      );
    END IF;

    IF NEW.status = 'pending_head_finance' AND NEW.head_finance_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        NEW.head_finance_id,
        'Claim Pending Your Approval',
        'Finance forwarded claim #' || ticket || ' for your approval',
        '/management/approve-claims',
        'claim_pending_review'
      );
    END IF;

    -- Final approved (any approver) → notify employee
    IF NEW.status IN ('finance_approved', 'director_approved', 'gm_approved', 'head_finance_approved') THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        employee_id,
        'Claim Approved',
        'Your claim #' || ticket || ' has been approved',
        '/claims/history',
        'claim_approved'
      );
    END IF;

    -- Rejected → notify employee
    IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        employee_id,
        'Claim Rejected',
        'Your claim #' || ticket || ' has been rejected',
        '/claims/history',
        'claim_rejected'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to fire on INSERT OR UPDATE (was UPDATE only)
DROP TRIGGER IF EXISTS trg_claim_status_notification ON public.claims;
CREATE TRIGGER trg_claim_status_notification
  AFTER INSERT OR UPDATE OF status ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_claim_status_change();
