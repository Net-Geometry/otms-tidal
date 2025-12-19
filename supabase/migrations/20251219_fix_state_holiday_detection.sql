-- Migration: Fix holiday detection for state-specific holidays
-- Fix critical bug where state-specific holidays are not properly detected
-- Affects Selangor employees working on Dec 11, 2025 and other state holidays
-- Date: 2025-12-19

-- Create new employee-aware holiday detection function
CREATE OR REPLACE FUNCTION public.determine_day_type_for_employee(
  ot_date date, 
  employee_id uuid
)
RETURNS day_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dow int;
  employee_state text;
  is_holiday boolean;
BEGIN
  -- Get day of week
  dow := EXTRACT(DOW FROM ot_date);
  
  -- Get employee's state from profile
  SELECT state INTO employee_state 
  FROM profiles 
  WHERE id = employee_id;
  
  -- Check for holidays in order of priority:
  -- 1. Holiday overrides (company-specific)
  SELECT EXISTS(
    SELECT 1 FROM public.holiday_overrides 
    WHERE date = ot_date
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- 2. Malaysian holidays (federal or employee's state)
  SELECT EXISTS(
    SELECT 1 FROM public.malaysian_holidays 
    WHERE date = ot_date 
    AND (state = 'ALL' OR (employee_state IS NOT NULL AND state = employee_state))
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- 3. Legacy public holidays (for backward compatibility)
  SELECT EXISTS(
    SELECT 1 FROM public.public_holidays 
    WHERE holiday_date = ot_date
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- Determine day type based on day of week
  IF dow = 0 THEN
    RETURN 'sunday';
  ELSIF dow = 6 THEN
    RETURN 'saturday';
  ELSE
    RETURN 'weekday';
  END IF;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.determine_day_type_for_employee(date, uuid) IS 
'Determines day type for OT calculations considering employee state for state-specific holidays. 
Fixes critical bug where state holidays like Selangor Dec 11 were treated as weekdays.';

-- Create wrapper function for backward compatibility
CREATE OR REPLACE FUNCTION public.determine_day_type_legacy(ot_date date)
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
  dow := EXTRACT(DOW FROM ot_date);
  
  -- Check holiday_overrides first
  SELECT EXISTS(
    SELECT 1 FROM public.holiday_overrides 
    WHERE date = ot_date
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- Check malaysian_holidays for federal holidays only (no employee context)
  SELECT EXISTS(
    SELECT 1 FROM public.malaysian_holidays 
    WHERE date = ot_date 
    AND state = 'ALL'
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- Check legacy public holidays
  SELECT EXISTS(
    SELECT 1 FROM public.public_holidays 
    WHERE holiday_date = ot_date
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;
  
  -- Determine by day of week
  IF dow = 0 THEN
    RETURN 'sunday';
  ELSIF dow = 6 THEN
    RETURN 'saturday';
  ELSE
    RETURN 'weekday';
  END IF;
END;
$$;

-- Create function to audit affected OT records
CREATE OR REPLACE FUNCTION public.find_affected_ot_records()
RETURNS TABLE(
  ot_request_id uuid,
  employee_id uuid,
  employee_name text,
  employee_state text,
  ot_date date,
  current_day_type day_type,
  correct_day_type day_type,
  holiday_name text,
  current_amount numeric,
  correct_amount numeric,
  underpayment_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH affected_records AS (
    SELECT 
      ot.id as ot_request_id,
      ot.employee_id,
      p.full_name as employee_name,
      p.state as employee_state,
      ot.ot_date,
      ot.day_type as current_day_type,
      public.determine_day_type_for_employee(ot.ot_date, ot.employee_id) as correct_day_type,
      mh.name as holiday_name,
      ot.total_ot_amount as current_amount
    FROM ot_requests ot
    JOIN profiles p ON p.id = ot.employee_id
    LEFT JOIN malaysian_holidays mh ON mh.date = ot.ot_date 
      AND (mh.state = 'ALL' OR mh.state = p.state)
    WHERE ot.status = 'approved'
      AND ot.ot_date >= '2025-01-01'
      AND ot.day_type != public.determine_day_type_for_employee(ot.ot_date, ot.employee_id)
  ),
  with_corrections AS (
    SELECT 
      ar.*,
      (SELECT ot_amount FROM public.calculate_ot_amount(
        (SELECT basic_salary FROM profiles WHERE id = ar.employee_id),
        ar.total_hours,
        ar.correct_day_type
      )) as correct_amount
    FROM affected_records ar
    JOIN ot_requests ot ON ot.id = ar.ot_request_id
  )
  SELECT 
    wc.ot_request_id,
    wc.employee_id,
    wc.employee_name,
    wc.employee_state,
    wc.ot_date,
    wc.current_day_type,
    wc.correct_day_type,
    wc.holiday_name,
    wc.current_amount,
    wc.correct_amount,
    (wc.correct_amount - wc.current_amount) as underpayment_amount
  FROM with_corrections wc
  ORDER BY wc.ot_date DESC, wc.employee_name;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.find_affected_ot_records() IS 
'Identifies all OT records affected by the state holiday detection bug and calculates underpayment amounts.
Used for audit trail and financial impact assessment.';