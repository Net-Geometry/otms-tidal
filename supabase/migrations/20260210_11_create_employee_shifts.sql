-- Attendance Management: employee_shifts table

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  end_date date,
  is_current boolean NOT NULL DEFAULT true,
  allow_multiple_clockin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, shift_id, effective_date),
  CONSTRAINT employee_shifts_date_range_check CHECK (end_date IS NULL OR end_date >= effective_date)
);

DROP TRIGGER IF EXISTS trg_employee_shifts_updated_at ON public.employee_shifts;
CREATE TRIGGER trg_employee_shifts_updated_at
  BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_shifts_read_own" ON public.employee_shifts;
CREATE POLICY "employee_shifts_read_own"
  ON public.employee_shifts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employee_shifts_read_hr_admin_mgmt" ON public.employee_shifts;
CREATE POLICY "employee_shifts_read_hr_admin_mgmt"
  ON public.employee_shifts
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

DROP POLICY IF EXISTS "employee_shifts_write_hr_admin" ON public.employee_shifts;
CREATE POLICY "employee_shifts_write_hr_admin"
  ON public.employee_shifts
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
