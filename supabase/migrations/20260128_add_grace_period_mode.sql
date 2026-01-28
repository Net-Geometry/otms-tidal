-- Add Grace Period Mode toggle to OT settings
-- When enabled, OT submission deadline validation is bypassed (past dates only)

ALTER TABLE public.ot_settings
ADD COLUMN IF NOT EXISTS grace_period_enabled BOOLEAN DEFAULT false;

-- Ensure existing rows have a concrete value
UPDATE public.ot_settings
SET grace_period_enabled = false
WHERE grace_period_enabled IS NULL;

-- Allow HR/admin to update OT settings (needed for Grace Period Mode toggle)
DROP POLICY IF EXISTS set_admin ON public.ot_settings;
CREATE POLICY set_admin ON public.ot_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

-- Update submission deadline trigger function to respect grace period
CREATE OR REPLACE FUNCTION public.check_ot_submission_deadline()
RETURNS TRIGGER AS $$
DECLARE
  cutoff_day INTEGER;
  ot_month DATE;
  current_month DATE;
  current_day_of_month INTEGER;
  days_since_ot INTEGER;
  grace_period BOOLEAN;
BEGIN
  -- Cannot submit future dates (even in grace period mode)
  IF NEW.ot_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot submit OT for future dates';
  END IF;

  -- Early return if grace period is enabled
  grace_period := false;
  SELECT grace_period_enabled INTO grace_period
  FROM public.ot_settings
  LIMIT 1;

  IF grace_period = true THEN
    RETURN NEW;
  END IF;

  -- Get the cutoff day from settings (default to 10 if not found)
  SELECT ot_submission_cutoff_day INTO cutoff_day
  FROM public.ot_settings
  LIMIT 1;

  IF cutoff_day IS NULL THEN
    cutoff_day := 10;
  END IF;

  -- Get current date info
  current_day_of_month := EXTRACT(DAY FROM NOW());
  ot_month := DATE_TRUNC('month', NEW.ot_date)::DATE;
  current_month := DATE_TRUNC('month', NOW())::DATE;

  -- Check if OT date is in the current month
  IF ot_month = current_month THEN
    -- For current month: check 8-day lookback
    days_since_ot := CURRENT_DATE - NEW.ot_date;
    IF days_since_ot > 8 THEN
      RAISE EXCEPTION 'Current month OT can only be submitted within 8 days of the date worked';
    END IF;
  ELSE
    -- For previous months: check if current day is before/on cutoff day
    IF current_day_of_month > cutoff_day THEN
      RAISE EXCEPTION 'OT for previous months can only be submitted until the %sth of the current month', cutoff_day;
    END IF;

    -- Only allow submission for dates that are in past months
    IF ot_month >= current_month THEN
      RAISE EXCEPTION 'Invalid date for OT submission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
