-- Migration: Add OT base salary override field to profiles
-- Adds ot_base column and updates all OT calculation functions to use it
-- When ot_base is set, it overrides basic_salary for OT calculations
-- Date: 2026-01-09

-- Add ot_base column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ot_base numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN profiles.ot_base IS
  'Optional OT base salary override. If set, used instead of basic_salary for OT calculations.';

-- Update calculate_and_set_ot_amount trigger to use ot_base when set
CREATE OR REPLACE FUNCTION calculate_and_set_ot_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_salary numeric;
  emp_category text;
  formula record;
  distribution_record record;
  calculated_amount numeric;
BEGIN
  -- Get employee's salary (prefer ot_base over basic_salary) and employment type
  SELECT COALESCE(ot_base, basic_salary), employment_type INTO emp_salary, emp_category
  FROM profiles
  WHERE id = NEW.employee_id;

  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary not found for employee_id: %', NEW.employee_id;
  END IF;

  -- Calculate base rates
  NEW.orp := emp_salary / 26;
  NEW.hrp := NEW.orp / 8;

  -- Get active formula for this day type and employee category
  SELECT * INTO formula
  FROM get_active_formula(NEW.day_type, COALESCE(emp_category, 'All'), NEW.ot_date);

  -- Store formula_id for reference
  IF formula.formula_id IS NOT NULL THEN
    NEW.formula_id := formula.formula_id;
  END IF;

  -- Calculate the ACTUAL ot_amount for THIS specific session
  -- by getting the proportional amount from the daily distribution
  FOR distribution_record IN
    SELECT * FROM calculate_daily_ot_distribution(
      NEW.employee_id,
      NEW.ot_date,
      NEW.day_type
    )
    WHERE request_id = NEW.id
  LOOP
    NEW.ot_amount := distribution_record.session_ot_amount;
  END LOOP;

  -- If no distribution found (shouldn't happen), set to 0
  IF NEW.ot_amount IS NULL THEN
    NEW.ot_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Update calculate_daily_ot_distribution to use ot_base
CREATE OR REPLACE FUNCTION public.calculate_daily_ot_distribution(
  p_employee_id uuid,
  p_ot_date date,
  p_day_type day_type DEFAULT NULL
)
RETURNS TABLE(
  request_id uuid,
  session_hours numeric,
  session_orp numeric,
  session_hrp numeric,
  session_ot_amount numeric,
  total_daily_hours numeric,
  daily_ot_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_salary numeric;
  emp_category text;
  formula record;
  calculated_orp numeric;
  calculated_hrp numeric;
  daily_total_hours numeric;
  total_ot_amount numeric;
  session record;
  verified_day_type day_type;
BEGIN
  -- Get employee's salary (prefer ot_base over basic_salary) and employment type
  SELECT COALESCE(ot_base, basic_salary), employment_type INTO emp_salary, emp_category
  FROM profiles
  WHERE id = p_employee_id;

  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary not found for employee_id: %', p_employee_id;
  END IF;

  -- Use employee-aware day type detection (override provided parameter if needed)
  verified_day_type := public.determine_day_type_for_employee(p_ot_date, p_employee_id);

  -- Log if provided day_type differs from verified (for debugging)
  IF p_day_type IS NOT NULL AND p_day_type != verified_day_type THEN
    RAISE NOTICE 'Day type mismatch for employee % on %: provided=%, verified=%',
      p_employee_id, p_ot_date, p_day_type, verified_day_type;
  END IF;

  -- Calculate base rates
  calculated_orp := emp_salary / 26;
  calculated_hrp := calculated_orp / 8;

  -- Get total hours for the day (from all non-rejected sessions)
  SELECT COALESCE(SUM(ot.total_hours), 0) INTO daily_total_hours
  FROM ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected';

  IF daily_total_hours = 0 THEN
    RETURN;
  END IF;

  -- Get active formula for this day type and employee category
  SELECT * INTO formula
  FROM get_active_formula(verified_day_type, COALESCE(emp_category, 'All'), p_ot_date);

  -- Calculate daily OT amount using TOTAL daily hours
  IF formula.formula_id IS NOT NULL THEN
    BEGIN
      -- Try to evaluate the formula dynamically
      total_ot_amount := evaluate_ot_formula(
        formula.formula_text,
        calculated_orp,
        calculated_hrp,
        daily_total_hours,
        verified_day_type
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Fallback to standard Malaysian rates if formula evaluation fails
        CASE verified_day_type
          WHEN 'weekday' THEN
            total_ot_amount := 1.5 * calculated_hrp * daily_total_hours;
          WHEN 'saturday' THEN
            total_ot_amount := 2 * calculated_hrp * daily_total_hours;
          WHEN 'sunday' THEN
            IF daily_total_hours <= 4 THEN
              total_ot_amount := 0.5 * calculated_orp;
            ELSIF daily_total_hours <= 8 THEN
              total_ot_amount := 1 * calculated_orp;
            ELSE
              total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (daily_total_hours - 8));
            END IF;
          WHEN 'public_holiday' THEN
            IF daily_total_hours <= 8 THEN
              total_ot_amount := 2 * calculated_orp;
            ELSE
              total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (daily_total_hours - 8));
            END IF;
        END CASE;
    END;
  ELSE
    -- Use standard Malaysian rates if no formula found
    CASE verified_day_type
      WHEN 'weekday' THEN
        total_ot_amount := 1.5 * calculated_hrp * daily_total_hours;
      WHEN 'saturday' THEN
        total_ot_amount := 2 * calculated_hrp * daily_total_hours;
      WHEN 'sunday' THEN
        IF daily_total_hours <= 4 THEN
          total_ot_amount := 0.5 * calculated_orp;
        ELSIF daily_total_hours <= 8 THEN
          total_ot_amount := 1 * calculated_orp;
        ELSE
          total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (daily_total_hours - 8));
        END IF;
      WHEN 'public_holiday' THEN
        IF daily_total_hours <= 8 THEN
          total_ot_amount := 2 * calculated_orp;
        ELSE
          total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (daily_total_hours - 8));
        END IF;
    END CASE;
  END IF;

  -- Return session-level breakdown (proportional distribution)
  FOR session IN
    SELECT id, total_hours
    FROM ot_requests ot
    WHERE ot.employee_id = p_employee_id
      AND ot.ot_date = p_ot_date
      AND ot.status <> 'rejected'
  LOOP
    RETURN QUERY
    SELECT
      session.id,
      session.total_hours,
      calculated_orp,
      calculated_hrp,
      (session.total_hours / daily_total_hours) * total_ot_amount,
      daily_total_hours,
      total_ot_amount;
  END LOOP;
