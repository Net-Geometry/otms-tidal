-- Security: Only admins can update employee_id column
-- Using a trigger to enforce this rule since RLS policies cannot reference OLD values

-- Create a function to validate employee_id updates
CREATE OR REPLACE FUNCTION validate_employee_id_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If employee_id is being changed
  IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    -- Check if the user has admin role
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can change employee IDs';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate employee_id changes
DROP TRIGGER IF EXISTS enforce_employee_id_admin_only ON profiles;
CREATE TRIGGER enforce_employee_id_admin_only
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_employee_id_update();