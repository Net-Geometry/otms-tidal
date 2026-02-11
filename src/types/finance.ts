export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
};

export interface ChartOfAccount {
  id: string;
  parent_id: string | null;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  level: 1 | 2 | 3;
  is_postable: boolean;
  is_active: boolean;
  description: string | null;
  sort_order: number;
  system_tag: string | null;
  created_at?: string;
  updated_at?: string;
  children?: ChartOfAccount[];
}

export type PettyCashTxnType = 'top_up' | 'expenditure';
export type PettyCashStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const PETTY_CASH_TXN_TYPE_LABELS: Record<PettyCashTxnType, string> = {
  top_up: 'Top-up',
  expenditure: 'Expenditure',
};

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface PettyCashSettings {
  id: number;
  float_amount: number;
  approval_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface PettyCashTransaction {
  id: string;
  txn_number: string;
  txn_type: PettyCashTxnType;
  txn_date: string;
  amount: number;
  description: string;
  account_id: string;
  project_id: string | null;
  receipt_urls: string[];
  status: PettyCashStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_remarks: string | null;
  is_posted: boolean;
  posted_by: string | null;
  posted_at: string | null;
  posting_reference: string | null;
  posting_remarks: string | null;
  running_balance: number;
  created_at: string;
  updated_at: string;

  account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'>;
  project?: {
    id: string;
    project_code: string;
    project_name: string;
  } | null;
  requester?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  approver?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
}

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  company_id: string;
  client_name: string | null;
  budget_amount: number;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;

  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;

  total_spent?: number;
  budget_utilization?: number;
}

export type CostSourceType = 'payroll' | 'claims' | 'petty_cash' | 'manual';
export type CostCategory = 'labor' | 'materials' | 'subcontractor' | 'equipment' | 'overhead' | 'travel' | 'other';

export const COST_SOURCE_TYPE_LABELS: Record<CostSourceType, string> = {
  payroll: 'Payroll',
  claims: 'Claims',
  petty_cash: 'Petty Cash',
  manual: 'Manual',
};

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  labor: 'Labor',
  materials: 'Materials',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  overhead: 'Overhead',
  travel: 'Travel',
  other: 'Other',
};

export interface ProjectCostAllocation {
  id: string;
  project_id: string;
  source_type: CostSourceType;
  source_id: string | null;
  cost_category: CostCategory;
  account_id: string;
  amount: number;
  cost_date: string;
  cost_month: number;
  cost_year: number;
  description: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;

  project?: Pick<Project, 'id' | 'project_code' | 'project_name'>;
  account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'>;
}