END;
$$;

-- Update calculate_daily_ot_distribution_fixed to use ot_base
CREATE OR REPLACE FUNCTION public.calculate_daily_ot_distribution_fixed(
  p_employee_id uuid,
  p_ot_date date,
  p_day_type day_type DEFAULT NULL
)
RETURNS TABLE(
  request_id uuid,
  session_hours numeric,
  session_orp numeric,
  session_hrp numeric,
  session_ot_amount numeric,
  total_daily_hours numeric,
  daily_ot_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_salary numeric;
  emp_category text;
  formula record;
  calculated_orp numeric;
  calculated_hrp numeric;
  daily_total_hours numeric;
  total_ot_amount numeric;
  session record;
  verified_day_type day_type;
BEGIN
  -- Get employee's salary (prefer ot_base over basic_salary) and employment type
  SELECT COALESCE(ot_base, basic_salary), employment_type INTO emp_salary, emp_category
  FROM profiles
  WHERE id = p_employee_id;

  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary not found for employee_id: %', p_employee_id;
  END IF;

  -- Use employee-aware day type detection (override provided parameter if needed)
  verified_day_type := public.determine_day_type_for_employee(p_ot_date, p_employee_id);

  -- Log if provided day_type differs from verified (for debugging)
  IF p_day_type IS NOT NULL AND p_day_type != verified_day_type THEN
    RAISE NOTICE 'Day type mismatch for employee % on %: provided=%, verified=%',
      p_employee_id, p_ot_date, p_day_type, verified_day_type;
  END IF;

  -- Calculate base rates
  calculated_orp := emp_salary / 26;
  calculated_hrp := calculated_orp / 8;

  -- Get total hours for the day (from all non-rejected sessions)
  SELECT COALESCE(SUM(ot.total_hours), 0) INTO daily_total_hours
  FROM ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected';

  IF daily_total_hours = 0 THEN
    RETURN;
  END IF;

  -- Get active formula for this day type and employee category
  SELECT * INTO formula
  FROM get_active_formula(verified_day_type, COALESCE(emp_category, 'All'), p_ot_date);

  -- Calculate daily OT amount using TOTAL daily hours
  IF formula.formula_id IS NOT NULL THEN
    BEGIN
      -- Try to evaluate the formula dynamically
      total_ot_amount := evaluate_ot_formula(
        formula.formula_text,
        calculated_orp,
        calculated_hrp,
        daily_total_hours,
        verified_day_type
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Fallback to standard Malaysian rates if formula evaluation fails
        CASE verified_day_type
          WHEN 'weekday' THEN
            total_ot_amount := 1.5 * calculated_hrp * daily_total_hours;
          WHEN 'saturday' THEN
            total_ot_amount := 2 * calculated_hrp * daily_total_hours;
          WHEN 'sunday' THEN
            IF daily_total_hours <= 4 THEN
              total_ot_amount := 0.5 * calculated_orp;
            ELSIF daily_total_hours <= 8 THEN
              total_ot_amount := 1 * calculated_orp;
            ELSE
              total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (daily_total_hours - 8));
            END IF;
          WHEN 'public_holiday' THEN
            IF daily_total_hours <= 8 THEN
              total_ot_amount := 2 * calculated_orp;
            ELSE
              total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (daily_total_hours - 8));
            END IF;
        END CASE;
    END;
  ELSE
    -- Use standard Malaysian rates if no formula found
    CASE verified_day_type
      WHEN 'weekday' THEN
        total_ot_amount := 1.5 * calculated_hrp * daily_total_hours;
      WHEN 'saturday' THEN
        total_ot_amount := 2 * calculated_hrp * daily_total_hours;
      WHEN 'sunday' THEN
        IF daily_total_hours <= 4 THEN
          total_ot_amount := 0.5 * calculated_orp;
        ELSIF daily_total_hours <= 8 THEN
          total_ot_amount := 1 * calculated_orp;
        ELSE
          total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (daily_total_hours - 8));
        END IF;
      WHEN 'public_holiday' THEN
        IF daily_total_hours <= 8 THEN
          total_ot_amount := 2 * calculated_orp;
        ELSE
          total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (daily_total_hours - 8));
        END IF;
    END CASE;
  END IF;

  -- Return session-level breakdown (proportional distribution)
  FOR session IN
    SELECT id, total_hours
    FROM ot_requests ot
    WHERE ot.employee_id = p_employee_id
      AND ot.ot_date = p_ot_date
      AND ot.status <> 'rejected'
  LOOP
    RETURN QUERY
    SELECT
      session.id,
      session.total_hours,
      calculated_orp,
      calculated_hrp,
      (session.total_hours / daily_total_hours) * total_ot_amount,
      daily_total_hours,
      total_ot_amount;
  END LOOP;
END;
$$;
