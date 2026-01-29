-- Replacement Holiday (Cuti Ganti) support

-- Extend malaysian_holidays with replacement + HR override metadata
ALTER TABLE public.malaysian_holidays
  ADD COLUMN IF NOT EXISTS is_replacement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_holiday_id uuid,
  ADD COLUMN IF NOT EXISTS hr_override_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hr_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS hr_override_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'malaysian_holidays_original_holiday_id_fkey'
  ) THEN
    ALTER TABLE public.malaysian_holidays
      ADD CONSTRAINT malaysian_holidays_original_holiday_id_fkey
      FOREIGN KEY (original_holiday_id)
      REFERENCES public.malaysian_holidays(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- State weekend configuration (supports effective date changes)
CREATE TABLE IF NOT EXISTS public.state_weekend_config (
  state_code text NOT NULL,
  weekend_days int4[] NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (state_code, effective_from),
  CONSTRAINT weekend_days_range CHECK (
    array_length(weekend_days, 1) IS NOT NULL
    AND array_length(weekend_days, 1) > 0
    -- CHECK constraints cannot use subqueries in Postgres.
    -- Ensure every element is a valid day-of-week (0=Sun..6=Sat).
    AND weekend_days <@ ARRAY[0,1,2,3,4,5,6]::int4[]
  )
);

ALTER TABLE public.state_weekend_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "state_weekend_config_read_all_users" ON public.state_weekend_config;
CREATE POLICY "state_weekend_config_read_all_users"
  ON public.state_weekend_config
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "state_weekend_config_write_hr_admin" ON public.state_weekend_config;
CREATE POLICY "state_weekend_config_write_hr_admin"
  ON public.state_weekend_config
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Seed configuration
INSERT INTO public.state_weekend_config (state_code, weekend_days, effective_from)
VALUES
  ('ALL', ARRAY[6,0], '2000-01-01'),
  ('JHR', ARRAY[5,6], '2000-01-01'),
  ('JHR', ARRAY[6,0], '2025-01-01'),
  ('KDH', ARRAY[5,6], '2000-01-01'),
  ('KTN', ARRAY[5,6], '2000-01-01'),
  ('TRG', ARRAY[5,6], '2000-01-01')
ON CONFLICT (state_code, effective_from) DO NOTHING;

-- Weekend lookup (0=Sun ... 6=Sat)
CREATE OR REPLACE FUNCTION public.get_state_weekend_days(p_state_code text, p_date date)
RETURNS int4[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int4[];
BEGIN
  SELECT weekend_days
  INTO v_days
  FROM public.state_weekend_config
  WHERE state_code = p_state_code
    AND effective_from <= p_date
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_days IS NULL THEN
    SELECT weekend_days
    INTO v_days
    FROM public.state_weekend_config
    WHERE state_code = 'ALL'
      AND effective_from <= p_date
    ORDER BY effective_from DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_days, ARRAY[6,0]);
END;
$$;

-- Calculate replacement holiday rows for a given year
CREATE OR REPLACE FUNCTION public.calculate_replacement_holidays(p_year int4)
RETURNS TABLE (
  original_holiday_id uuid,
  replacement_date date,
  replacement_name text,
  replacement_state text,
  replacement_type text,
  replacement_source text,
  replacement_year int4
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h RECORD;
  v_weekend_days int4[];
  v_dow int4;
  v_repl_date date;
BEGIN
  FOR h IN
    SELECT id, date, name, state, type
    FROM public.malaysian_holidays
    WHERE year = p_year
      AND is_replacement = false
  LOOP
    v_weekend_days := public.get_state_weekend_days(h.state, h.date);
    v_dow := EXTRACT(DOW FROM h.date)::int4;

    IF v_dow = ANY(v_weekend_days) THEN
      v_repl_date := (h.date + 1);

      WHILE EXTRACT(DOW FROM v_repl_date)::int4 = ANY(public.get_state_weekend_days(h.state, v_repl_date)) LOOP
        v_repl_date := (v_repl_date + 1);
      END LOOP;

      -- If an in-lieu holiday (or other holiday) already exists on the replacement date,
      -- skip creating a duplicate calculated replacement.
      IF EXISTS (
        SELECT 1
        FROM public.malaysian_holidays mh
        WHERE mh.state = h.state
          AND mh.date = v_repl_date
          AND mh.is_replacement = false
      ) THEN
        CONTINUE;
      END IF;

      original_holiday_id := h.id;
      replacement_date := v_repl_date;
      replacement_name := h.name || ' (Cuti Ganti)';
      replacement_state := h.state;
      replacement_type := h.type;
      replacement_source := 'calculated_replacement';
      replacement_year := EXTRACT(YEAR FROM v_repl_date)::int4;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Insert replacement holidays (idempotent)
CREATE OR REPLACE FUNCTION public.insert_replacement_holidays(p_year int4)
RETURNS int4
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int4;
BEGIN
  INSERT INTO public.malaysian_holidays (
    date,
    name,
    state,
    type,
    source,
    year,
    scraped_at,
    is_replacement,
    original_holiday_id
  )
  SELECT
    replacement_date,
    replacement_name,
    replacement_state,
    replacement_type,
    replacement_source,
    replacement_year,
    now(),
    true,
    original_holiday_id
  FROM public.calculate_replacement_holidays(p_year)
  ON CONFLICT (state, date, year, name) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN COALESCE(v_inserted, 0);
END;
$$;

-- HR override helper for replacement holidays
CREATE OR REPLACE FUNCTION public.hr_override_replacement_holiday(
  p_holiday_id uuid,
  p_action text,
  p_reason text
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

  IF p_action = 'approve' THEN
    UPDATE public.malaysian_holidays
    SET
      hr_override_by = auth.uid(),
      hr_override_at = now(),
      hr_override_reason = p_reason
    WHERE id = p_holiday_id
      AND is_replacement = true;
    RETURN;
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM public.malaysian_holidays
    WHERE id = p_holiday_id
      AND is_replacement = true;
    RETURN;
  END IF;

  RAISE EXCEPTION 'unsupported action: %', p_action;
END;
$$;

-- HR modify helper (update date/name for replacement holiday)
CREATE OR REPLACE FUNCTION public.hr_modify_replacement_holiday(
  p_holiday_id uuid,
  p_new_date date,
  p_new_name text,
  p_reason text
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
    date = COALESCE(p_new_date, date),
    name = COALESCE(NULLIF(p_new_name, ''), name),
    hr_override_by = auth.uid(),
    hr_override_at = now(),
    hr_override_reason = p_reason
  WHERE id = p_holiday_id
    AND is_replacement = true;
END;
$$;
