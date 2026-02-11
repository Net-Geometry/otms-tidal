-- Seed payroll runs with realistic data for Acme Corp
-- Company: Acme Corp (6806c8fe-9046-4436-bb3c-b4c85485b0a7)
-- HR user (created_by): Jack HR-001 (a5386595-4675-4d95-a3b7-2b749e4e3ab5)
-- Director: Brock MNG-001 (d7cf717e-b3fc-401b-aafc-fbc6d7c28ef9)
--
-- Employees (all Acme Corp, salary / SOCSO EE / EIS EE / EPF EE / net):
--   Brock  MNG-001  10000  15.85  10.00  1100  8874.15
--   David  SV-001    6000  15.85  10.00   660  5314.15
--   Hannah EMP-002   5000  15.85  10.00   550  4424.15
--   Hugh   EMP-001   9000  15.85  10.00   990  7984.15
--   Jack   HR-001    4000  15.85   8.00   440  3536.15
--   Scott  SV-002    4000  15.85   8.00   440  3536.15
--   Trump  EMP-003   1000   3.85   2.00   110   884.15
--
-- Totals (7 employees):
--   gross=39000  net=34553.05
--   employer_epf=5850  employee_epf=4290
--   employer_socso=370.80  employee_socso=98.95
--   employer_eis=62  employee_eis=62
--   hrdc=390  deductions=4450.95

-- =============================================
-- RUN 1: December 2025 — fully posted
-- =============================================
INSERT INTO public.payroll_runs (
  id, run_number, company_id,
  pay_period_month, pay_period_year, status,
  total_gross_salary, total_net_salary,
  total_employer_epf, total_employee_epf,
  total_employer_socso, total_employee_socso,
  total_employer_eis, total_employee_eis,
  total_hrdc, total_pcb, total_allowances, total_deductions,
  total_director_fee, employee_count,
  hr_id, hr_approved_at, hr_remarks,
  director_id, director_approved_at, director_remarks,
  finance_id, finance_approved_at, finance_remarks,
  is_posted, posted_at, posted_by, posting_reference,
  created_by, created_at
) VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'PR-2025-12-001',
  '6806c8fe-9046-4436-bb3c-b4c85485b0a7',
  12, 2025, 'posted',
  39000.00, 34553.05,
  5850.00, 4290.00,
  370.80, 98.95,
  62.00, 62.00,
  390.00, 0.00, 0.00, 4450.95,
  0.00, 7,
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2025-12-28 09:00:00+08', 'December payroll approved',
  'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9', '2025-12-29 10:00:00+08', 'Looks good',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2025-12-30 11:00:00+08', NULL,
  true, '2025-12-31 09:00:00+08', 'a5386595-4675-4d95-a3b7-2b749e4e3ab5', 'JV-2025-12-001',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2025-12-26 08:00:00+08'
) ON CONFLICT (company_id, pay_period_month, pay_period_year) DO NOTHING;

-- =============================================
-- RUN 2: January 2026 — finance approved, ready to post
-- =============================================
INSERT INTO public.payroll_runs (
  id, run_number, company_id,
  pay_period_month, pay_period_year, status,
  total_gross_salary, total_net_salary,
  total_employer_epf, total_employee_epf,
  total_employer_socso, total_employee_socso,
  total_employer_eis, total_employee_eis,
  total_hrdc, total_pcb, total_allowances, total_deductions,
  total_director_fee, employee_count,
  hr_id, hr_approved_at, hr_remarks,
  director_id, director_approved_at, director_remarks,
  finance_id, finance_approved_at, finance_remarks,
  is_posted,
  created_by, created_at
) VALUES (
  'a0000001-0000-0000-0000-000000000002',
  'PR-2026-01-001',
  '6806c8fe-9046-4436-bb3c-b4c85485b0a7',
  1, 2026, 'finance_approved',
  39000.00, 34553.05,
  5850.00, 4290.00,
  370.80, 98.95,
  62.00, 62.00,
  390.00, 0.00, 0.00, 4450.95,
  0.00, 7,
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2026-01-28 09:00:00+08', 'January payroll approved',
  'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9', '2026-01-29 10:00:00+08', 'Approved',
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2026-01-30 11:00:00+08', 'Verified',
  false,
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2026-01-26 08:00:00+08'
) ON CONFLICT (company_id, pay_period_month, pay_period_year) DO NOTHING;

-- =============================================
-- RUN 3: February 2026 — draft (just created, calculated)
-- =============================================
INSERT INTO public.payroll_runs (
  id, run_number, company_id,
  pay_period_month, pay_period_year, status,
  total_gross_salary, total_net_salary,
  total_employer_epf, total_employee_epf,
  total_employer_socso, total_employee_socso,
  total_employer_eis, total_employee_eis,
  total_hrdc, total_pcb, total_allowances, total_deductions,
  total_director_fee, employee_count,
  is_posted,
  created_by, created_at
) VALUES (
  'a0000001-0000-0000-0000-000000000003',
  'PR-2026-02-001',
  '6806c8fe-9046-4436-bb3c-b4c85485b0a7',
  2, 2026, 'draft',
  39000.00, 34553.05,
  5850.00, 4290.00,
  370.80, 98.95,
  62.00, 62.00,
  390.00, 0.00, 0.00, 4450.95,
  0.00, 7,
  false,
  'a5386595-4675-4d95-a3b7-2b749e4e3ab5', '2026-02-10 08:00:00+08'
) ON CONFLICT (company_id, pay_period_month, pay_period_year) DO NOTHING;


