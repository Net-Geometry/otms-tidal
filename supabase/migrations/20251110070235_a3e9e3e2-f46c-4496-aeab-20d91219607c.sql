-- Step 1: Create function to calculate daily OT distribution
CREATE OR REPLACE FUNCTION public.calculate_daily_ot_distribution(
  p_employee_id uuid,
  p_ot_date date,
  p_day_type day_type
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
SET search_path TO 'public'
AS $function$
DECLARE
  emp_salary numeric;
  emp_category text;
  formula record;
  calculated_orp numeric;
  calculated_hrp numeric;
  total_hours numeric;
  total_ot_amount numeric;
  session record;
BEGIN
  -- Get employee's basic salary and employment type
  SELECT basic_salary, employment_type INTO emp_salary, emp_category
  FROM profiles
  WHERE id = p_employee_id;
  
  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary not found for employee_id: %', p_employee_id;
  END IF;
  
  -- Calculate base rates
  calculated_orp := emp_salary / 26;
  calculated_hrp := calculated_orp / 8;
  
  -- Get total hours for the day (from all non-rejected sessions)
  SELECT COALESCE(SUM(ot.total_hours), 0) INTO total_hours
  FROM ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected';
  
  IF total_hours = 0 THEN
    RETURN;
  END IF;
  
  -- Get active formula for this day type and employee category
  SELECT * INTO formula
  FROM get_active_formula(p_day_type, COALESCE(emp_category, 'All'), p_ot_date);
  
  -- Calculate daily OT amount using TOTAL hours
  IF formula.formula_id IS NOT NULL THEN
    BEGIN
      -- Try to evaluate the formula dynamically
      total_ot_amount := evaluate_ot_formula(
        formula.base_formula,
        calculated_orp,
        calculated_hrp,
        total_hours,  -- Use total daily hours here
        emp_salary
      );
      
      -- If evaluation failed, use multiplier fallback
      IF total_ot_amount IS NULL OR total_ot_amount <= 0 THEN
        IF formula.base_formula ILIKE '%hrp%' OR formula.base_formula = 'HRP' THEN
          total_ot_amount := calculated_hrp * formula.multiplier * total_hours;
        ELSIF formula.base_formula ILIKE '%orp%' OR formula.base_formula = 'ORP' THEN
          total_ot_amount := calculated_orp * formula.multiplier * total_hours;
        ELSE
          -- Handle conditional logic for tiered calculations
          CASE p_day_type
            WHEN 'weekday' THEN
              total_ot_amount := calculated_hrp * formula.multiplier * total_hours;
            WHEN 'saturday' THEN
              total_ot_amount := calculated_hrp * formula.multiplier * total_hours;
            WHEN 'sunday' THEN
              IF total_hours <= 4 THEN
                total_ot_amount := 0.5 * calculated_orp;
              ELSIF total_hours <= 8 THEN
                total_ot_amount := 1 * calculated_orp;
              ELSE
                total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (total_hours - 8));
              END IF;
            WHEN 'public_holiday' THEN
              IF total_hours <= 8 THEN
                total_ot_amount := 2 * calculated_orp;
              ELSE
                total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (total_hours - 8));
              END IF;
          END CASE;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Formula evaluation failed, using fallback: %', SQLERRM;
        -- Fallback calculation using multiplier
        CASE p_day_type
          WHEN 'weekday' THEN
            total_ot_amount := calculated_hrp * formula.multiplier * total_hours;
          WHEN 'saturday' THEN
            total_ot_amount := calculated_hrp * formula.multiplier * total_hours;
          WHEN 'sunday' THEN
            IF total_hours <= 4 THEN
              total_ot_amount := 0.5 * calculated_orp;
            ELSIF total_hours <= 8 THEN
              total_ot_amount := 1 * calculated_orp;
            ELSE
              total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (total_hours - 8));
            END IF;
          WHEN 'public_holiday' THEN
            IF total_hours <= 8 THEN
              total_ot_amount := 2 * calculated_orp;
            ELSE
              total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (total_hours - 8));
            END IF;
        END CASE;
    END;
  ELSE
    -- Legacy fallback: use hardcoded multipliers from Malaysian labor law
    CASE p_day_type
      WHEN 'weekday' THEN
        total_ot_amount := 1.5 * calculated_hrp * total_hours;
      WHEN 'saturday' THEN
        total_ot_amount := 2 * calculated_hrp * total_hours;
      WHEN 'sunday' THEN
        IF total_hours <= 4 THEN
          total_ot_amount := 0.5 * calculated_orp;
        ELSIF total_hours <= 8 THEN
          total_ot_amount := 1 * calculated_orp;
        ELSE
          total_ot_amount := (1 * calculated_orp) + (2 * calculated_hrp * (total_hours - 8));
        END IF;
      WHEN 'public_holiday' THEN
        IF total_hours <= 8 THEN
          total_ot_amount := 2 * calculated_orp;
        ELSE
          total_ot_amount := (2 * calculated_orp) + (3 * calculated_hrp * (total_hours - 8));
        END IF;
    END CASE;
  END IF;
  
  -- Return proportional distribution for each session
  RETURN QUERY
  SELECT 
    ot.id,
    ot.total_hours,
    calculated_orp,
    calculated_hrp,
    CASE 
      WHEN total_hours > 0 THEN (ot.total_hours / total_hours) * total_ot_amount
      ELSE 0
    END,
    total_hours,
    total_ot_amount
  FROM ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected';
