-- Migration: Use OT location state for holiday detection
-- Updates backend day type detection to prefer ot_requests.ot_location_state over profiles.state.
-- Date: 2026-01-09

-- Determine day type using a specific location state (federal + state holidays)
CREATE OR REPLACE FUNCTION public.determine_day_type_for_state(
  ot_date date,
  location_state text DEFAULT NULL
)
RETURNS day_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dow int;
  is_holiday boolean;
BEGIN
  -- Get day of week
  dow := EXTRACT(DOW FROM ot_date);

  -- 1) Holiday overrides (company-specific)
  SELECT EXISTS(
    SELECT 1 FROM public.holiday_overrides
    WHERE date = ot_date
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;

  -- 2) Malaysian holidays (federal or location state)
  SELECT EXISTS(
    SELECT 1 FROM public.malaysian_holidays
    WHERE date = ot_date
      AND (state = 'ALL' OR (location_state IS NOT NULL AND state = location_state))
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;

  -- 3) Legacy public holidays (backward compatibility)
  SELECT EXISTS(
    SELECT 1 FROM public.public_holidays
    WHERE holiday_date = ot_date
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;

  -- Weekend / weekday fallback
  IF dow = 0 THEN
    RETURN 'sunday';
  ELSIF dow = 6 THEN
    RETURN 'saturday';
  ELSE
    RETURN 'weekday';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.determine_day_type_for_state(date, text) IS
'Determines day type for OT calculations using location_state for state-specific holidays. Federal holidays are state=ALL.';

-- Drop and recreate employee-aware holiday detection to prefer OT location state (if present)
DROP FUNCTION IF EXISTS public.determine_day_type_for_employee(date, uuid);

CREATE FUNCTION public.determine_day_type_for_employee(
  p_ot_date date,
  p_employee_id uuid
)
RETURNS day_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  location_state text;
  employee_state text;
BEGIN
  -- Prefer OT location state from existing sessions on the same date (non-rejected)
  SELECT ot.ot_location_state INTO location_state
  FROM public.ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected'
    AND ot.ot_location_state IS NOT NULL
  ORDER BY ot.created_at ASC NULLS LAST
  LIMIT 1;

  -- Fallback: employee profile state
  SELECT p.state INTO employee_state
  FROM public.profiles p
  WHERE p.id = p_employee_id;

  RETURN public.determine_day_type_for_state(p_ot_date, COALESCE(location_state, employee_state));
END;
$$;

COMMENT ON FUNCTION public.determine_day_type_for_employee(date, uuid) IS
'Determines day type considering OT location state for state-specific holidays. Falls back to employee profile state when location is not set.';

-- Update trigger function to enforce location consistency + derive day_type from date+location
CREATE OR REPLACE FUNCTION public.calculate_and_set_ot_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_salary numeric;
  emp_category text;
  profile_state text;
  formula record;
  distribution_record record;
BEGIN
  -- Default OT location state to the employee's profile state if not provided
  IF NEW.ot_location_state IS NULL OR NEW.ot_location_state = '' THEN
    SELECT state INTO profile_state
    FROM public.profiles
    WHERE id = NEW.employee_id;
    NEW.ot_location_state := profile_state;
  END IF;

  -- Enforce a single OT location per employee per date (required for daily distribution logic)
  IF NEW.ot_location_state IS NOT NULL THEN
    PERFORM 1
    FROM public.ot_requests ot
    WHERE ot.employee_id = NEW.employee_id
      AND ot.ot_date = NEW.ot_date
      AND ot.status <> 'rejected'
      AND (NEW.id IS NULL OR ot.id <> NEW.id)
      AND ot.ot_location_state IS NOT NULL
      AND ot.ot_location_state <> NEW.ot_location_state
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'OT Location (State) must match existing OT sessions for this date.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Force day_type based on date + OT location state (federal + state holidays)
  NEW.day_type := public.determine_day_type_for_state(NEW.ot_date, NEW.ot_location_state);

  -- Get employee's salary (prefer ot_base over basic_salary) and employment type
  SELECT COALESCE(ot_base, basic_salary), employment_type INTO emp_salary, emp_category
  FROM public.profiles
  WHERE id = NEW.employee_id;

  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary not found for employee_id: %', NEW.employee_id;
  END IF;

  -- Calculate base rates
  NEW.orp := emp_salary / 26;
  NEW.hrp := NEW.orp / 8;

  -- Get active formula for this day type and employee category
  SELECT * INTO formula
  FROM public.get_active_formula(NEW.day_type, COALESCE(emp_category, 'All'), NEW.ot_date);

  -- Store formula_id for reference
  IF formula.formula_id IS NOT NULL THEN
    NEW.formula_id := formula.formula_id;
  END IF;

  -- Calculate the actual per-session ot_amount (may be overridden by AFTER trigger recalculation)
  NEW.ot_amount := 0;
  FOR distribution_record IN
    SELECT * FROM public.calculate_daily_ot_distribution(
      NEW.employee_id,
      NEW.ot_date,
      NEW.day_type
    )
    WHERE request_id = NEW.id
  LOOP
    NEW.ot_amount := distribution_record.session_ot_amount;
  END LOOP;

  IF NEW.ot_amount IS NULL THEN
    NEW.ot_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.calculate_and_set_ot_amount() IS
'BEFORE trigger: sets ot_location_state default, enforces per-day location consistency, derives day_type from date+location, and calculates base rates.';

-- Ensure triggers also fire when OT location changes
DROP TRIGGER IF EXISTS calculate_ot_amount_trigger ON public.ot_requests;
DROP TRIGGER IF EXISTS recalculate_daily_ot_trigger ON public.ot_requests;

CREATE TRIGGER calculate_ot_amount_trigger
  BEFORE INSERT OR UPDATE OF total_hours, day_type, ot_date, ot_location_state
  ON public.ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_and_set_ot_amount();

CREATE TRIGGER recalculate_daily_ot_trigger
  AFTER INSERT OR UPDATE OF total_hours, day_type, ot_date, ot_location_state, status
  ON public.ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_daily_ot_amounts();
