-- Migration: Data correction for state holiday rate calculation bug
-- Fixes OT records where employees worked on state holidays but got weekday rates
-- Focus on December 11, 2025 Selangor and other affected state holiday records
-- Date: 2025-12-19

-- Create audit table to track all corrections made
CREATE TABLE IF NOT EXISTS public.ot_rate_corrections_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ot_request_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  employee_state TEXT,
  ot_date DATE NOT NULL,
  holiday_name TEXT,
  old_day_type day_type NOT NULL,
  new_day_type day_type NOT NULL,
  old_amount NUMERIC(10,2) NOT NULL,
  new_amount NUMERIC(10,2) NOT NULL,
  underpayment_amount NUMERIC(10,2) NOT NULL,
  corrected_at TIMESTAMPTZ DEFAULT NOW(),
  corrected_by UUID,
  correction_reason TEXT DEFAULT 'State holiday detection bug fix - Dec 2025'
);

-- Add comment
COMMENT ON TABLE public.ot_rate_corrections_audit IS 
'Audit trail for OT rate corrections due to state holiday detection bug. 
Tracks all changes made to ensure transparency and compliance.';

-- Enable RLS
ALTER TABLE public.ot_rate_corrections_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only HR and management can view corrections
CREATE POLICY "HR and management can view rate corrections"
ON public.ot_rate_corrections_audit
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('hr', 'management')
  )
);

-- Function to perform the data correction with full audit trail
CREATE OR REPLACE FUNCTION public.correct_state_holiday_ot_rates(
  p_corrected_by UUID DEFAULT NULL
)
RETURNS TABLE(
  corrected_count INTEGER,
  total_underpayment NUMERIC,
  affected_employees INTEGER,
  correction_summary JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  correction_record RECORD;
  corrected_count INTEGER := 0;
  total_underpayment NUMERIC := 0;
  affected_employees INTEGER := 0;
  correction_summary JSONB := '{}';
  temp_summary JSONB;
BEGIN
  -- Create temporary table for batch processing
  CREATE TEMP TABLE temp_corrections AS
  SELECT * FROM public.find_affected_ot_records();
  
  -- Get summary statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(underpayment_amount), 0),
    COUNT(DISTINCT employee_id),
    jsonb_object_agg(employee_state, state_count)
  INTO 
    corrected_count,
    total_underpayment, 
    affected_employees,
    correction_summary
  FROM (
    SELECT 
      employee_state,
      COUNT(*) as state_count
    FROM temp_corrections 
    GROUP BY employee_state
  ) state_summary;
  
  -- Process each correction
  FOR correction_record IN SELECT * FROM temp_corrections LOOP
    -- Insert audit record BEFORE making changes
    INSERT INTO public.ot_rate_corrections_audit (
      ot_request_id,
      employee_id,
      employee_name,
      employee_state,
      ot_date,
      holiday_name,
      old_day_type,
      new_day_type,
      old_amount,
      new_amount,
      underpayment_amount,
      corrected_by
    ) VALUES (
      correction_record.ot_request_id,
      correction_record.employee_id,
      correction_record.employee_name,
      correction_record.employee_state,
      correction_record.ot_date,
      correction_record.holiday_name,
      correction_record.current_day_type,
      correction_record.correct_day_type,
      correction_record.current_amount,
      correction_record.correct_amount,
      correction_record.underpayment_amount,
      p_corrected_by
    );
    
    -- Update the OT request record
    UPDATE public.ot_requests
    SET 
      day_type = correction_record.correct_day_type,
      total_ot_amount = correction_record.correct_amount,
      updated_at = NOW(),
      -- Add correction note to internal notes if field exists
      internal_notes = COALESCE(internal_notes, '') || 
        E'\n[' || NOW() || '] Rate corrected due to state holiday detection bug. ' ||
        'Changed from ' || correction_record.current_day_type || ' (' || correction_record.current_amount || ') ' ||
        'to ' || correction_record.correct_day_type || ' (' || correction_record.correct_amount || '). ' ||
        'Holiday: ' || COALESCE(correction_record.holiday_name, 'N/A')
    WHERE id = correction_record.ot_request_id;
  END LOOP;
  
  -- Drop temp table
  DROP TABLE temp_corrections;
  
  -- Return summary
  RETURN QUERY
  SELECT 
    corrected_count,
    total_underpayment,
    affected_employees,
    correction_summary;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.correct_state_holiday_ot_rates(UUID) IS 
