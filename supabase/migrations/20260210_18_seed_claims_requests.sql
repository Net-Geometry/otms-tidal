-- Seed sample claims at various workflow stages
-- This seed is best-effort: if required profiles/claim_types are missing, inserts become no-ops.

-- Helper CTE pattern used below:
-- - Pick a few known demo employees by employee_id if present (EMP-001/002/003)
-- - Resolve claim_type_id by claim_types.code (stable)
-- - Resolve HR/Finance approver ids from user_roles if present (fallback to any active profile)

-- 1) EMP-001 — Stationery, pending_supervisor
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-001' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'stationery' LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  receipt_urls,
  status,
  supervisor_id
)
SELECT
  'CL-20260210-0001',
  emp.id,
  ct.id,
  '2026-02-10'::date,
  18.50,
  'Office stationery purchase',
  ARRAY[]::text[],
  'pending_supervisor'::public.claim_request_status,
  emp.supervisor_id
FROM emp, ct
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 2) EMP-002 — Food/Refreshment, supervisor_approved (soft limit exceeded)
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-002' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'food_refreshment' LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  receipt_urls,
  limit_warning,
  status,
  supervisor_id,
  supervisor_approved_at,
  supervisor_remarks
)
SELECT
  'CL-20260210-0002',
  emp.id,
  ct.id,
  '2026-02-09'::date,
  35.00,
  'Team refreshment during late work',
  ARRAY[]::text[],
  'Soft limit: RM20.00/day. Submitted RM35.00 exceeds limit.',
  'supervisor_approved'::public.claim_request_status,
  emp.supervisor_id,
  '2026-02-10T02:00:00Z'::timestamptz,
  'Approved. Note soft limit exceeded.'
FROM emp, ct
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 3) EMP-003 — Mileage/Transport, hr_approved (HR final)
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-003' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'mileage_transport' LIMIT 1
  ),
  hr AS (
    SELECT p.id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'hr'::public.app_role
    LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  supervisor_approved_at,
  supervisor_remarks,
  hr_id,
  hr_approved_at,
  hr_remarks
)
SELECT
  'CL-20260210-0003',
  emp.id,
  ct.id,
  '2026-02-05'::date,
  52.00,
  'Travel to client site',
  'hr_approved'::public.claim_request_status,
  emp.supervisor_id,
  '2026-02-06T03:00:00Z'::timestamptz,
  'OK',
  hr.id,
  '2026-02-06T09:00:00Z'::timestamptz,
  'Approved (HR final).'
FROM emp, ct, hr
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL AND hr.id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 4) EMP-001 — Medical Hospital/Clinic, pending_finance (HR forwarded)
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-001' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'medical_hospital' LIMIT 1
  ),
  hr AS (
    SELECT p.id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'hr'::public.app_role
    LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  supervisor_approved_at,
  supervisor_remarks,
  hr_id,
  hr_approved_at,
  hr_remarks
)
SELECT
  'CL-20260210-0004',
  emp.id,
  ct.id,
  '2026-02-01'::date,
  180.00,
  'Clinic consultation',
  'pending_finance'::public.claim_request_status,
  emp.supervisor_id,
  '2026-02-02T03:00:00Z'::timestamptz,
  'Forward to HR',
  hr.id,
  '2026-02-02T10:00:00Z'::timestamptz,
  'Forwarded to finance for final approval.'
FROM emp, ct, hr
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL AND hr.id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 5) EMP-002 — Education/Training, finance_approved (not posted yet)
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-002' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'education_training' LIMIT 1
  ),
  approvers AS (
    SELECT
      (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'hr'::public.app_role LIMIT 1) AS hr_id,
      COALESCE(
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'finance'::public.app_role LIMIT 1),
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'admin'::public.app_role LIMIT 1),
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'hr'::public.app_role LIMIT 1)
      ) AS finance_id
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  supervisor_approved_at,
  supervisor_remarks,
  hr_id,
  hr_approved_at,
  hr_remarks,
  finance_id,
  finance_approved_at,
  finance_remarks,
  is_posted
)
SELECT
  'CL-20260210-0005',
  emp.id,
  ct.id,
  '2026-01-22'::date,
  450.00,
  'Course fee reimbursement',
  'finance_approved'::public.claim_request_status,
  emp.supervisor_id,
  '2026-01-23T03:00:00Z'::timestamptz,
  'OK',
  approvers.hr_id,
  '2026-01-23T10:00:00Z'::timestamptz,
  'Forwarded to finance.',
  approvers.finance_id,
  '2026-01-24T09:00:00Z'::timestamptz,
  'Approved. Ready to post.',
  false