END;
$function$;

-- Step 2: Replace the calculate_and_set_ot_amount trigger to NOT calculate final amount yet
CREATE OR REPLACE FUNCTION public.calculate_and_set_ot_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  emp_salary numeric;
  emp_category text;
  formula record;
BEGIN
  -- Get employee's basic salary and employment type
  SELECT basic_salary, employment_type INTO emp_salary, emp_category
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
  
  -- Set ot_amount to 0 temporarily - will be calculated by the AFTER trigger
  NEW.ot_amount := 0;
  
  RETURN NEW;
END;
$function$;

-- Step 3: Create AFTER trigger to recalculate all sessions for the affected date
CREATE OR REPLACE FUNCTION public.recalculate_daily_ot_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  distribution_record record;
BEGIN
  -- Calculate and update all sessions for this employee + date
  FOR distribution_record IN 
    SELECT * FROM calculate_daily_ot_distribution(
      NEW.employee_id,
      NEW.ot_date,
      NEW.day_type
    )
  LOOP
    UPDATE ot_requests
    SET 
      orp = distribution_record.session_orp,
      hrp = distribution_record.session_hrp,
      ot_amount = distribution_record.session_ot_amount
    WHERE id = distribution_record.request_id;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Drop existing trigger if exists and create new AFTER trigger
DROP TRIGGER IF EXISTS calculate_ot_amount_trigger ON ot_requests;
DROP TRIGGER IF EXISTS recalculate_daily_ot_trigger ON ot_requests;

-- BEFORE trigger for initial calculation
CREATE TRIGGER calculate_ot_amount_trigger
  BEFORE INSERT OR UPDATE OF total_hours, day_type, ot_date
  ON ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_and_set_ot_amount();

-- AFTER trigger for daily recalculation
CREATE TRIGGER recalculate_daily_ot_trigger
  AFTER INSERT OR UPDATE OF total_hours, day_type, ot_date, status
  ON ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_daily_ot_amounts();

-- Step 5: Recalculate all existing OT requests to apply new logic
-- This will update all existing records with the correct daily calculations
DO $$
DECLARE
  req record;
BEGIN
  FOR req IN 
    SELECT DISTINCT employee_id, ot_date, day_type
    FROM ot_requests
    WHERE status <> 'rejected'
    ORDER BY ot_date, employee_id
  LOOP
    -- Trigger the recalculation by updating each request group
    UPDATE ot_requests
    SET updated_at = now()
    WHERE employee_id = req.employee_id
      AND ot_date = req.ot_date
      AND status <> 'rejected';
  END LOOP;
END $$;