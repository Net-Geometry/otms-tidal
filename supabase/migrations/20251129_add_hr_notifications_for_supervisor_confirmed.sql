-- Add in-app notifications for HR when supervisor confirms requests
-- This handles the new supervisor_confirmed and respective_supervisor_confirmed statuses

CREATE OR REPLACE FUNCTION public.notify_ot_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hr_users UUID[];
  management_users UUID[];
  employee_id UUID;
  supervisor_id UUID;
BEGIN
  employee_id := NEW.employee_id;
  supervisor_id := NEW.supervisor_id;

  -- NEW: When employee first submits → notify supervisor
  IF NEW.status = 'pending_verification' AND OLD IS NULL AND NEW.is_resubmission = false THEN
    IF supervisor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'New OT Request Awaiting Verification',
        'A team member has submitted a new OT request for your verification.',
        '/supervisor/verify?request=' || NEW.id,
        'ot_pending_review'
      );
    END IF;
  END IF;

  -- When supervisor verifies → notify HR AND employee
  IF NEW.status = 'supervisor_verified' AND OLD.status = 'pending_verification' THEN
    SELECT array_agg(user_id) INTO hr_users
    FROM user_roles WHERE role = 'hr';

    IF hr_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(hr_users),
             'New OT Request for Approval',
             'A new OT request verified by Supervisor is ready for your review.',
             '/hr/approve?request=' || NEW.id || '&tab=pending_certification',
             'ot_pending_review';
    END IF;

    -- NEW: Notify employee of progress
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Verified',
      'Your supervisor has verified your OT request. It is now pending HR approval.',
      '/ot/history?request=' || NEW.id,
      'ot_approved'
    );
  END IF;

  -- When supervisor confirms (direct flow) → notify HR AND employee
  IF NEW.status = 'supervisor_confirmed' AND OLD.status = 'pending_supervisor_confirmation' THEN
    SELECT array_agg(user_id) INTO hr_users
    FROM user_roles WHERE role = 'hr';

    IF hr_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(hr_users),
             'New OT Request Pending Certification',
             'A supervisor has confirmed an OT request and it is now ready for your certification.',
             '/hr/approve?request=' || NEW.id || '&tab=pending_certification',
             'ot_pending_review';
    END IF;

    -- Notify employee of progress
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Confirmed',
      'Your supervisor has confirmed your OT request. It is now pending HR certification.',
      '/ot/history?request=' || NEW.id,
      'ot_approved'
    );
  END IF;

  -- When respective supervisor confirms → notify HR AND employee
  IF NEW.status = 'respective_supervisor_confirmed' AND OLD.status = 'pending_respective_supervisor_confirmation' THEN
    SELECT array_agg(user_id) INTO hr_users
    FROM user_roles WHERE role = 'hr';

    IF hr_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(hr_users),
             'New OT Request Pending Certification',
             'A respective supervisor has confirmed an OT request and it is now ready for your certification.',
             '/hr/approve?request=' || NEW.id || '&tab=pending_certification',
             'ot_pending_review';
    END IF;

    -- Notify employee of progress
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Confirmed by Respective Supervisor',
      'Your respective supervisor has confirmed your OT request. It is now pending HR certification.',
      '/ot/history?request=' || NEW.id,
      'ot_approved'
    );
  END IF;

  -- When HR certifies → notify Management AND employee
  IF NEW.status = 'hr_certified' AND (OLD.status = 'supervisor_verified' OR OLD.status = 'supervisor_confirmed' OR OLD.status = 'respective_supervisor_confirmed') THEN
    SELECT array_agg(user_id) INTO management_users
    FROM user_roles WHERE role = 'management';

    IF management_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(management_users),
             'OT Request Ready for Management Review',
             'A new OT request has been certified by HR and is ready for your review.',
             '/management/approve?request=' || NEW.id,
             'ot_pending_review';
    END IF;

    -- NEW: Notify employee of progress
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Certified by HR',
      'HR has certified your OT request. It is now pending Management approval.',
      '/ot/history?request=' || NEW.id,
      'ot_approved'
    );
  END IF;

  -- When HR rejects after supervisor verification → notify both employee AND supervisor
  IF NEW.status = 'rejected' AND OLD.status = 'supervisor_verified' THEN
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Rejected by HR',
      'Your OT request has been rejected by HR. Please review the remarks and resubmit.',
      '/ot/history?request=' || NEW.id,
      'ot_rejected'
    );

    IF supervisor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'OT Request Rejected by HR',
        'An OT request you verified has been rejected by HR. The employee may resubmit.',
        '/supervisor/verify?request=' || NEW.id,
        'ot_rejected'
      );
    END IF;
  END IF;

  -- When HR rejects after supervisor confirmation → notify both employee AND supervisor
  IF NEW.status = 'rejected' AND (OLD.status = 'supervisor_confirmed' OR OLD.status = 'respective_supervisor_confirmed') THEN
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Rejected by HR',
      'Your OT request has been rejected by HR. Please review the remarks and resubmit.',
      '/ot/history?request=' || NEW.id,
      'ot_rejected'
    );

    IF supervisor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'OT Request Rejected by HR',
        'An OT request from your team has been rejected by HR. The employee may resubmit.',
        '/supervisor/verify?request=' || NEW.id,
        'ot_rejected'
      );
    END IF;
  END IF;

  -- When Management rejects → send to HR for recertification
  IF NEW.status = 'pending_hr_recertification' AND OLD.status = 'hr_certified' THEN
    SELECT array_agg(user_id) INTO hr_users
    FROM user_roles WHERE role = 'hr';

    IF hr_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(hr_users),
             'Management Rejected OT Request - Recertification Required',
             'Management has rejected an OT request. Please review and decide whether to recertify or send back to employee.',
             '/hr/recertify?request=' || NEW.id,
             'ot_rejected';
    END IF;
  END IF;

  -- When supervisor rejects → notify employee
  IF NEW.status = 'rejected' AND OLD.status = 'pending_verification' THEN
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Rejected by Supervisor',
      'Your OT request has been rejected by your supervisor. Please review the remarks and resubmit if applicable.',
      '/ot/history?request=' || NEW.id,
      'ot_rejected'
    );
  END IF;

  -- When employee resubmits → notify supervisor and HR
  IF NEW.is_resubmission = true AND NEW.status = 'pending_verification' AND OLD IS NULL THEN
    IF supervisor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'OT Request Resubmitted',
        'An employee has resubmitted a previously rejected OT request. Please review again.',
        '/supervisor/verify?request=' || NEW.id,
        'ot_pending_review'
      );
    END IF;

    SELECT array_agg(user_id) INTO hr_users
    FROM user_roles WHERE role = 'hr';

    IF hr_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(hr_users),
             'OT Request Resubmitted by Employee',
             'A previously rejected OT request has been resubmitted.',
             '/hr/approve?request=' || NEW.id || '&tab=pending_certification',
             'ot_pending_review';
    END IF;
  END IF;

  -- When HR recertifies and sends back to Management
  IF NEW.status = 'hr_certified' AND OLD.status = 'pending_hr_recertification' THEN
    SELECT array_agg(user_id) INTO management_users
    FROM user_roles WHERE role = 'management';

    IF management_users IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      SELECT unnest(management_users),
             'OT Request Recertified by HR',
             'HR has recertified an OT request. Please review again.',
             '/management/approve?request=' || NEW.id,
             'ot_pending_review';
    END IF;
  END IF;

  -- When HR declines recertification → notify employee
  IF NEW.status = 'rejected' AND OLD.status = 'pending_hr_recertification' THEN
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Requires Revision',
      'HR has declined to recertify your OT request. Please review the remarks and resubmit with corrections.',
      '/ot/history?request=' || NEW.id,
      'ot_rejected'
    );

    IF supervisor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, link, notification_type)
      VALUES (
        supervisor_id,
        'OT Request Sent Back for Revision',
        'An OT request from your team has been sent back by HR for employee correction.',
        '/supervisor/verify?request=' || NEW.id,
        'ot_rejected'
      );
    END IF;
  END IF;

  -- When Management approves → notify employee
  IF NEW.status = 'management_approved' AND OLD.status = 'hr_certified' THEN
    INSERT INTO notifications (user_id, title, message, link, notification_type)
    VALUES (
      employee_id,
      'Your OT Request Has Been Fully Approved',
      'Your OT request has been finalized and approved by Management.',
      '/ot/history?request=' || NEW.id,
      'ot_approved'
    );
  END IF;

  RETURN NEW;
END;
$function$;