-- =============================================
-- PAYROLL ITEMS — helper to insert 7 employees per run
-- Using: salary>4000 → SOCSO EE=15.85, ER=59.40
--        salary=1000 → SOCSO EE=3.85,  ER=14.40
--        EIS = min(salary,5000)*0.002
-- =============================================

-- ---- RUN 1 items (December 2025 — posted) ----
INSERT INTO public.payroll_items (payroll_run_id, employee_id, basic_salary, working_days, days_worked, pro_rated_salary, gross_salary, employee_epf, employee_socso, employee_eis, employer_epf, employer_socso, employer_eis, employer_hrdc, total_deductions, net_salary, calculation_notes, is_locked)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9', 10000, 26, 26, 10000, 10000, 1100, 15.85, 10.00, 1500, 59.40, 10.00, 100, 1125.85, 8874.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', 'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',  6000, 26, 26,  6000,  6000,  660, 15.85, 10.00,  900, 59.40, 10.00,  60,  685.85, 5314.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', 'a1cd9cb8-3d01-4954-b77a-d0a54558248e',  5000, 26, 26,  5000,  5000,  550, 15.85, 10.00,  750, 59.40, 10.00,  50,  575.85, 4424.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', '11776acb-080b-45c1-9dfe-70310d95f930',  9000, 26, 26,  9000,  9000,  990, 15.85, 10.00, 1350, 59.40, 10.00,  90, 1015.85, 7984.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', 'a5386595-4675-4d95-a3b7-2b749e4e3ab5',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', 'd9998cd5-d337-410a-965d-7291ddafefe8',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2025-12"}', true),
  ('a0000001-0000-0000-0000-000000000001', 'ea6188bd-dfe2-48dd-886c-b88fbe69afa2',  1000, 26, 26,  1000,  1000,  110,  3.85,  2.00,  150, 14.40,  2.00,  10,  115.85,  884.15, '{"month":"2025-12"}', true)
ON CONFLICT (payroll_run_id, employee_id) DO NOTHING;

-- ---- RUN 2 items (January 2026 — finance approved) ----
INSERT INTO public.payroll_items (payroll_run_id, employee_id, basic_salary, working_days, days_worked, pro_rated_salary, gross_salary, employee_epf, employee_socso, employee_eis, employer_epf, employer_socso, employer_eis, employer_hrdc, total_deductions, net_salary, calculation_notes, is_locked)
VALUES
  ('a0000001-0000-0000-0000-000000000002', 'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9', 10000, 26, 26, 10000, 10000, 1100, 15.85, 10.00, 1500, 59.40, 10.00, 100, 1125.85, 8874.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', 'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',  6000, 26, 26,  6000,  6000,  660, 15.85, 10.00,  900, 59.40, 10.00,  60,  685.85, 5314.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', 'a1cd9cb8-3d01-4954-b77a-d0a54558248e',  5000, 26, 26,  5000,  5000,  550, 15.85, 10.00,  750, 59.40, 10.00,  50,  575.85, 4424.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', '11776acb-080b-45c1-9dfe-70310d95f930',  9000, 26, 26,  9000,  9000,  990, 15.85, 10.00, 1350, 59.40, 10.00,  90, 1015.85, 7984.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', 'a5386595-4675-4d95-a3b7-2b749e4e3ab5',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', 'd9998cd5-d337-410a-965d-7291ddafefe8',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2026-01"}', true),
  ('a0000001-0000-0000-0000-000000000002', 'ea6188bd-dfe2-48dd-886c-b88fbe69afa2',  1000, 26, 26,  1000,  1000,  110,  3.85,  2.00,  150, 14.40,  2.00,  10,  115.85,  884.15, '{"month":"2026-01"}', true)
ON CONFLICT (payroll_run_id, employee_id) DO NOTHING;

-- ---- RUN 3 items (February 2026 — draft) ----
INSERT INTO public.payroll_items (payroll_run_id, employee_id, basic_salary, working_days, days_worked, pro_rated_salary, gross_salary, employee_epf, employee_socso, employee_eis, employer_epf, employer_socso, employer_eis, employer_hrdc, total_deductions, net_salary, calculation_notes)
VALUES
  ('a0000001-0000-0000-0000-000000000003', 'd7cf717e-b3fc-401b-aafc-fbc6d7c28ef9', 10000, 26, 26, 10000, 10000, 1100, 15.85, 10.00, 1500, 59.40, 10.00, 100, 1125.85, 8874.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', 'a17bdbc9-c78b-452e-8d48-aa01ebd0ad16',  6000, 26, 26,  6000,  6000,  660, 15.85, 10.00,  900, 59.40, 10.00,  60,  685.85, 5314.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', 'a1cd9cb8-3d01-4954-b77a-d0a54558248e',  5000, 26, 26,  5000,  5000,  550, 15.85, 10.00,  750, 59.40, 10.00,  50,  575.85, 4424.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', '11776acb-080b-45c1-9dfe-70310d95f930',  9000, 26, 26,  9000,  9000,  990, 15.85, 10.00, 1350, 59.40, 10.00,  90, 1015.85, 7984.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', 'a5386595-4675-4d95-a3b7-2b749e4e3ab5',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', 'd9998cd5-d337-410a-965d-7291ddafefe8',  4000, 26, 26,  4000,  4000,  440, 15.85,  8.00,  600, 59.40,  8.00,  40,  463.85, 3536.15, '{"month":"2026-02"}'),
  ('a0000001-0000-0000-0000-000000000003', 'ea6188bd-dfe2-48dd-886c-b88fbe69afa2',  1000, 26, 26,  1000,  1000,  110,  3.85,  2.00,  150, 14.40,  2.00,  10,  115.85,  884.15, '{"month":"2026-02"}')
ON CONFLICT (payroll_run_id, employee_id) DO NOTHING;
