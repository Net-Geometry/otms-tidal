-- Fix: Apply multiplier after evaluating base formula
CREATE OR REPLACE FUNCTION public.calculate_daily_ot_distribution(p_employee_id uuid, p_ot_date date, p_day_type day_type)
 RETURNS TABLE(request_id uuid, session_hours numeric, session_orp numeric, session_hrp numeric, session_ot_amount numeric, total_daily_hours numeric, daily_ot_amount numeric)
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
  daily_total_hours numeric;
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
  FROM get_active_formula(p_day_type, COALESCE(emp_category, 'All'), p_ot_date);
  
  -- Calculate daily OT amount using TOTAL daily hours
  IF formula.formula_id IS NOT NULL THEN
    BEGIN
      -- Try to evaluate the formula dynamically
      total_ot_amount := evaluate_ot_formula(
        formula.base_formula,
        calculated_orp,
        calculated_hrp,
        daily_total_hours,  -- Use total daily hours here
        emp_salary
      );
      
      -- CRITICAL FIX: Apply multiplier after evaluation if formula succeeded
      IF total_ot_amount IS NOT NULL AND total_ot_amount > 0 THEN
        IF formula.multiplier IS NOT NULL AND formula.multiplier <> 1 THEN
          total_ot_amount := total_ot_amount * formula.multiplier;
        END IF;
      ELSE
        -- If evaluation failed, use multiplier fallback
        IF formula.base_formula ILIKE '%hrp%' OR formula.base_formula = 'HRP' THEN
          total_ot_amount := calculated_hrp * formula.multiplier * daily_total_hours;
        ELSIF formula.base_formula ILIKE '%orp%' OR formula.base_formula = 'ORP' THEN
          total_ot_amount := calculated_orp * formula.multiplier * daily_total_hours;
        ELSE
          -- Handle conditional logic for tiered calculations
          CASE p_day_type
            WHEN 'weekday' THEN
              total_ot_amount := calculated_hrp * formula.multiplier * daily_total_hours;
            WHEN 'saturday' THEN
              total_ot_amount := calculated_hrp * formula.multiplier * daily_total_hours;
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
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Formula evaluation failed, using fallback: %', SQLERRM;
        -- Fallback calculation using multiplier
        CASE p_day_type
          WHEN 'weekday' THEN
            total_ot_amount := calculated_hrp * formula.multiplier * daily_total_hours;
          WHEN 'saturday' THEN
            total_ot_amount := calculated_hrp * formula.multiplier * daily_total_hours;
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
    -- Legacy fallback: use hardcoded multipliers from Malaysian labor law
    CASE p_day_type
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
  
  -- Return proportional distribution for each session
  RETURN QUERY
  SELECT 
    ot.id,
    ot.total_hours,
    calculated_orp,
    calculated_hrp,
    CASE 
      WHEN daily_total_hours > 0 THEN (ot.total_hours / daily_total_hours) * total_ot_amount
      ELSE 0
    END,
    daily_total_hours,
    total_ot_amount
  FROM ot_requests ot
  WHERE ot.employee_id = p_employee_id
    AND ot.ot_date = p_ot_date
    AND ot.status <> 'rejected';
END;
$function$;

-- Backfill existing OT requests to recalculate with corrected formula
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN 
    SELECT DISTINCT employee_id, ot_date, day_type
    FROM ot_requests
    WHERE status <> 'rejected'
    ORDER BY ot_date DESC
  LOOP
    BEGIN
      PERFORM calculate_daily_ot_distribution(rec.employee_id, rec.ot_date, rec.day_type);
      
      UPDATE ot_requests
      SET updated_at = now()
      WHERE employee_id = rec.employee_id
        AND ot_date = rec.ot_date
        AND status <> 'rejected';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to recalculate for employee % on date %: %', rec.employee_id, rec.ot_date, SQLERRM;
    END;
  END LOOP;
END $$;