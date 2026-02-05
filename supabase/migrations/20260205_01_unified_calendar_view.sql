-- Unified calendar view (Google Calendar-like)
--
-- Replaces the multi-calendar-per-year/state architecture with a single
-- employee_calendar_events view backed by:
-- - malaysian_holidays (scraped, with HR override columns)
-- - holiday_overrides (HR-added company holidays)
-- - employee_leave (personal leave, scoped to auth.uid() in the view)

-- 1) Extend malaysian_holidays with HR override columns
ALTER TABLE public.malaysian_holidays
  ADD COLUMN IF NOT EXISTS hr_name_override text,
  ADD COLUMN IF NOT EXISTS hr_date_override date,
  ADD COLUMN IF NOT EXISTS hr_state_override text,
  ADD COLUMN IF NOT EXISTS hr_type_override text,
  ADD COLUMN IF NOT EXISTS hr_is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hr_modified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hr_modified_at timestamptz;

-- 2) Allow multiple holiday_overrides on the same date (per company)
ALTER TABLE public.holiday_overrides
  DROP CONSTRAINT IF EXISTS unique_company_date;

CREATE UNIQUE INDEX IF NOT EXISTS holiday_overrides_unique_idx
  ON public.holiday_overrides(company_id, date, name);

-- 3) Update holiday_overrides RLS:
--    - everyone authenticated can read (so employees can see company holidays)
--    - only HR/admin can write
DROP POLICY IF EXISTS "Users can view own company holiday overrides" ON public.holiday_overrides;
DROP POLICY IF EXISTS "Users can create own company holiday overrides" ON public.holiday_overrides;
DROP POLICY IF EXISTS "Users can update own company holiday overrides" ON public.holiday_overrides;
DROP POLICY IF EXISTS "Users can delete own company holiday overrides" ON public.holiday_overrides;

DROP POLICY IF EXISTS "holiday_overrides_read_all" ON public.holiday_overrides;
CREATE POLICY "holiday_overrides_read_all"
  ON public.holiday_overrides
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "holiday_overrides_write_hr_admin" ON public.holiday_overrides;
CREATE POLICY "holiday_overrides_write_hr_admin"
  ON public.holiday_overrides
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 4) HR helpers for editing scraped holidays via override columns
CREATE OR REPLACE FUNCTION public.hr_modify_malaysian_holiday(
  p_holiday_id uuid,
  p_new_date date,
  p_new_name text,
  p_new_state text,
  p_new_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_new_type IS NOT NULL AND p_new_type NOT IN ('federal', 'state', 'religious') THEN
    RAISE EXCEPTION 'invalid holiday type: %', p_new_type;
  END IF;

  UPDATE public.malaysian_holidays
  SET
    hr_date_override = COALESCE(p_new_date, hr_date_override),
    hr_name_override = COALESCE(NULLIF(p_new_name, ''), hr_name_override),
    hr_state_override = COALESCE(NULLIF(p_new_state, ''), hr_state_override),
    hr_type_override = COALESCE(NULLIF(p_new_type, ''), hr_type_override),
    hr_modified_by = auth.uid(),
    hr_modified_at = now()
  WHERE id = p_holiday_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_delete_malaysian_holiday(
  p_holiday_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.malaysian_holidays
  SET
    hr_is_deleted = true,
    hr_modified_by = auth.uid(),
    hr_modified_at = now()
  WHERE id = p_holiday_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hr_modify_malaysian_holiday(uuid, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_delete_malaysian_holiday(uuid) TO authenticated;

-- 5) Unified calendar events view
--    Notes:
--    - includes current year + next year holidays (scraped + company)
--    - personal leave rows are scoped to auth.uid()
-- Drop and recreate to handle column changes (can't change column names with CREATE OR REPLACE)
DROP VIEW IF EXISTS public.employee_calendar_events;
CREATE VIEW public.employee_calendar_events AS
  -- Scraped Malaysian holidays (with HR override support)
  SELECT
    mh.id,
    NULL::uuid AS calendar_id,
    COALESCE(mh.hr_date_override, mh.date) AS holiday_date,
    COALESCE(mh.hr_name_override, mh.name) AS description,
    COALESCE(mh.hr_state_override, mh.state) AS state_code,
    'holiday'::text AS event_source,
    false AS is_personal_leave,
    COALESCE(mh.is_replacement, false) AS is_replacement,
    COALESCE(mh.hr_type_override, mh.type) AS holiday_type,
    NULL::text AS leave_type,
    NULL::text AS leave_status,
    (mh.hr_modified_by IS NOT NULL) AS is_hr_modified
  FROM public.malaysian_holidays mh
  WHERE NOT COALESCE(mh.hr_is_deleted, false)
    AND mh.year IN (
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)
    )

  UNION ALL

  -- HR-added company holidays (holiday_overrides)
  SELECT
    ho.id,
    NULL::uuid AS calendar_id,
    ho.date AS holiday_date,
    ho.name AS description,
    'ALL'::text AS state_code,
    'company'::text AS event_source,
    false AS is_personal_leave,
    false AS is_replacement,
    ho.type AS holiday_type,
    NULL::text AS leave_type,
    NULL::text AS leave_status,
    true AS is_hr_modified
  FROM public.holiday_overrides ho
  WHERE ho.date >= date_trunc('year', CURRENT_DATE)::date
    AND ho.date < (date_trunc('year', CURRENT_DATE)::date + interval '2 years')::date

  UNION ALL

  -- Personal leave (unchanged)
  SELECT
    el.id,
    NULL::uuid AS calendar_id,
    el.leave_date AS holiday_date,
    CASE
      WHEN el.leave_type = 'annual' THEN 'Annual Leave'
      WHEN el.leave_type = 'medical' THEN 'Medical Leave'
      WHEN el.leave_type = 'emergency' THEN 'Emergency Leave'
      WHEN el.leave_type = 'unpaid' THEN 'Unpaid Leave'
      WHEN el.leave_type = 'maternity' THEN 'Maternity Leave'
      WHEN el.leave_type = 'paternity' THEN 'Paternity Leave'
      ELSE 'Leave'
    END AS description,
    NULL::text AS state_code,
    'leave'::text AS event_source,
    true AS is_personal_leave,
    false AS is_replacement,
    NULL::text AS holiday_type,
    el.leave_type AS leave_type,
    el.status AS leave_status,
    false AS is_hr_modified
  FROM public.employee_leave el
  WHERE el.employee_id = auth.uid();
