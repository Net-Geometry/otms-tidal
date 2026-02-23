-- Function to bulk import historical OT records from CSV data
-- Records are imported as 'management_approved' with ticket prefix 'OT-LEGACY-'

CREATE OR REPLACE FUNCTION bulk_import_ot_records(
  p_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record jsonb;
  v_employee_uuid uuid;
  v_supervisor_uuid uuid;
  v_ticket_number text;
  v_seq int := 0;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_total int;
BEGIN
  -- Get the starting sequence number based on existing legacy records
  SELECT COALESCE(
    MAX(CAST(REPLACE(ticket_number, 'OT-LEGACY-', '') AS int)),
    0
  ) INTO v_seq
  FROM ot_requests
  WHERE ticket_number LIKE 'OT-LEGACY-%';

  v_total := jsonb_array_length(p_records);

  FOR i IN 0..v_total - 1 LOOP
    v_record := p_records->i;

    -- Look up employee UUID from employee_id
    SELECT id, supervisor_id
    INTO v_employee_uuid, v_supervisor_uuid
    FROM profiles
    WHERE employee_id = (v_record->>'employee_id')
    LIMIT 1;

    -- Skip if employee not found
    IF v_employee_uuid IS NULL THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', i + 1,
        'employee_id', v_record->>'employee_id',
        'error', 'Employee not found in system'
      );
      CONTINUE;
    END IF;

    -- Generate legacy ticket number
    v_seq := v_seq + 1;
    v_ticket_number := 'OT-LEGACY-' || LPAD(v_seq::text, 4, '0');

    -- Insert the OT record
    INSERT INTO ot_requests (
      employee_id,
      ot_date,
      start_time,
      end_time,
      total_hours,
      day_type,
      reason,
      ot_amount,
      ot_location_state,
      ticket_number,
      status,
      supervisor_id,
      attachment_urls,
      resubmission_count,
      is_resubmission,
      created_at,
      updated_at
    ) VALUES (
      v_employee_uuid,
      (v_record->>'ot_date')::date,
      (v_record->>'start_time')::time,
      (v_record->>'end_time')::time,
      (v_record->>'total_hours')::numeric,
      (v_record->>'day_type')::day_type,
      COALESCE(v_record->>'reason', 'Historical OT record'),
      NULLIF(v_record->>'ot_amount', '')::numeric,
      NULLIF(v_record->>'ot_location_state', ''),
      v_ticket_number,
      'management_approved',
      v_supervisor_uuid,
      ARRAY[]::text[],
      0,
      false,
      COALESCE((v_record->>'ot_date')::timestamp, now()),
      now()
    );

    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'imported', v_imported,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

-- Grant execute permission to authenticated users (admin will call this)
GRANT EXECUTE ON FUNCTION bulk_import_ot_records(jsonb) TO authenticated;
