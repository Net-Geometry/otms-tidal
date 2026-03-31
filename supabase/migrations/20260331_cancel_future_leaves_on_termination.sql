-- Auto-cancel future leaves when employee is terminated or resigned
CREATE OR REPLACE FUNCTION public.cancel_future_leaves_on_termination()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resigned', 'terminated') AND COALESCE(OLD.status, 'active') = 'active' THEN
    UPDATE leave_requests
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Employee ' || NEW.status || ' - auto-cancelled',
        updated_at = now()
    WHERE employee_id = NEW.id
      AND start_date > CURRENT_DATE
      AND status NOT IN ('rejected', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_future_leaves_on_termination ON profiles;

CREATE TRIGGER trg_cancel_future_leaves_on_termination
  AFTER UPDATE OF status ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION cancel_future_leaves_on_termination();
