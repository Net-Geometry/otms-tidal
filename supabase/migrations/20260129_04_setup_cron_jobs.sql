-- Setup cron jobs for holiday refresh + replacement calculation

-- Helper to trigger scheduled edge function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_scheduled_holiday_refresh(
  p_job_type text,
  p_year int4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_endpoint text;
BEGIN
  -- Pull secrets from Supabase Vault
  v_project_url := vault.get_secret('project_url');
  v_anon_key := vault.get_secret('anon_key');

  IF v_project_url IS NULL OR v_anon_key IS NULL THEN
    -- Silent failure (audit handled in edge function when invoked)
    RETURN;
  END IF;

  v_endpoint := v_project_url || '/functions/v1/scheduled-holiday-refresh';

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'job_type', p_job_type,
      'year', p_year
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Silent failure
  RETURN;
END;
$$;

-- Daily job to ensure replacement holidays exist (idempotent)
CREATE OR REPLACE FUNCTION public.run_daily_replacement_holiday_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int4;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int4;
  PERFORM public.insert_replacement_holidays(v_year);
  PERFORM public.insert_replacement_holidays(v_year + 1);
EXCEPTION WHEN OTHERS THEN
  -- Silent failure
  RETURN;
END;
$$;

-- Schedule jobs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-holiday-refresh') THEN
    PERFORM cron.schedule(
      'monthly-holiday-refresh',
      '0 2 1 * *',
      $cron$SELECT public.trigger_scheduled_holiday_refresh('monthly_refresh', EXTRACT(YEAR FROM now())::int4);$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'q4-next-year-population') THEN
    PERFORM cron.schedule(
      'q4-next-year-population',
      '0 3 1 10 *',
      $cron$SELECT public.trigger_scheduled_holiday_refresh('q4_population', (EXTRACT(YEAR FROM now())::int4 + 1));$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-replacement-holiday-check') THEN
    PERFORM cron.schedule(
      'daily-replacement-holiday-check',
      '0 4 * * *',
      $cron$SELECT public.run_daily_replacement_holiday_check();$cron$
    );
  END IF;
END;
$$;
