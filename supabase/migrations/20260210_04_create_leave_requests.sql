-- Leave Management: leave_requests workflow table + RLS + balance usage trigger

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),

  start_date date NOT NULL,
  end_date date NOT NULL,
  is_half_day boolean DEFAULT false,
  half_day_period text CHECK (half_day_period IN ('morning', 'afternoon')),
  total_days numeric(5,1) NOT NULL,

  reason text,
  attachment_urls text[] DEFAULT '{}',

  status public.leave_request_status NOT NULL DEFAULT 'pending_supervisor',

  supervisor_id uuid REFERENCES auth.users(id),
  supervisor_approved_at timestamptz,
  supervisor_remarks text,

  hr_id uuid REFERENCES auth.users(id),
  hr_approved_at timestamptz,
  hr_remarks text,

  management_id uuid REFERENCES auth.users(id),
  management_approved_at timestamptz,
  management_remarks text,

  rejected_by uuid REFERENCES auth.users(id),
  rejected_at timestamptz,
  rejection_remarks text,
  rejection_stage text,

  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT leave_requests_date_range_check CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_half_day_check CHECK (
    (is_half_day = false)
    OR (is_half_day = true AND start_date = end_date AND half_day_period IS NOT NULL)
  ),
  CONSTRAINT leave_requests_total_days_check CHECK (total_days > 0)
);

DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "leave_requests_read_own" ON public.leave_requests;
CREATE POLICY "leave_requests_read_own" ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "leave_requests_read_supervisor" ON public.leave_requests;
CREATE POLICY "leave_requests_read_supervisor" ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = supervisor_id);

DROP POLICY IF EXISTS "leave_requests_read_hr_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_read_hr_admin" ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

DROP POLICY IF EXISTS "leave_requests_insert_own" ON public.leave_requests;
CREATE POLICY "leave_requests_insert_own" ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = employee_id
    OR auth.uid() = supervisor_id
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

-- Trigger: maintain leave_balances.used_days on approval/cancellation
CREATE OR REPLACE FUNCTION public.update_leave_balance_used_days()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_delta numeric(5,1);
BEGIN
  -- Only adjust when status changes
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_year := EXTRACT(YEAR FROM NEW.start_date)::int;

  -- Increment on final approval
  IF NEW.status = 'management_approved' AND OLD.status IS DISTINCT FROM 'management_approved' THEN
    v_delta := NEW.total_days;
  -- Decrement when moving away from final approval (e.g. cancelled after approval)
  ELSIF OLD.status = 'management_approved' AND NEW.status IS DISTINCT FROM 'management_approved' THEN
    v_delta := -1 * OLD.total_days;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.leave_balances
  SET used_days = GREATEST(0, used_days + v_delta),
      updated_at = now()
  WHERE employee_id = NEW.employee_id
    AND leave_type_id = NEW.leave_type_id
    AND year = v_year;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_balance_used_days ON public.leave_requests;
CREATE TRIGGER trg_leave_balance_used_days
  AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_leave_balance_used_days();
