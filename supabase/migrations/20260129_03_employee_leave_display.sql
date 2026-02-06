-- Employee leave (display-only) + unified calendar view

CREATE TABLE IF NOT EXISTS public.employee_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date date NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN (
    'annual',
    'medical',
    'emergency',
    'unpaid',
    'maternity',
    'paternity',
    'other'
  )),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT employee_leave_unique_day UNIQUE (employee_id, leave_date, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_employee_leave_employee_date
  ON public.employee_leave (employee_id, leave_date);

CREATE OR REPLACE FUNCTION public.update_employee_leave_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_employee_leave_updated_at ON public.employee_leave;
CREATE TRIGGER trg_update_employee_leave_updated_at
  BEFORE UPDATE ON public.employee_leave
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employee_leave_updated_at();

ALTER TABLE public.employee_leave ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_leave_read_own" ON public.employee_leave;
CREATE POLICY "employee_leave_read_own"
  ON public.employee_leave
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employee_leave_read_hr_admin" ON public.employee_leave;
CREATE POLICY "employee_leave_read_hr_admin"
  ON public.employee_leave
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "employee_leave_write_hr_admin" ON public.employee_leave;
CREATE POLICY "employee_leave_write_hr_admin"
  ON public.employee_leave
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- View for employee calendar display: holidays (calendar items) + current user's leave
CREATE OR REPLACE VIEW public.employee_calendar_events AS
  SELECT
    hci.id,
    hci.calendar_id,
    hci.holiday_date,
    hci.description,
    hci.state_code,
    'holiday'::text AS event_source,
    false AS is_personal_leave,
    (hci.description ILIKE '%Replacement Leave%') AS is_replacement,
    NULL::text AS leave_type,
    NULL::text AS leave_status
  FROM public.holiday_calendar_items hci

  UNION ALL

  SELECT
    el.id,
    NULL::uuid AS calendar_id,
    el.leave_date AS holiday_date,
    CASE
      WHEN el.leave_type = 'annual' THEN 'Annual Leave'
      WHEN el.leave_type = 'medical' THEN 'Medical Leave'
      WHEN el.leave_type = 'emergency' THEN 'Emergency Leave'
      WHEN el.leave_type = 'unpaid' THEN 'Unpaid Leave'
      WHEN el.leave_type = 'maternity' THEN 'Maternity Leave'
      WHEN el.leave_type = 'paternity' THEN 'Paternity Leave'
      ELSE 'Leave'
    END AS description,
    NULL::text AS state_code,
    'leave'::text AS event_source,
    true AS is_personal_leave,
    false AS is_replacement,
    el.leave_type AS leave_type,
    el.status AS leave_status
  FROM public.employee_leave el
  WHERE el.employee_id = auth.uid();
