-- Finance: seed sample projects and sample cost allocations

WITH ranked_companies AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.companies
  WHERE COALESCE(is_active, true) = true
),
seed_projects(project_code, project_name, company_rank, client_name, budget_amount, start_date, end_date, status, description) AS (
  VALUES
    ('PRJ-2026-001', 'Petronas Tower Maintenance', 1, 'Petronas', 250000.00, '2026-01-01'::date, '2026-06-30'::date, 'active', 'Maintenance and electrical services for Petronas tower block'),
    ('PRJ-2026-002', 'KL Sentral Wiring', 2, 'KL Sentral Facilities', 180000.00, '2026-01-15'::date, '2026-05-31'::date, 'active', 'Wiring and panel enhancement works at KL Sentral'),
    ('PRJ-2026-003', 'Cyberjaya Data Center', 3, 'Cyberjaya DC Ops', 420000.00, '2026-02-01'::date, '2026-09-30'::date, 'on_hold', 'Data center fit-out and backup power cabling')
)
INSERT INTO public.projects (
  project_code,
  project_name,
  company_id,
  client_name,
  budget_amount,
  start_date,
  end_date,
  status,
  description,
  is_active
)
SELECT
  sp.project_code,
  sp.project_name,
  rc.id,
  sp.client_name,
  sp.budget_amount,
  sp.start_date,
  sp.end_date,
  sp.status::public.project_status,
  sp.description,
  true
FROM seed_projects sp
JOIN ranked_companies rc ON rc.rn = sp.company_rank
ON CONFLICT (project_code) DO UPDATE
SET
  project_name = EXCLUDED.project_name,
  company_id = EXCLUDED.company_id,
  client_name = EXCLUDED.client_name,
  budget_amount = EXCLUDED.budget_amount,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

WITH
project_map AS (
  SELECT id, project_code
  FROM public.projects
  WHERE project_code IN ('PRJ-2026-001', 'PRJ-2026-002', 'PRJ-2026-003')
),
payroll_latest AS (
  SELECT id
  FROM public.payroll_runs
  ORDER BY pay_period_year DESC, pay_period_month DESC
  LIMIT 1
),
petty_latest AS (
  SELECT id
  FROM public.petty_cash_transactions
  ORDER BY txn_date DESC, created_at DESC
  LIMIT 1
),
actor AS (
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('finance'::public.app_role, 'admin'::public.app_role)
  LIMIT 1
),
rows(project_code, source_type, source_ref, cost_category, system_tag, amount, cost_date, description) AS (
  VALUES
    ('PRJ-2026-001', 'payroll', 'latest_payroll', 'labor', 'project_labor', 42000.00, '2026-01-31'::date, 'Labor allocation from payroll run'),
    ('PRJ-2026-002', 'manual', NULL, 'materials', 'project_materials', 15000.00, '2026-01-18'::date, 'Cable, conduit, and switchgear materials'),
    ('PRJ-2026-003', 'manual', NULL, 'subcontractor', 'project_subcontractor', 22000.00, '2026-01-25'::date, 'Specialist subcontractor engagement'),
    ('PRJ-2026-001', 'manual', NULL, 'equipment', 'project_equipment', 8800.00, '2026-02-03'::date, 'Lift and access equipment usage'),
    ('PRJ-2026-002', 'petty_cash', 'latest_petty_cash', 'travel', 'project_travel', 1200.00, '2026-02-05'::date, 'Project transport reimbursements')
)
INSERT INTO public.project_cost_allocations (
  project_id,
  source_type,
  source_id,
  cost_category,
  account_id,
  amount,
  cost_date,
  cost_month,
  cost_year,
  description,
  created_by
)
SELECT
  pm.id,
  r.source_type::public.cost_source_type,
  CASE
    WHEN r.source_ref = 'latest_payroll' THEN pl.id
    WHEN r.source_ref = 'latest_petty_cash' THEN pt.id
    ELSE NULL
  END,
  r.cost_category::public.cost_category,
  coa.id,
  r.amount,
  r.cost_date,
  EXTRACT(MONTH FROM r.cost_date)::int,
  EXTRACT(YEAR FROM r.cost_date)::int,
  r.description,
  a.id
FROM rows r
JOIN project_map pm ON pm.project_code = r.project_code
JOIN public.chart_of_accounts coa ON coa.system_tag = r.system_tag
LEFT JOIN payroll_latest pl ON true
LEFT JOIN petty_latest pt ON true
LEFT JOIN actor a ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_cost_allocations existing
  WHERE existing.project_id = pm.id
    AND existing.source_type = r.source_type::public.cost_source_type
    AND COALESCE(existing.source_id::text, '') = COALESCE(
      CASE
        WHEN r.source_ref = 'latest_payroll' THEN pl.id::text
        WHEN r.source_ref = 'latest_petty_cash' THEN pt.id::text
        ELSE ''
      END,
      ''
    )
    AND existing.cost_category = r.cost_category::public.cost_category
    AND existing.cost_date = r.cost_date
    AND existing.amount = r.amount
);
