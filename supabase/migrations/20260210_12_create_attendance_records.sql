-- Attendance Management: attendance_records + lateness trigger

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  clock_in_2 timestamptz,
  clock_out_2 timestamptz,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  status public.attendance_record_status NOT NULL DEFAULT 'present',
  is_late boolean NOT NULL DEFAULT false,
  late_minutes int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'import',
  import_id uuid,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date),
  CONSTRAINT attendance_source_check CHECK (source IN ('import', 'manual')),
  CONSTRAINT attendance_late_nonneg CHECK (late_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON public.attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records(status);

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger function: calculate late flags
CREATE OR REPLACE FUNCTION public.calculate_attendance_lateness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold int := 10;
  v_start time;
  v_grace int := 0;
  v_is_overnight boolean := false;
  v_clock_time time;
  v_clock_mins int;
  v_start_mins int;
  v_allowed_mins int;
BEGIN
  -- defaults
  NEW.is_late := false;
  NEW.late_minutes := 0;

  IF NEW.clock_in IS NULL OR NEW.shift_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT late_threshold_minutes
  INTO v_threshold
  FROM public.attendance_settings
  WHERE id = 1;

  IF v_threshold IS NULL THEN
    v_threshold := 10;
  END IF;

  SELECT start_time, grace_period_minutes, is_overnight
  INTO v_start, v_grace, v_is_overnight
  FROM public.shifts
  WHERE id = NEW.shift_id;

  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;

  v_clock_time := timezone('Asia/Kuala_Lumpur', NEW.clock_in)::time;
  v_clock_mins := (EXTRACT(HOUR FROM v_clock_time)::int * 60) + EXTRACT(MINUTE FROM v_clock_time)::int;
  v_start_mins := (EXTRACT(HOUR FROM v_start)::int * 60) + EXTRACT(MINUTE FROM v_start)::int;

  IF COALESCE(v_is_overnight, false) AND v_clock_mins < v_start_mins THEN
    v_clock_mins := v_clock_mins + 1440;
  END IF;

  v_allowed_mins := v_start_mins + COALESCE(v_grace, 0) + COALESCE(v_threshold, 10);

  IF v_clock_mins > v_allowed_mins THEN
    NEW.is_late := true;
    NEW.late_minutes := v_clock_mins - v_allowed_mins;
  ELSE
    NEW.is_late := false;
    NEW.late_minutes := 0;
  END IF;

  -- Keep status consistent when using present/late
  IF NEW.status IN ('present', 'late') THEN
    NEW.status := CASE
      WHEN NEW.clock_in IS NULL THEN NEW.status
      WHEN NEW.is_late THEN 'late'::public.attendance_record_status
      ELSE 'present'::public.attendance_record_status
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_attendance_lateness ON public.attendance_records;
CREATE TRIGGER trg_calculate_attendance_lateness
  BEFORE INSERT OR UPDATE OF clock_in, shift_id, status ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_attendance_lateness();

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "attendance_records_read_own" ON public.attendance_records;
CREATE POLICY "attendance_records_read_own"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "attendance_records_read_supervisor_team" ON public.attendance_records;
CREATE POLICY "attendance_records_read_supervisor_team"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = attendance_records.employee_id
        AND p.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendance_records_read_hr_admin_mgmt" ON public.attendance_records;
CREATE POLICY "attendance_records_read_hr_admin_mgmt"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

DROP POLICY IF EXISTS "attendance_records_write_hr_admin" ON public.attendance_records;
CREATE POLICY "attendance_records_write_hr_admin"
  ON public.attendance_records
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
