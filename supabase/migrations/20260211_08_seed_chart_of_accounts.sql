-- Finance: seed Malaysian-style chart of accounts template

-- Level 1: Categories
WITH rows(account_code, account_name, account_type, level, is_postable, is_active, description, sort_order, system_tag) AS (
  VALUES
    ('1000', 'Assets', 'asset', 1, false, true, 'Asset category', 1000, NULL),
    ('2000', 'Liabilities', 'liability', 1, false, true, 'Liability category', 2000, NULL),
    ('3000', 'Equity', 'equity', 1, false, true, 'Equity category', 3000, NULL),
    ('4000', 'Revenue', 'revenue', 1, false, true, 'Revenue category', 4000, NULL),
    ('5000', 'Expenses', 'expense', 1, false, true, 'Expense category', 5000, NULL)
)
INSERT INTO public.chart_of_accounts (
  parent_id,
  account_code,
  account_name,
  account_type,
  level,
  is_postable,
  is_active,
  description,
  sort_order,
  system_tag
)
SELECT
  NULL,
  r.account_code,
  r.account_name,
  r.account_type::public.account_type,
  r.level,
  r.is_postable,
  r.is_active,
  r.description,
  r.sort_order,
  r.system_tag
FROM rows r
ON CONFLICT (account_code) DO UPDATE
SET
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  level = EXCLUDED.level,
  is_postable = EXCLUDED.is_postable,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  system_tag = EXCLUDED.system_tag;

-- Level 2: Groups
WITH rows(account_code, account_name, account_type, level, is_postable, is_active, description, sort_order, system_tag, parent_code) AS (
  VALUES
    ('1100', 'Current Assets', 'asset', 2, false, true, 'Current assets grouping', 1100, NULL, '1000'),
    ('1200', 'Non-Current Assets', 'asset', 2, false, true, 'Non-current assets grouping', 1200, NULL, '1000'),
    ('2100', 'Current Liabilities', 'liability', 2, false, true, 'Current liabilities grouping', 2100, NULL, '2000'),
    ('2200', 'Non-Current Liabilities', 'liability', 2, false, true, 'Non-current liabilities grouping', 2200, NULL, '2000'),
    ('3100', 'Capital and Reserves', 'equity', 2, false, true, 'Equity grouping', 3100, NULL, '3000'),
    ('4100', 'Operating Revenue', 'revenue', 2, false, true, 'Operating revenue grouping', 4100, NULL, '4000'),
    ('4200', 'Project Revenue', 'revenue', 2, false, true, 'Project revenue grouping', 4200, NULL, '4000'),
    ('5100', 'Employee Expenses', 'expense', 2, false, true, 'Employee cost grouping', 5100, NULL, '5000'),
    ('5200', 'Operating Expenses', 'expense', 2, false, true, 'Operating expense grouping', 5200, NULL, '5000'),
    ('5300', 'Project Costs', 'expense', 2, false, true, 'Project cost grouping', 5300, NULL, '5000'),
    ('5500', 'Petty Cash Expenses', 'expense', 2, false, true, 'Petty cash expense grouping', 5500, NULL, '5000')
)
INSERT INTO public.chart_of_accounts (
  parent_id,
  account_code,
  account_name,
  account_type,
  level,
  is_postable,
  is_active,
  description,
  sort_order,
  system_tag
)
SELECT
  p.id,
  r.account_code,
  r.account_name,
  r.account_type::public.account_type,
  r.level,
  r.is_postable,
  r.is_active,
  r.description,
  r.sort_order,
  r.system_tag
FROM rows r
LEFT JOIN public.chart_of_accounts p ON p.account_code = r.parent_code
ON CONFLICT (account_code) DO UPDATE
SET
  parent_id = EXCLUDED.parent_id,
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  level = EXCLUDED.level,
  is_postable = EXCLUDED.is_postable,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  system_tag = EXCLUDED.system_tag;

