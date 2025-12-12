-- Update OT submission deadline validation from 7 to 8 days
-- This ensures consistency across frontend validation, migrations, and database triggers

CREATE OR REPLACE FUNCTION public.check_ot_submission_deadline()
RETURNS TRIGGER AS $$
DECLARE
  cutoff_day INTEGER;
  ot_month DATE;
  current_month DATE;
  current_day_of_month INTEGER;
  days_since_ot INTEGER;
BEGIN
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

  -- Cannot submit future dates
  IF NEW.ot_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot submit OT for future dates';
  END IF;

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
