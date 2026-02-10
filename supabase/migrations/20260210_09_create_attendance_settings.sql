-- Attendance Management: enums + attendance_settings singleton (seeded)

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'attendance_record_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.attendance_record_status AS ENUM (
      'present',
      'late',
      'absent',
      'half_day',
      'on_leave',
      'holiday',
      'rest_day'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'attendance_import_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.attendance_import_status AS ENUM (
      'pending',
      'processing',
      'completed',
      'failed',
      'partial'
    );
  END IF;
END $$;

-- 2) Settings (singleton)
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id int PRIMARY KEY DEFAULT 1,
  late_threshold_minutes int NOT NULL DEFAULT 10,
  monthly_cutoff_date int NOT NULL DEFAULT 25,
  is_shift_mandatory boolean NOT NULL DEFAULT true,
  allow_early_clockin boolean NOT NULL DEFAULT true,
  allow_multiple_clockin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT attendance_settings_singleton CHECK (id = 1),
  CONSTRAINT attendance_settings_cutoff_range CHECK (monthly_cutoff_date >= 1 AND monthly_cutoff_date <= 31),
  CONSTRAINT attendance_settings_threshold_nonneg CHECK (late_threshold_minutes >= 0)
);

DROP TRIGGER IF EXISTS trg_attendance_settings_updated_at ON public.attendance_settings;
CREATE TRIGGER trg_attendance_settings_updated_at
  BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_settings_read_all" ON public.attendance_settings;
CREATE POLICY "attendance_settings_read_all"
  ON public.attendance_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attendance_settings_write_hr_admin" ON public.attendance_settings;
CREATE POLICY "attendance_settings_write_hr_admin"
  ON public.attendance_settings
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

-- Seed default row
INSERT INTO public.attendance_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
