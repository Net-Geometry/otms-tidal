-- Monthly Leave Accrual
-- Runs 1st of each month at 00:00 MYT (16:00 UTC), increments entitled_days
-- for monthly-accrual leave types, capped at default_days.

CREATE OR REPLACE FUNCTION public.process_monthly_leave_accrual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE leave_balances
  SET entitled_days = LEAST(
        leave_balances.entitled_days + lt.monthly_accrual_rate,
        lt.default_days
      ),
      updated_at = now()
  FROM leave_types lt, profiles p
  WHERE leave_balances.leave_type_id = lt.id
    AND p.id = leave_balances.employee_id
    AND lt.accrual_type = 'monthly'
    AND lt.monthly_accrual_rate IS NOT NULL
    AND lt.monthly_accrual_rate > 0
    AND leave_balances.year = EXTRACT(YEAR FROM now())::int
    AND COALESCE(p.status, 'active') = 'active';
END;
$$;

-- Schedule: 1st of each month at midnight MYT (16:00 UTC)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-leave-accrual') THEN
    PERFORM cron.schedule(
      'monthly-leave-accrual',
      '0 16 1 * *',
      $cron$SELECT public.process_monthly_leave_accrual();$cron$
    );
  END IF;
END;
$$;
