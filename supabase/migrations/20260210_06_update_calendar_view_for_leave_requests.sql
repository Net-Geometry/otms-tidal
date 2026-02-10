-- Leave Management: link leave_requests to employee_leave + update calendar view leave labels

-- 1) Add link column for safe sync
ALTER TABLE public.employee_leave
  ADD COLUMN IF NOT EXISTS leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE CASCADE;

-- Ensure we can store all leave type codes
ALTER TABLE public.employee_leave
  DROP CONSTRAINT IF EXISTS employee_leave_leave_type_check;

ALTER TABLE public.employee_leave
  ADD CONSTRAINT employee_leave_leave_type_check
  CHECK (leave_type IN (
    'annual',
    'sick',
    'medical',
    'marriage',
    'maternity',
    'paternity',
    'replacement',
    'unpaid',
    'compassionate',
    'half_day',
    'emergency',
    'other'
  ));

-- Unique rows per request per day (idempotent inserts)
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_request_day_unique
  ON public.employee_leave (leave_request_id, leave_date)
  WHERE leave_request_id IS NOT NULL;

-- 2) Trigger: sync employee_leave rows when leave_request reaches final approval
CREATE OR REPLACE FUNCTION public.sync_employee_leave_from_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave_code text;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Delete rows when leaving final approval
  IF OLD.status = 'management_approved' AND NEW.status IS DISTINCT FROM 'management_approved' THEN
    DELETE FROM public.employee_leave
    WHERE leave_request_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Insert rows when reaching final approval
  IF NEW.status = 'management_approved' AND OLD.status IS DISTINCT FROM 'management_approved' THEN
    SELECT lt.code INTO v_leave_code
    FROM public.leave_types lt
    WHERE lt.id = NEW.leave_type_id;

    -- Idempotency
    DELETE FROM public.employee_leave
    WHERE leave_request_id = NEW.id;

    INSERT INTO public.employee_leave (
      employee_id,
      leave_date,
      leave_type,
      status,
      notes,
      created_by,
      leave_request_id
    )
    SELECT
      NEW.employee_id,
      gs::date AS leave_date,
      COALESCE(v_leave_code, 'other') AS leave_type,
      'approved' AS status,
      NEW.reason AS notes,
      NEW.employee_id AS created_by,
      NEW.id AS leave_request_id
    FROM generate_series(NEW.start_date, NEW.end_date, interval '1 day') gs
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_leave_from_leave_request ON public.leave_requests;
CREATE TRIGGER trg_sync_employee_leave_from_leave_request
  AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_employee_leave_from_leave_request();

-- 3) Update unified calendar events view to label leave via leave_types
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

  -- Personal leave (employee_leave) with labels from leave_types
  SELECT
    el.id,
    NULL::uuid AS calendar_id,
    el.leave_date AS holiday_date,
    COALESCE(lt.name, 'Leave') AS description,
    NULL::text AS state_code,
    'leave'::text AS event_source,
    true AS is_personal_leave,
    false AS is_replacement,
    NULL::text AS holiday_type,
    el.leave_type AS leave_type,
    el.status AS leave_status,
    false AS is_hr_modified
  FROM public.employee_leave el
  LEFT JOIN public.leave_types lt
    ON lt.code = el.leave_type
  WHERE el.employee_id = auth.uid()

  UNION ALL

  -- Safety net: approved leave_requests that are not yet synced into employee_leave
  SELECT
    (
      substr(md5(lr.id::text || ':' || gs::text), 1, 8) || '-' ||
      substr(md5(lr.id::text || ':' || gs::text), 9, 4) || '-' ||
      substr(md5(lr.id::text || ':' || gs::text), 13, 4) || '-' ||
      substr(md5(lr.id::text || ':' || gs::text), 17, 4) || '-' ||
      substr(md5(lr.id::text || ':' || gs::text), 21, 12)
    )::uuid AS id,
    NULL::uuid AS calendar_id,
    gs::date AS holiday_date,
    COALESCE(lt.name, 'Leave') AS description,
    NULL::text AS state_code,
    'leave'::text AS event_source,
    true AS is_personal_leave,
    false AS is_replacement,
    NULL::text AS holiday_type,
    lt.code AS leave_type,
    lr.status::text AS leave_status,
    false AS is_hr_modified
  FROM public.leave_requests lr
  JOIN public.leave_types lt
    ON lt.id = lr.leave_type_id
  JOIN LATERAL generate_series(lr.start_date, lr.end_date, interval '1 day') gs ON true
  WHERE lr.employee_id = auth.uid()
    AND lr.status = 'management_approved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.employee_leave el2
      WHERE el2.leave_request_id = lr.id
        AND el2.leave_date = gs::date
    );
