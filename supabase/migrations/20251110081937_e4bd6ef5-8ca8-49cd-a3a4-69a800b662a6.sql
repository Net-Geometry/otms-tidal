-- Drop the problematic AFTER trigger
DROP TRIGGER IF EXISTS recalculate_ot_after_insert_update ON ot_requests;
DROP FUNCTION IF EXISTS recalculate_daily_ot_amounts_safe();

-- Modify the BEFORE trigger to calculate the FULL amount immediately
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

-- Recalculate all existing OT requests with triggers disabled
DO $$
DECLARE
  rec record;
  distribution_record record;
BEGIN
  -- Disable triggers temporarily
  SET session_replication_role = replica;
  
  FOR rec IN 
    SELECT DISTINCT employee_id, ot_date, day_type
    FROM ot_requests
    WHERE status <> 'rejected'
    ORDER BY ot_date DESC
  LOOP
    -- Calculate distribution for this employee/date
    FOR distribution_record IN 
      SELECT * FROM calculate_daily_ot_distribution(
        rec.employee_id,
        rec.ot_date,
        rec.day_type
      )
    LOOP
      -- Update each session with correct amounts (triggers disabled)
      UPDATE ot_requests
      SET 
        orp = distribution_record.session_orp,
        hrp = distribution_record.session_hrp,
        ot_amount = distribution_record.session_ot_amount,
        updated_at = now()
      WHERE id = distribution_record.request_id;
    END LOOP;
  END LOOP;
  
  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
  
  RAISE NOTICE 'Successfully recalculated all OT requests';
END $$;