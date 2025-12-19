-- Migration: Update backend OT calculation functions to use employee-aware holiday detection
-- Replaces calls to determine_day_type() with determine_day_type_for_employee()
-- Ensures state-specific holidays are properly detected in all calculations
-- Date: 2025-12-19

-- Update calculate_daily_ot_distribution to use employee-aware day type detection
-- Note: This function currently receives day_type as parameter, but we should validate it
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
  -- Get employee's basic salary and employment type
  SELECT basic_salary, employment_type INTO emp_salary, emp_category
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

-- Add comment
COMMENT ON FUNCTION public.calculate_daily_ot_distribution_fixed(uuid, date, day_type) IS 
'Fixed version of calculate_daily_ot_distribution using employee-aware holiday detection.
Ensures state-specific holidays are properly detected and correct rates applied.';

-- Create function to update existing OT calculations that may be using wrong day type
CREATE OR REPLACE FUNCTION public.recalculate_ot_with_correct_day_type(
  p_employee_id UUID,
  p_ot_date DATE
)
RETURNS TABLE(
  old_day_type day_type,
  new_day_type day_type,
  old_amount NUMERIC,
  new_amount NUMERIC,
  difference NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_day_type day_type;
  correct_day_type day_type;
  current_amount NUMERIC;
  new_amount NUMERIC;
  calc_result RECORD;
BEGIN
  -- Get current day_type and amount from an existing OT request
  SELECT day_type, total_ot_amount 
  INTO current_day_type, current_amount
  FROM ot_requests 
  WHERE employee_id = p_employee_id 
    AND ot_date = p_ot_date 
    AND status != 'rejected'
  LIMIT 1;
  
  -- Get correct day type using employee-aware function
  correct_day_type := public.determine_day_type_for_employee(p_ot_date, p_employee_id);
  
  -- Calculate new amount using correct day type
  SELECT daily_ot_amount INTO new_amount
  FROM public.calculate_daily_ot_distribution_fixed(p_employee_id, p_ot_date, correct_day_type)
  LIMIT 1;
  
  -- Return comparison
  RETURN QUERY
  SELECT 
    current_day_type,
    correct_day_type,
    current_amount,
    COALESCE(new_amount, 0::NUMERIC),
    COALESCE(new_amount, 0::NUMERIC) - COALESCE(current_amount, 0::NUMERIC);
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.recalculate_ot_with_correct_day_type(uuid, date) IS 
'Recalculates OT amount using correct employee-aware day type detection.
Used for validating and correcting existing calculations.';

-- Create function to batch update OT requests with correct day types
CREATE OR REPLACE FUNCTION public.update_ot_requests_day_types()
RETURNS TABLE(
  updated_count INTEGER,
  summary JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ot_record RECORD;
  updated_count INTEGER := 0;
  correct_day_type day_type;
  summary_data JSONB := '{}';
  state_counts JSONB := '{}';
BEGIN
  -- Process all approved OT requests from 2025 that might have wrong day types
  FOR ot_record IN 
    SELECT id, employee_id, ot_date, day_type, total_ot_amount
    FROM ot_requests
    WHERE status = 'approved'
      AND ot_date >= '2025-01-01'
      AND ot_date <= CURRENT_DATE
  LOOP
    -- Get correct day type for this employee and date
    correct_day_type := public.determine_day_type_for_employee(ot_record.ot_date, ot_record.employee_id);
    
    -- Update if day type is wrong
    IF ot_record.day_type != correct_day_type THEN
      -- Update the record with correct day type
      UPDATE ot_requests
      SET 
        day_type = correct_day_type,
        updated_at = NOW(),
        internal_notes = COALESCE(internal_notes, '') || 
          E'\n[' || NOW() || '] Day type corrected: ' || ot_record.day_type || ' → ' || correct_day_type
      WHERE id = ot_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  -- Build summary
  summary_data := jsonb_build_object(
    'updated_count', updated_count,
    'processed_at', NOW(),
    'date_range', jsonb_build_object(
      'from', '2025-01-01',
      'to', CURRENT_DATE
    )
  );
  
  RETURN QUERY
  SELECT updated_count, summary_data;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.update_ot_requests_day_types() IS 
'Batch updates all OT requests to use correct employee-aware day types.
Should be run after deploying the holiday detection fix.';

-- Replace the old determine_day_type function with employee-aware version
-- Keep old function as legacy for backward compatibility
CREATE OR REPLACE FUNCTION public.determine_day_type(ot_date date)
RETURNS day_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- For backward compatibility, use legacy function that only checks federal holidays
  SELECT public.determine_day_type_legacy(ot_date);
$$;

-- Add warning comment
COMMENT ON FUNCTION public.determine_day_type(date) IS 
'DEPRECATED: Use determine_day_type_for_employee() for employee-specific holiday detection.
This function only checks federal holidays and legacy public_holidays table for backward compatibility.';