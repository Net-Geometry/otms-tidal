-- Enable scheduling + HTTP extensions, and add audit log table

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Audit log for holiday refresh jobs
CREATE TABLE IF NOT EXISTS public.holiday_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  year int4 NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'success', 'partial', 'failed')),
  holidays_scraped int4 NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holiday_refresh_log_started_at
  ON public.holiday_refresh_log (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_holiday_refresh_log_job_year
  ON public.holiday_refresh_log (job_type, year);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.update_holiday_refresh_log_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_holiday_refresh_log_updated_at ON public.holiday_refresh_log;

CREATE TRIGGER trg_update_holiday_refresh_log_updated_at
  BEFORE UPDATE ON public.holiday_refresh_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_holiday_refresh_log_updated_at();

-- RLS
ALTER TABLE public.holiday_refresh_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holiday_refresh_log_read_hr_admin" ON public.holiday_refresh_log;
CREATE POLICY "holiday_refresh_log_read_hr_admin"
  ON public.holiday_refresh_log
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "holiday_refresh_log_modify_service_role" ON public.holiday_refresh_log;
CREATE POLICY "holiday_refresh_log_modify_service_role"
  ON public.holiday_refresh_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