-- Level 3: Posting accounts (MFRS/MPERS-oriented template)
WITH rows(account_code, account_name, account_type, level, is_postable, is_active, description, sort_order, system_tag, parent_code) AS (
  VALUES
    ('1110', 'Cash at Bank', 'asset', 3, true, true, 'Company bank balances', 1110, 'cash_bank', '1100'),
    ('1120', 'Cash in Hand', 'asset', 3, true, true, 'Physical cash on hand', 1120, 'cash_in_hand', '1100'),
    ('1130', 'Petty Cash', 'asset', 3, true, true, 'Petty cash float account', 1130, 'petty_cash', '1100'),
    ('1140', 'Trade Receivables', 'asset', 3, true, true, 'Amounts due from customers', 1140, 'trade_receivables', '1100'),
    ('1210', 'Property, Plant and Equipment', 'asset', 3, true, true, 'Fixed asset cost', 1210, 'ppe', '1200'),
    ('1220', 'Accumulated Depreciation', 'asset', 3, true, true, 'Accumulated depreciation contra-account', 1220, 'accumulated_depreciation', '1200'),

    ('2110', 'Trade Payables', 'liability', 3, true, true, 'Amounts due to suppliers', 2110, 'trade_payables', '2100'),
    ('2130', 'EPF Payable', 'liability', 3, true, true, 'Outstanding EPF liability', 2130, 'payroll_epf_payable', '2100'),
    ('2140', 'SOCSO Payable', 'liability', 3, true, true, 'Outstanding SOCSO liability', 2140, 'payroll_socso_payable', '2100'),
    ('2150', 'EIS Payable', 'liability', 3, true, true, 'Outstanding EIS liability', 2150, 'payroll_eis_payable', '2100'),
    ('2160', 'HRDC Payable', 'liability', 3, true, true, 'Outstanding HRDC levy liability', 2160, 'payroll_hrdc_payable', '2100'),
    ('2170', 'PCB Payable', 'liability', 3, true, true, 'Outstanding PCB/MTD liability', 2170, 'payroll_pcb_payable', '2100'),
    ('2180', 'Salary Payable', 'liability', 3, true, true, 'Net payroll payable', 2180, 'payroll_salary_payable', '2100'),
    ('2190', 'Claims Payable', 'liability', 3, true, true, 'Approved staff claims payable', 2190, 'claims_payable', '2100'),
    ('2210', 'Lease Liabilities', 'liability', 3, true, true, 'Long-term lease obligations', 2210, 'lease_liabilities', '2200'),

    ('3110', 'Share Capital', 'equity', 3, true, true, 'Paid-up share capital', 3110, 'share_capital', '3100'),
    ('3120', 'Retained Earnings', 'equity', 3, true, true, 'Retained earnings balance', 3120, 'retained_earnings', '3100'),

    ('4110', 'Service Revenue', 'revenue', 3, true, true, 'Operational service income', 4110, 'service_revenue', '4100'),
    ('4120', 'Contract Revenue', 'revenue', 3, true, true, 'Contracted service income', 4120, 'contract_revenue', '4100'),
    ('4210', 'Project Revenue', 'revenue', 3, true, true, 'Project-based revenue', 4210, 'project_revenue', '4200'),

    ('5110', 'Salaries and Wages', 'expense', 3, true, true, 'Gross payroll wages', 5110, 'payroll_gross', '5100'),
    ('5120', 'Director Fees', 'expense', 3, true, true, 'Director remuneration', 5120, 'payroll_director_fee', '5100'),
    ('5130', 'Employer EPF', 'expense', 3, true, true, 'Employer EPF contribution expense', 5130, 'payroll_employer_epf', '5100'),
    ('5140', 'Employer SOCSO', 'expense', 3, true, true, 'Employer SOCSO contribution expense', 5140, 'payroll_employer_socso', '5100'),
    ('5150', 'Employer EIS', 'expense', 3, true, true, 'Employer EIS contribution expense', 5150, 'payroll_employer_eis', '5100'),
    ('5160', 'Employer HRDC', 'expense', 3, true, true, 'Employer HRDC levy expense', 5160, 'payroll_employer_hrdc', '5100'),
    ('5170', 'Staff Allowances', 'expense', 3, true, true, 'Allowance expenses', 5170, 'payroll_allowances', '5100'),
    ('5180', 'Overtime Expense', 'expense', 3, true, true, 'Overtime payment expense', 5180, 'payroll_ot', '5100'),
    ('5190', 'Staff Claims', 'expense', 3, true, true, 'Employee claim reimbursements', 5190, 'claims_expense', '5100'),

    ('5210', 'Rental Expense', 'expense', 3, true, true, 'Premise and equipment rentals', 5210, 'operating_rental', '5200'),
    ('5220', 'Utilities Expense', 'expense', 3, true, true, 'Utility costs', 5220, 'operating_utilities', '5200'),
    ('5230', 'Office Supplies', 'expense', 3, true, true, 'Office consumables', 5230, 'operating_office_supplies', '5200'),

    ('5310', 'Project Labor Cost', 'expense', 3, true, true, 'Labor allocated to project', 5310, 'project_labor', '5300'),
    ('5320', 'Project Materials Cost', 'expense', 3, true, true, 'Materials consumed for project', 5320, 'project_materials', '5300'),
    ('5330', 'Project Subcontractor Cost', 'expense', 3, true, true, 'Subcontractor related project cost', 5330, 'project_subcontractor', '5300'),
    ('5340', 'Project Equipment Cost', 'expense', 3, true, true, 'Equipment usage for projects', 5340, 'project_equipment', '5300'),
    ('5350', 'Project Travel Cost', 'expense', 3, true, true, 'Project travel expenses', 5350, 'project_travel', '5300'),

    ('5510', 'Petty Cash - Transport', 'expense', 3, true, true, 'Petty cash transport spend', 5510, 'petty_cash_transport', '5500'),
    ('5520', 'Petty Cash - Meals', 'expense', 3, true, true, 'Petty cash meals and refreshments', 5520, 'petty_cash_meals', '5500')
)
INSERT INTO public.chart_of_accounts (
  parent_id,
  account_code,
  account_name,
  account_type,
  level,
  is_postable,
  is_active,
  description,
  sort_order,
  system_tag
)
SELECT
  p.id,
  r.account_code,
  r.account_name,
  r.account_type::public.account_type,
  r.level,
  r.is_postable,
  r.is_active,
  r.description,
  r.sort_order,
  r.system_tag
FROM rows r
LEFT JOIN public.chart_of_accounts p ON p.account_code = r.parent_code
ON CONFLICT (account_code) DO UPDATE
SET
  parent_id = EXCLUDED.parent_id,
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  level = EXCLUDED.level,
  is_postable = EXCLUDED.is_postable,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  system_tag = EXCLUDED.system_tag;
