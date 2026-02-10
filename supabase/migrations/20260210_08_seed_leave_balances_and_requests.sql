-- Seed leave_balances for all active employees for 2026
-- Uses leave_types.default_days as entitled_days

INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled_days, used_days, carried_forward, adjustment)
SELECT
  p.id AS employee_id,
  lt.id AS leave_type_id,
  2026 AS year,
  lt.default_days AS entitled_days,
  0 AS used_days,
  0 AS carried_forward,
  0 AS adjustment
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE p.status = 'active'
  AND lt.is_active = true
  AND lt.default_days > 0
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Sample leave requests at various workflow stages

-- 1. Hugh (EMP-001) — Annual Leave, pending_supervisor (David)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id
) VALUES (
  'LV-20260210-0001',
  '11776acb-080b-45c1-9dfe-70310d95f930',
  'b9e6d30b-56ec-4fcd-95b9-22c7e3ac2262',
  '2026-02-17', '2026-02-19', false, 3,
  'Family trip planned',
  'pending_supervisor',
  'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 2. Hannah (EMP-002) — Sick Leave, supervisor_approved (waiting HR)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id, supervisor_approved_at, supervisor_remarks
) VALUES (
  'LV-20260210-0002',
  'a1cd9cb8-3d01-4954-b77a-d0a54558248e',
  'd3c307a3-d36c-4a66-9926-b809c5cab985',
  '2026-02-12', '2026-02-13', false, 2,
  'Feeling unwell, visiting clinic',
  'supervisor_approved',
  'd9998cd5-d337-410a-965d-7291ddafefe8',
  '2026-02-11T09:00:00Z',
  'Approved. Get well soon.'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 3. Trump (EMP-003) — Annual Leave, hr_approved (waiting management)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id, supervisor_approved_at, supervisor_remarks,
  hr_id, hr_approved_at, hr_remarks
) VALUES (
  'LV-20260210-0003',
  'ea6188bd-dfe2-48dd-886c-b88fbe69afa2',
  'b9e6d30b-56ec-4fcd-95b9-22c7e3ac2262',
  '2026-03-02', '2026-03-06', false, 5,
  'Annual vacation',
  'hr_approved',
  'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',
  '2026-02-09T10:00:00Z',
  'OK',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5',
  '2026-02-09T14:00:00Z',
  'Checked balance - sufficient.'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 4. Hugh (EMP-001) — Compassionate Leave, management_approved (fully done)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id, supervisor_approved_at, supervisor_remarks,
  hr_id, hr_approved_at, hr_remarks,
  management_id, management_approved_at, management_remarks
) VALUES (
  'LV-20260210-0004',
  '11776acb-080b-45c1-9dfe-70310d95f930',
  'e9abfdb7-e308-4bc1-8feb-4ebbc9805052',
  '2026-01-20', '2026-01-21', false, 2,
  'Bereavement',
  'management_approved',
  'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',
  '2026-01-19T08:00:00Z',
  'Sympathies',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5',
  '2026-01-19T10:00:00Z',
  'Approved',
  'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9',
  '2026-01-19T11:00:00Z',
  'Condolences.'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 5. Hannah (EMP-002) — Annual Leave, rejected by supervisor
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id,
  rejected_by, rejected_at, rejection_remarks, rejection_stage
) VALUES (
  'LV-20260210-0005',
  'a1cd9cb8-3d01-4954-b77a-d0a54558248e',
  'b9e6d30b-56ec-4fcd-95b9-22c7e3ac2262',
  '2026-02-24', '2026-02-28', false, 5,
  'Holiday plans',
  'rejected',
  'd9998cd5-d337-410a-965d-7291ddafefe8',
  'd9998cd5-d337-410a-965d-7291ddafefe8',
  '2026-02-08T11:00:00Z',
  'Project deadline that week, please reschedule.',
  'supervisor'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 6. David (SV-001) — no supervisor, pending_hr (skip supervisor step)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, half_day_period, total_days,
  reason, status
) VALUES (
  'LV-20260210-0006',
  'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',
  'b9e6d30b-56ec-4fcd-95b9-22c7e3ac2262',
  '2026-02-20', '2026-02-20', true, 'morning', 0.5,
  'Personal appointment',
  'pending_hr'
) ON CONFLICT (ticket_number) DO NOTHING;

-- 7. Scott (SV-002) — Annual Leave, pending_supervisor (supervisor = Jack HR-001)
INSERT INTO public.leave_requests (
  ticket_number, employee_id, leave_type_id,
  start_date, end_date, is_half_day, total_days,
  reason, status, supervisor_id
) VALUES (
  'LV-20260210-0007',
  'd9998cd5-d337-410a-965d-7291ddafefe8',
  'b9e6d30b-56ec-4fcd-95b9-22c7e3ac2262',
  '2026-03-10', '2026-03-12', false, 3,
  'Short break',
  'pending_supervisor',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5'
) ON CONFLICT (ticket_number) DO NOTHING;

-- Update used_days for the management_approved request (#4 Hugh compassionate)
UPDATE public.leave_balances
SET used_days = 2
WHERE employee_id = '11776acb-080b-45c1-9dfe-70310d95f930'
  AND leave_type_id = 'e9abfdb7-e308-4bc1-8feb-4ebbc9805052'
  AND year = 2026
  AND used_days = 0;