FROM emp, ct, approvers
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL AND approvers.hr_id IS NOT NULL AND approvers.finance_id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 6) EMP-001 — Medical Hospital/Clinic, finance_approved + posted
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-001' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'medical_hospital' LIMIT 1
  ),
  approvers AS (
    SELECT
      (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'hr'::public.app_role LIMIT 1) AS hr_id,
      COALESCE(
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'finance'::public.app_role LIMIT 1),
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'admin'::public.app_role LIMIT 1),
        (SELECT p.id FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role = 'hr'::public.app_role LIMIT 1)
      ) AS finance_id
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  supervisor_approved_at,
  supervisor_remarks,
  hr_id,
  hr_approved_at,
  hr_remarks,
  finance_id,
  finance_approved_at,
  finance_remarks,
  is_posted,
  posted_at,
  posted_by,
  posting_reference,
  posting_remarks
)
SELECT
  'CL-20260210-0006',
  emp.id,
  ct.id,
  '2026-01-10'::date,
  95.60,
  'Clinic follow-up',
  'finance_approved'::public.claim_request_status,
  emp.supervisor_id,
  '2026-01-11T03:00:00Z'::timestamptz,
  'OK',
  approvers.hr_id,
  '2026-01-11T10:00:00Z'::timestamptz,
  'Forwarded to finance.',
  approvers.finance_id,
  '2026-01-12T09:00:00Z'::timestamptz,
  'Approved.',
  true,
  '2026-01-15T06:00:00Z'::timestamptz,
  approvers.finance_id,
  'JV-2026-0008',
  'Posted to expense account.'
FROM emp, ct, approvers
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL AND approvers.hr_id IS NOT NULL AND approvers.finance_id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 7) EMP-002 — Entertainment, rejected by supervisor
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-002' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'entertainment' LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  rejected_by,
  rejected_at,
  rejection_remarks,
  rejection_stage
)
SELECT
  'CL-20260210-0007',
  emp.id,
  ct.id,
  '2026-02-03'::date,
  120.00,
  'Client entertainment',
  'rejected'::public.claim_request_status,
  emp.supervisor_id,
  emp.supervisor_id,
  '2026-02-04T03:00:00Z'::timestamptz,
  'Insufficient details / receipt required.',
  'supervisor'
FROM emp, ct
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL AND emp.supervisor_id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;

-- 8) EMP-001 — Repair & Maintenance General, cancelled by employee
WITH
  emp AS (
    SELECT id, supervisor_id FROM public.profiles WHERE employee_id = 'EMP-001' LIMIT 1
  ),
  ct AS (
    SELECT id FROM public.claim_types WHERE code = 'repair_general' LIMIT 1
  )
INSERT INTO public.claims (
  ticket_number,
  employee_id,
  claim_type_id,
  claim_date,
  amount,
  purpose,
  status,
  supervisor_id,
  cancelled_at,
  cancellation_reason
)
SELECT
  'CL-20260210-0008',
  emp.id,
  ct.id,
  '2026-02-07'::date,
  60.00,
  'Minor repair reimbursement',
  'cancelled'::public.claim_request_status,
  emp.supervisor_id,
  '2026-02-08T02:00:00Z'::timestamptz,
  'Submitted in error / duplicate.'
FROM emp, ct
WHERE emp.id IS NOT NULL AND ct.id IS NOT NULL
ON CONFLICT (ticket_number) DO NOTHING;
