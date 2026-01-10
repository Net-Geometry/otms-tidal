-- Migration: Add OT location state to OT requests
-- Allows OT day type (holiday detection) to be based on the OT work location, not only the employee's profile state.
-- Date: 2026-01-09

-- 1) Add column to store the OT location state code (e.g., JHR, WPKL, SGR)
ALTER TABLE public.ot_requests
ADD COLUMN IF NOT EXISTS ot_location_state text;

COMMENT ON COLUMN public.ot_requests.ot_location_state IS
  'Malaysian state code where the OT was performed (e.g., JHR). Used for state holiday detection.';

-- Ensure employee-aware holiday detection function exists before any triggers fire
-- (Some installations may have calculate_daily_ot_distribution already calling this function.)
CREATE OR REPLACE FUNCTION public.determine_day_type_for_employee(
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
  dow int;
  effective_state text;
  location_state text;
  profile_state text;
  is_holiday boolean;
BEGIN
  dow := EXTRACT(DOW FROM p_ot_date);

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
  SELECT state INTO profile_state
  FROM public.profiles
  WHERE id = p_employee_id;

  effective_state := COALESCE(location_state, profile_state);

  -- 1) Holiday overrides (company-specific)
  SELECT EXISTS(
    SELECT 1 FROM public.holiday_overrides
    WHERE date = p_ot_date
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;

  -- 2) Malaysian holidays (federal or effective state)
  SELECT EXISTS(
    SELECT 1 FROM public.malaysian_holidays
    WHERE date = p_ot_date
      AND (state = 'ALL' OR (effective_state IS NOT NULL AND state = effective_state))
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN 'public_holiday';
  END IF;

  -- 3) Legacy public holidays (backward compatibility)
  SELECT EXISTS(
    SELECT 1 FROM public.public_holidays
    WHERE holiday_date = p_ot_date
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

-- 2) Backfill existing records from employee profile state
UPDATE public.ot_requests ot
SET ot_location_state = p.state
FROM public.profiles p
WHERE p.id = ot.employee_id
  AND ot.ot_location_state IS NULL;

-- 3) Helpful index for per-employee/day grouping & validation
CREATE INDEX IF NOT EXISTS idx_ot_requests_employee_date_location_state
  ON public.ot_requests (employee_id, ot_date, ot_location_state);
