export type PayrollRunStatus =
  | 'draft'
  | 'finalized'
  | 'posted'
  | 'cancelled';

export type PayrollApprovalRole = 'hr' | 'management' | 'dmd' | 'finance';

export type PayrollMemoStatus =
  | 'draft'
  | 'pending_director'
  | 'pending_finance'
  | 'finance_approved'
  | 'posted'
  | 'rejected';

export const MEMO_STATUS_LABELS: Record<PayrollMemoStatus, string> = {
  draft: 'Draft',
  pending_director: 'Pending Director',
  pending_finance: 'Pending Finance',
  finance_approved: 'Finance Approved',
  posted: 'Posted',
  rejected: 'Rejected',
};

export const MEMO_STATUS_TRANSITIONS = [
  { from: 'draft', to: 'pending_director', role: 'hr' },
  { from: 'pending_director', to: 'pending_finance', role: 'management' },
  { from: 'pending_director', to: 'rejected', role: 'management' },
  { from: 'pending_director', to: 'pending_finance', role: 'dmd' },
  { from: 'pending_director', to: 'rejected', role: 'dmd' },
  { from: 'pending_finance', to: 'finance_approved', role: 'finance' },
  { from: 'pending_finance', to: 'rejected', role: 'finance' },
  { from: 'finance_approved', to: 'posted', role: 'finance' },
] as const;

export function canTransitionMemo(from: string, to: string, role: string): boolean {
  return MEMO_STATUS_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role
  );
}

export const PAYROLL_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  posted: 'Posted',
  cancelled: 'Cancelled',
};

export interface PayrollSettings {
  id: number;
  employer_epf_rate: number;
  employee_epf_rate_below_60: number;
  employee_epf_rate_above_60: number;
  socso_scheme: 'employment_injury' | 'both';
  eis_employer_rate: number;
  eis_employee_rate: number;
  eis_wage_ceiling: number;
  hrdc_rate: number;
  hrdc_enabled: boolean;
  working_days_per_month: number;
  payroll_cutoff_day: number;
  show_allowance_on_payslip: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SocsoContributionRow {
  id: string;
  wage_from: number;
  wage_to: number;
  employer_first_category: number;
  employee_first_category: number;
  employer_second_category: number;
  created_at?: string;
}

export interface AllowanceType {
  id: string;
  code: string;
  name: string;
  is_epf_subject: boolean;
  is_socso_subject: boolean;
  is_eis_subject: boolean;
  is_taxable: boolean;
  default_amount: number;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DeductionType {
  id: string;
  code: string;
  name: string;
  category: 'statutory' | 'loan' | 'other';
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PayrollRun {
  id: string;
  run_number: string;
  company_id: string;
  pay_period_month: number;
  pay_period_year: number;
  status: PayrollRunStatus;

  total_gross_salary: number;
  total_net_salary: number;
  total_employer_epf: number;
  total_employee_epf: number;
  total_employer_socso: number;
  total_employee_socso: number;
  total_employer_eis: number;
  total_employee_eis: number;
  total_hrdc: number;
  total_pcb: number;
  total_allowances: number;
  total_deductions: number;
  total_director_fee: number;
  employee_count: number;

  memo_id: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  companies?: { id: string; name: string; code?: string; socso_employer_no?: string; epf_employer_no?: string };
  payroll_items?: PayrollItem[];
}

export interface PayrollMemo {
  id: string;
  memo_number: string;
  pay_period_month: number;
  pay_period_year: number;
  status: PayrollMemoStatus;

  employee_count: number;
  total_gross_salary: number;
  total_net_salary: number;
  total_director_fee: number;
  total_employer_epf: number;
  total_employee_epf: number;
  total_employer_socso: number;
  total_employee_socso: number;
  total_employer_eis: number;
  total_employee_eis: number;
  total_hrdc: number;
  total_pcb: number;
  total_allowances: number;
  total_deductions: number;

  created_by: string | null;
  hr_id: string | null;
  hr_approved_at: string | null;
  hr_remarks: string | null;

  director_id: string | null;
  director_approved_at: string | null;
  director_remarks: string | null;

  finance_id: string | null;
  finance_approved_at: string | null;
  finance_remarks: string | null;

  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  rejection_stage: string | null;

  is_posted: boolean;
  posted_at: string | null;
  posted_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;

  basic_salary: number;
  working_days: number;
  days_worked: number;
  is_pro_rated: boolean;
  pro_rated_salary: number;

  is_director: boolean;
  director_fee: number;

  gross_salary: number;
  ot_amount: number;

  employee_epf: number;
  employee_socso: number;
  employee_eis: number;

  employer_epf: number;
  employer_socso: number;
  employer_eis: number;
  employer_hrdc: number;

  pcb_amount: number;

  total_allowances: number;
  total_deductions: number;
  net_salary: number;
  net_director_fee: number;

  unpaid_leave_days: number;
  unpaid_leave_deduction: number;

  claims_amount: number;

  calculation_notes: Record<string, unknown>;
  is_locked: boolean;

  created_at: string;
  updated_at: string;

  // Joined relations
  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    ic_no?: string;
    position?: string;
    designation?: string;
    department_id?: string;
    departments?: { name: string };
    epf_no?: string;
    socso_no?: string;
    income_tax_no?: string;
    bank_name?: string;
    bank_account_no?: string;
  };
  payroll_item_allowances?: PayrollItemAllowance[];
  payroll_item_deductions?: PayrollItemDeduction[];
}

export interface PayrollItemAllowance {
  id: string;
  payroll_item_id: string;
  allowance_type_id: string;
  amount: number;
  created_at?: string;
  allowance_type?: AllowanceType;
}

export interface PayrollItemDeduction {
  id: string;
  payroll_item_id: string;
  deduction_type_id: string;
  amount: number;
  created_at?: string;
  deduction_type?: DeductionType;
}

export interface CreatePayrollRunInput {
  company_id: string;
  pay_period_month: number;
  pay_period_year: number;
}

export interface PayrollCalculationInput {
  payroll_run_id: string;
  settings: PayrollSettings;
  socso_table: SocsoContributionRow[];
}

export interface EmployeePayrollFormInput {
  itemId: string;
  payrollRunId: string;
  updates: Partial<PayrollItem>;
  allowances?: { allowance_type_id: string; amount: number }[];
  deductions?: { deduction_type_id: string; amount: number }[];
}
