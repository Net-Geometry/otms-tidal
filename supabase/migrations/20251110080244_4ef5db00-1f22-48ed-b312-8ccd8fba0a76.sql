-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS calculate_ot_before_insert_update ON ot_requests;
DROP TRIGGER IF EXISTS recalculate_ot_after_insert_update ON ot_requests;

-- Create BEFORE trigger that ONLY sets ORP, HRP and initializes ot_amount
-- This trigger does NOT call the distribution function
CREATE TRIGGER calculate_ot_before_insert_update
  BEFORE INSERT OR UPDATE ON ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_and_set_ot_amount();

-- Manually recalculate all existing OT requests WITHOUT using triggers
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