'Corrects all OT records affected by state holiday detection bug with full audit trail.
Returns summary statistics of corrections made.';

-- Function to preview corrections without making changes
CREATE OR REPLACE FUNCTION public.preview_state_holiday_corrections()
RETURNS TABLE(
  correction_count INTEGER,
  total_underpayment NUMERIC,
  affected_employees INTEGER,
  by_state JSONB,
  by_month JSONB,
  sample_records JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  correction_count INTEGER;
  total_underpayment NUMERIC;
  affected_employees INTEGER;
  by_state JSONB;
  by_month JSONB;
  sample_records JSONB;
BEGIN
  -- Get affected records
  WITH affected AS (
    SELECT * FROM public.find_affected_ot_records()
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(underpayment_amount), 0) as total_under,
      COUNT(DISTINCT employee_id) as emp_count
    FROM affected
  ),
  state_breakdown AS (
    SELECT 
      jsonb_object_agg(
        employee_state, 
        jsonb_build_object(
          'count', count,
          'underpayment', underpayment
        )
      ) as state_summary
    FROM (
      SELECT 
        employee_state,
        COUNT(*) as count,
        SUM(underpayment_amount) as underpayment
      FROM affected 
      GROUP BY employee_state
    ) s
  ),
  month_breakdown AS (
    SELECT 
      jsonb_object_agg(
        month_year,
        jsonb_build_object(
          'count', count,
          'underpayment', underpayment
        )
      ) as month_summary
    FROM (
      SELECT 
        TO_CHAR(ot_date, 'YYYY-MM') as month_year,
        COUNT(*) as count,
        SUM(underpayment_amount) as underpayment
      FROM affected 
      GROUP BY TO_CHAR(ot_date, 'YYYY-MM')
    ) m
  ),
  sample_data AS (
    SELECT 
      jsonb_agg(
        jsonb_build_object(
          'employee_name', employee_name,
          'state', employee_state,
          'date', ot_date,
          'holiday', holiday_name,
          'current_type', current_day_type,
          'correct_type', correct_day_type,
          'underpayment', underpayment_amount
        )
      ) as samples
    FROM (
      SELECT * FROM affected ORDER BY underpayment_amount DESC LIMIT 5
    ) s
  )
  SELECT 
    ss.total_count,
    ss.total_under,
    ss.emp_count,
    sb.state_summary,
    mb.month_summary,
    sd.samples
  INTO 
    correction_count,
    total_underpayment,
    affected_employees,
    by_state,
    by_month,
    sample_records
  FROM summary_stats ss, state_breakdown sb, month_breakdown mb, sample_data sd;
  
  -- Return results
  RETURN QUERY
  SELECT 
    correction_count,
    total_underpayment,
    affected_employees,
    by_state,
    by_month,
    sample_records;
END;
$$;

-- Add comment  
COMMENT ON FUNCTION public.preview_state_holiday_corrections() IS 
'Previews corrections without making changes. Shows impact summary and sample affected records.';

-- Create index for faster audit queries
CREATE INDEX IF NOT EXISTS idx_ot_rate_corrections_audit_date 
ON public.ot_rate_corrections_audit(ot_date);

CREATE INDEX IF NOT EXISTS idx_ot_rate_corrections_audit_employee 
ON public.ot_rate_corrections_audit(employee_id);

-- Insert December 11, 2025 Selangor holiday if not already present
INSERT INTO public.malaysian_holidays (
  date,
  name,
  state,
  type,
  source,
  year
) VALUES (
  '2025-12-11',
  'Birthday of the Sultan of Selangor',
  'SGR',
  'state',
  'Manual fix - state holiday detection bug',
  2025
)
ON CONFLICT (state, date, year, name) DO NOTHING;