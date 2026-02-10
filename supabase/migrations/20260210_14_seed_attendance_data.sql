-- Seed attendance data for demo/testing (Jan-Feb 2026)

-- Assign Regular Shift to test employees
WITH reg_shift AS (
  SELECT id AS shift_id FROM public.shifts WHERE code = 'REG' LIMIT 1
)
INSERT INTO public.employee_shifts (employee_id, shift_id, effective_date, is_current, allow_multiple_clockin)
SELECT
  e.employee_id,
  rs.shift_id,
  '2026-01-01'::date,
  true,
  false
FROM reg_shift rs
CROSS JOIN (
  VALUES
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid), -- Hugh
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid), -- Hannah
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid), -- Trump
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid), -- David
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid), -- Scott
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid)  -- Jack
) AS e(employee_id)
ON CONFLICT (employee_id, shift_id, effective_date) DO NOTHING;

-- Create an import batch record
INSERT INTO public.attendance_imports (
  id,
  uploaded_by,
  filename,
  file_size_bytes,
  record_count,
  success_count,
  error_count,
  date_range_start,
  date_range_end,
  status,
  error_log
)
VALUES (
  '8e7c1f44-3f9d-4b36-9c28-647ddf7cb1d8',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5',
  'seed-attendance-jan-feb-2026.csv',
  12345,
  42,
  42,
  0,
  '2026-01-05',
  '2026-02-10',
  'completed',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Seed attendance records (times in MYT +08:00)
WITH reg_shift AS (
  SELECT id AS shift_id FROM public.shifts WHERE code = 'REG' LIMIT 1
)
INSERT INTO public.attendance_records (
  employee_id,
  date,
  clock_in,
  clock_out,
  shift_id,
  status,
  source,
  import_id,
  created_by
)
SELECT
  r.employee_id,
  r.work_date,
  r.clock_in,
  r.clock_out,
  rs.shift_id,
  r.status,
  'import',
  '8e7c1f44-3f9d-4b36-9c28-647ddf7cb1d8'::uuid,
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid
FROM reg_shift rs
JOIN (
  VALUES
    -- Hugh (EMP-001)
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-01-05'::date, '2026-01-05 08:41:00+08'::timestamptz, '2026-01-05 17:36:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-01-06'::date, '2026-01-06 08:56:00+08'::timestamptz, '2026-01-06 17:20:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-01-07'::date, NULL::timestamptz, NULL::timestamptz, 'absent'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-01-08'::date, '2026-01-08 08:33:00+08'::timestamptz, '2026-01-08 17:45:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-01-09'::date, '2026-01-09 08:52:00+08'::timestamptz, '2026-01-09 17:10:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-02-09'::date, '2026-02-09 08:48:00+08'::timestamptz, '2026-02-09 17:31:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('11776acb-080b-45c1-9dfe-70310d95f930'::uuid, '2026-02-10'::date, '2026-02-10 09:05:00+08'::timestamptz, '2026-02-10 17:22:00+08'::timestamptz, 'present'::public.attendance_record_status),

    -- Hannah (EMP-002)
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-01-05'::date, '2026-01-05 08:29:00+08'::timestamptz, '2026-01-05 17:34:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-01-06'::date, '2026-01-06 08:45:00+08'::timestamptz, '2026-01-06 17:40:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-01-07'::date, '2026-01-07 08:51:00+08'::timestamptz, '2026-01-07 17:18:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-01-08'::date, '2026-01-08 08:39:00+08'::timestamptz, '2026-01-08 17:26:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-01-09'::date, NULL::timestamptz, NULL::timestamptz, 'absent'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-02-09'::date, '2026-02-09 08:42:00+08'::timestamptz, '2026-02-09 17:33:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a1cd9cb8-3d01-4954-b77a-d0a54558248e'::uuid, '2026-02-10'::date, '2026-02-10 08:55:00+08'::timestamptz, '2026-02-10 17:15:00+08'::timestamptz, 'present'::public.attendance_record_status),

    -- Trump (EMP-003)
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-01-05'::date, '2026-01-05 08:47:00+08'::timestamptz, '2026-01-05 17:22:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-01-06'::date, '2026-01-06 08:53:00+08'::timestamptz, '2026-01-06 17:12:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-01-07'::date, '2026-01-07 08:35:00+08'::timestamptz, '2026-01-07 17:50:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-01-08'::date, NULL::timestamptz, NULL::timestamptz, 'absent'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-01-09'::date, '2026-01-09 08:44:00+08'::timestamptz, '2026-01-09 17:27:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-02-09'::date, '2026-02-09 09:12:00+08'::timestamptz, '2026-02-09 17:05:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('ea6188bd-dfe2-48dd-886c-b88fbe69afa2'::uuid, '2026-02-10'::date, '2026-02-10 08:49:00+08'::timestamptz, '2026-02-10 17:46:00+08'::timestamptz, 'present'::public.attendance_record_status),

    -- David (SV-001)
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-01-05'::date, '2026-01-05 08:30:00+08'::timestamptz, '2026-01-05 17:39:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-01-06'::date, '2026-01-06 08:58:00+08'::timestamptz, '2026-01-06 17:44:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-01-07'::date, '2026-01-07 08:46:00+08'::timestamptz, '2026-01-07 17:28:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-01-08'::date, '2026-01-08 08:54:00+08'::timestamptz, '2026-01-08 17:13:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-01-09'::date, '2026-01-09 08:32:00+08'::timestamptz, '2026-01-09 17:38:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-02-09'::date, '2026-02-09 08:43:00+08'::timestamptz, '2026-02-09 17:20:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'::uuid, '2026-02-10'::date, NULL::timestamptz, NULL::timestamptz, 'absent'::public.attendance_record_status),

    -- Scott (SV-002)
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-01-05'::date, '2026-01-05 08:50:00+08'::timestamptz, '2026-01-05 17:12:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-01-06'::date, '2026-01-06 08:34:00+08'::timestamptz, '2026-01-06 17:30:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-01-07'::date, '2026-01-07 09:03:00+08'::timestamptz, '2026-01-07 17:48:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-01-08'::date, '2026-01-08 08:37:00+08'::timestamptz, '2026-01-08 17:10:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-01-09'::date, NULL::timestamptz, NULL::timestamptz, 'absent'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-02-09'::date, '2026-02-09 08:31:00+08'::timestamptz, '2026-02-09 17:29:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('d9998cd5-d337-410a-965d-7291ddafefe8'::uuid, '2026-02-10'::date, '2026-02-10 08:52:00+08'::timestamptz, '2026-02-10 17:37:00+08'::timestamptz, 'present'::public.attendance_record_status),

    -- Jack (HR-001)
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-01-05'::date, '2026-01-05 08:44:00+08'::timestamptz, '2026-01-05 17:55:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-01-06'::date, '2026-01-06 08:49:00+08'::timestamptz, '2026-01-06 17:21:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-01-07'::date, '2026-01-07 08:57:00+08'::timestamptz, '2026-01-07 17:11:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-01-08'::date, '2026-01-08 08:40:00+08'::timestamptz, '2026-01-08 17:42:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-01-09'::date, '2026-01-09 08:46:00+08'::timestamptz, '2026-01-09 17:33:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-02-09'::date, '2026-02-09 08:57:00+08'::timestamptz, '2026-02-09 17:09:00+08'::timestamptz, 'present'::public.attendance_record_status),
    ('a5386595-4675-4d95-a3b7-2b749e4e3ab5'::uuid, '2026-02-10'::date, '2026-02-10 08:41:00+08'::timestamptz, '2026-02-10 17:25:00+08'::timestamptz, 'present'::public.attendance_record_status)
) AS r(employee_id, work_date, clock_in, clock_out, status)
  ON true
ON CONFLICT (employee_id, date) DO NOTHING;

-- Best-effort update import counts (in case seeds already existed)
UPDATE public.attendance_imports
SET record_count = 42,
    success_count = 42,
    error_count = 0,
    status = 'completed',
    updated_at = now()
WHERE id = '8e7c1f44-3f9d-4b36-9c28-647ddf7cb1d8'::uuid;
