-- Attendance Management: shifts table (seeded)

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_period_minutes int NOT NULL DEFAULT 0,
  is_overnight boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT shifts_grace_nonneg CHECK (grace_period_minutes >= 0)
);

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_read_all" ON public.shifts;
CREATE POLICY "shifts_read_all"
  ON public.shifts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "shifts_write_hr_admin" ON public.shifts;
CREATE POLICY "shifts_write_hr_admin"
  ON public.shifts
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

-- Seed shifts
INSERT INTO public.shifts (code, name, start_time, end_time, grace_period_minutes, is_overnight, is_active, sort_order)
VALUES
  ('MOR', 'Morning Shift', '06:00', '14:00', 10, false, true, 10),
  ('REG', 'Regular Shift', '08:30', '17:30', 10, false, true, 20),
  ('AFT', 'Afternoon Shift', '14:00', '22:00', 10, false, true, 30),
  ('NGT', 'Night Shift', '22:00', '06:00', 10, true, true, 40)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  grace_period_minutes = EXCLUDED.grace_period_minutes,
  is_overnight = EXCLUDED.is_overnight,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
