-- Leave Management: expand notifications types + leave status change notifications

-- Expand notifications.notification_type check constraint
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_notification_type_check
  CHECK (
    notification_type IN (
      'ot_approved',
      'ot_rejected',
      'ot_pending_review',
      'ot_requests_new',
      'ot_requests_approved',
      'ot_requests_rejected',
      'ot_pending_confirmation',
      'ot_supervisor_confirmed',
      'leave_pending_review',
      'leave_approved',
      'leave_rejected'
    )
  );

CREATE OR REPLACE FUNCTION public.notify_leave_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hr_users uuid[];
  management_users uuid[];
  employee_id uuid;
  supervisor_id uuid;
BEGIN
  employee_id := NEW.employee_id;
  supervisor_id := NEW.supervisor_id;

  -- INSERT: notify initial reviewer
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending_supervisor' AND supervisor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'New Leave Request for Approval',
        'A new leave request is pending your approval.',
        '/supervisor/approve-leave',
        'leave_pending_review'
      );
    ELSIF NEW.status = 'pending_hr' THEN
      SELECT array_agg(user_id) INTO hr_users
      FROM public.user_roles
      WHERE role IN ('hr', 'admin');

      IF hr_users IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(hr_users),
               'New Leave Request for Review',
               'A new leave request is pending HR review.',
               '/hr/leave',
               'leave_pending_review';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE: status transitions
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Supervisor approved -> notify HR
    IF NEW.status = 'supervisor_approved' AND OLD.status = 'pending_supervisor' THEN
      SELECT array_agg(user_id) INTO hr_users
      FROM public.user_roles
      WHERE role IN ('hr', 'admin');

      IF hr_users IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(hr_users),
               'Leave Request Ready for HR Review',
               'A leave request approved by Supervisor is ready for your review.',
               '/hr/leave',
               'leave_pending_review';
      END IF;
    END IF;

    -- HR approved -> notify Management
    IF NEW.status = 'hr_approved' AND OLD.status IN ('supervisor_approved', 'pending_hr') THEN
      SELECT array_agg(user_id) INTO management_users
      FROM public.user_roles
      WHERE role IN ('management', 'admin');

      IF management_users IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link, notification_type)
        SELECT unnest(management_users),
               'Leave Request Ready for Final Approval',
               'A leave request approved by HR is ready for management approval.',
               '/management/approve-leave',
               'leave_pending_review';
      END IF;
    END IF;

    -- Rejected -> notify employee
    IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        employee_id,
        'Your Leave Request Has Been Rejected',
        'Your leave request has been rejected. Please review the remarks and resubmit if applicable.',
        '/leave/history',
        'leave_rejected'
      );
    END IF;

    -- Management approved -> notify employee
    IF NEW.status = 'management_approved' AND OLD.status IS DISTINCT FROM 'management_approved' THEN
      INSERT INTO public.notifications (user_id, title, message, link, notification_type)
      VALUES (
        employee_id,
        'Your Leave Request Has Been Approved',
        'Your leave request has been fully approved.',
        '/leave/history',
        'leave_approved'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_leave_status_change ON public.leave_requests;
CREATE TRIGGER trigger_notify_leave_status_change
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_status_change();
