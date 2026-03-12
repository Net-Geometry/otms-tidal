export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'cost' | 'expense';

export const COA_ACCOUNT_SUBTYPE_OPTIONS = [
  'FA',
  'IV',
  'CA',
  'OA',
  'LT',
  'CL',
  'OL',
  'CP',
  'RV',
  'RE',
  'SL',
  'SA',
  'OI',
  'EO',
  'CO',
  'EP',
  'TX',
  'AP',
] as const;

export type CoaAccountSubtype = (typeof COA_ACCOUNT_SUBTYPE_OPTIONS)[number];

export const COA_ACCOUNT_SUBTYPE_LABELS: Record<CoaAccountSubtype, string> = {
  FA: 'FA - Fixed Assets',
  IV: 'IV - Investment',
  CA: 'CA - Current Assets',
  OA: 'OA - Other Assets',
  LT: 'LT - Long-Term Liabilities',
  CL: 'CL - Current Liabilities',
  OL: 'OL - Other Liabilities',
  CP: 'CP - Capital',
  RV: 'RV - Reserve',
  RE: 'RE - Retained Earnings',
  SL: 'SL - Sales',
  SA: 'SA - Sales Adjustment',
  OI: 'OI - Other Income',
  EO: 'EO - Extraordinary',
  CO: 'CO - Cost of Operations',
  EP: 'EP - Expenses',
  TX: 'TX - Taxation',
  AP: 'AP - Appropriation',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  cost: 'Cost',
  expense: 'Expense',
};

export const COA_SPECIAL_TYPE_OPTIONS = [
  'AD', 'DC', 'CC', 'BA', 'CH', 'BS', 'OS', 'CS',
] as const;

export type CoaSpecialType = (typeof COA_SPECIAL_TYPE_OPTIONS)[number];

export const COA_SPECIAL_TYPE_LABELS: Record<CoaSpecialType, string> = {
  AD: 'Accum. Depreciation',
  DC: 'Debtor Control',
  CC: 'Creditor Control',
  BA: 'Bank Account',
  CH: 'Cash in Hand',
  BS: 'Beginning Stock',
  OS: 'Opening Stock',
  CS: 'Closing Stock',
};

export interface ChartOfAccount {
  id: string;
  parent_id: string | null;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_subtype?: CoaAccountSubtype | null;
  level: 0 | 1 | 2 | 3 | 4;
  is_postable: boolean;
  is_active: boolean;
  description: string | null;
  sort_order: number;
  system_tag: string | null;
  special_type: CoaSpecialType | null;
  currency_code: string | null;
  has_postings: boolean;
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

/**
 * Petty cash workflow transitions.
 *
 * Notes:
 * - Auto-approval during transaction creation can skip these transitions.
 * - Posting is tracked separately via `is_posted` and is not a status transition.
 * - `cancelled` is reserved for future workflow extensions.
 */
export const PETTY_CASH_TRANSITIONS = [
  { from: 'pending', to: 'approved', role: 'finance' },
  { from: 'pending', to: 'rejected', role: 'finance' },
] as const;

export function canTransitionPettyCash(from: string, to: string, role: string): boolean {
  return PETTY_CASH_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role,
  );
}

export interface PettyCashSettings {
  id: number;
  float_amount: number;
  approval_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface PettyCashTransactionLine {
  id: string;
  txn_id: string;
  account_id: string;
  description: string;
  amount: number;
  sort_order: number;
  created_at: string;
  account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'>;
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
  payee: string | null;
  department: string | null;
  tax_amount: number;
  receipt_urls: string[];
  status: PettyCashStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_remarks: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  is_posted: boolean;
  posted_by: string | null;
  posted_at: string | null;
  posting_reference: string | null;
  posting_remarks: string | null;
  running_balance: number;
  created_at: string;
  updated_at: string;

  fund_account_id: string | null;
  lines?: PettyCashTransactionLine[];
  fund_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'>;

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
  rejector?: {
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

export type FinanceDoaDocumentType = 'prf' | 'pv' | 'ap_invoice' | 'ar_invoice' | 'journal' | 'pcv' | 'dcn';

export const FINANCE_DOA_DOCUMENT_LABELS: Record<FinanceDoaDocumentType, string> = {
  prf: 'PRF',
  pv: 'Payment Voucher',
  ap_invoice: 'AP Invoice',
  ar_invoice: 'AR Invoice',
  journal: 'Journal Entry',
  pcv: 'Petty Cash Voucher',
  dcn: 'Debit/Credit Note',
};

export interface FinanceCompanyProfile {
  id: string;
  company_id: string;
  base_currency: string;
  fiscal_year_start_month: number;
  payment_terms_days: number;
  decimal_precision: number;
  default_bank_account_id: string | null;
  retained_earnings_gl_id: string | null;
  suspense_account_gl_id: string | null;
  tax_id: string | null;
  sst_registration_no: string | null;
  lock_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface DoaRule {
  id: string;
  company_id: string;
  document_type: FinanceDoaDocumentType;
  approval_level: 1 | 2 | 3 | 4;
  min_amount: number;
  max_amount: number | null;
  approver_role: string;
  is_active: boolean;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface Supplier {
  id: string;
  company_id: string;
  supplier_code: string;
  supplier_name: string;
  category: string | null;
  tax_id: string | null;
  gst_no: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_holder: string | null;
  swift_code: string | null;
  payment_terms_days: number;
  credit_limit: number;
  currency: string;
  opening_balance: number;
  outstanding_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export type FinanceStatementFrequency = 'monthly' | 'quarterly' | 'on_demand';

export const FINANCE_STATEMENT_FREQUENCY_LABELS: Record<FinanceStatementFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  on_demand: 'On Demand',
};

export interface Customer {
  id: string;
  company_id: string;
  customer_code: string;
  customer_name: string;
  tax_id: string | null;
  sst_no: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_terms_days: number;
  credit_limit: number;
  currency: string;
  statement_frequency: FinanceStatementFrequency;
  opening_balance: number;
  outstanding_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export type FinanceBankAccountType = 'current' | 'savings' | 'fixed_deposit';

export const FINANCE_BANK_ACCOUNT_TYPE_LABELS: Record<FinanceBankAccountType, string> = {
  current: 'Current',
  savings: 'Savings',
  fixed_deposit: 'Fixed Deposit',
};

export interface BankAccount {
  id: string;
  company_id: string;
  account_code: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  account_type: FinanceBankAccountType;
  currency: string;
  current_balance: number;
  gl_account_id: string | null;
  is_reconciling: boolean;
  last_reconciled_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
}

export interface GLOpeningBalance {
  id: string;
  company_id: string;
  fiscal_year: number;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name' | 'account_type'>;
}

export type GLReferenceType =
  | 'manual'
  | 'ap_invoice'
  | 'ar_invoice'
  | 'payment_voucher'
  | 'official_receipt'
  | 'petty_cash'
  | 'claims'
  | 'payroll'
  | 'ap_dcn'
  | 'ar_dcn';

export const GL_REFERENCE_TYPE_LABELS: Record<GLReferenceType, string> = {
  manual: 'Manual',
  ap_invoice: 'AP Invoice',
  ar_invoice: 'AR Invoice',
  payment_voucher: 'Payment Voucher',
  official_receipt: 'Official Receipt',
  petty_cash: 'Petty Cash',
  claims: 'Claims',
  payroll: 'Payroll',
  ap_dcn: 'AP Debit/Credit Note',
  ar_dcn: 'AR Debit/Credit Note',
};

export interface DocumentSequence {
  id: string;
  company_id: string;
  prefix: string;
  year: number;
  month: number;
  last_number: number;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  cost_center: string | null;
  project_id: string | null;
  created_at?: string;
  account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
  project?: Pick<Project, 'id' | 'project_code' | 'project_name'> | null;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  reference_type: GLReferenceType;
  reference_id: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  is_reversed: boolean;
  fiscal_year: number;
  fiscal_month: number;
  created_at?: string;
  updated_at?: string;
  lines?: JournalEntryLine[];
  posted_by_profile?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  reversed_by_profile?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  total_debit?: number;
  total_credit?: number;
}

export type FinanceApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const FINANCE_APPROVAL_STATUS_LABELS: Record<FinanceApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface ApprovalWorkflow {
  id: string;
  company_id: string | null;
  document_type: FinanceDoaDocumentType;
  document_id: string;
  document_number: string | null;
  requested_by: string | null;
  current_level: 1 | 2 | 3 | 4;
  status: FinanceApprovalStatus;
  amount: number | null;
  currency: string | null;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    name: string;
    code: string;
  } | null;
  requester?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  decider?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
}

export type FinanceApprovalAction = 'submitted' | 'approved' | 'rejected' | 'recalled';

export interface ApprovalHistory {
  id: string;
  workflow_id: string;
  approval_level: 1 | 2 | 3 | 4;
  action: FinanceApprovalAction;
  acted_by: string | null;
  acted_at: string;
  comments: string | null;
  metadata: Record<string, unknown>;
}

export type ApPrfStatus = 'draft' | 'prepared' | 'verified' | 'checked' | 'approved' | 'rejected' | 'cancelled';

export const AP_PRF_STATUS_LABELS: Record<ApPrfStatus, string> = {
  draft: 'Draft',
  prepared: 'Prepared',
  verified: 'Verified',
  checked: 'Checked',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const PRF_STATUS_TRANSITIONS = [
  { from: 'draft', to: 'prepared', role: 'finance_admin' },
  { from: 'draft', to: 'cancelled', role: 'finance_admin' },
  { from: 'prepared', to: 'verified', role: 'management' },
  { from: 'prepared', to: 'rejected', role: 'management' },
  { from: 'verified', to: 'checked', role: 'assistant_manager' },
  { from: 'verified', to: 'rejected', role: 'assistant_manager' },
  { from: 'checked', to: 'approved', role: 'dmd' },
  { from: 'checked', to: 'rejected', role: 'dmd' },
  { from: 'rejected', to: 'prepared', role: 'finance_admin' },
] as const;

export function canTransitionPRF(from: string, to: string, role: string): boolean {
  return PRF_STATUS_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role,
  );
}

export type ApInvoiceStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

export const AP_INVOICE_STATUS_LABELS: Record<ApInvoiceStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export type ApPvStatus = 'draft' | 'pending' | 'checked' | 'approved' | 'rejected' | 'paid' | 'posted' | 'cancelled';

export const AP_PV_STATUS_LABELS: Record<ApPvStatus, string> = {
  draft: 'Draft',
  pending: 'Pending Approval',
  checked: 'Checked',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  posted: 'Posted',
  cancelled: 'Cancelled',
};

/** PV Approval Flow: Admin prepares → Asst Manager checks → DMD approves → Paid */
export type PvApprovalRole = 'finance_admin' | 'assistant_manager' | 'dmd';

export const PV_STATUS_TRANSITIONS = [
  // Admin submits → pending check by assistant manager
  { from: 'draft', to: 'pending', role: 'finance_admin' },
  // Assistant manager checks → checked, ready for DMD
  { from: 'pending', to: 'checked', role: 'assistant_manager' },
  { from: 'pending', to: 'rejected', role: 'assistant_manager' },
  // DMD approves → approved, ready for payment
  { from: 'checked', to: 'approved', role: 'dmd' },
  { from: 'checked', to: 'rejected', role: 'dmd' },
  // Finance admin marks as paid
  { from: 'approved', to: 'paid', role: 'finance_admin' },
] as const;

export function canTransitionPV(from: string, to: string, role: string): boolean {
  return PV_STATUS_TRANSITIONS.some((t) => t.from === from && t.to === to && t.role === role);
}

export type PvPostToType = 'cashbook' | 'ap_payment' | 'ap_credit_note';

export const PV_POST_TO_LABELS: Record<PvPostToType, string> = {
  cashbook: 'Cashbook',
  ap_payment: 'AP Payment',
  ap_credit_note: 'AP Credit Note',
};

export type ApPaymentMethod = 'cheque' | 'online_transfer' | 'cash' | 'others';

export const AP_PAYMENT_METHOD_LABELS: Record<ApPaymentMethod, string> = {
  cheque: 'Cheque',
  online_transfer: 'Online Transfer',
  cash: 'Cash',
  others: 'Others',
};

export type ApUnitOfMeasure =
  | 'unit'
  | 'piece'
  | 'set'
  | 'box'
  | 'pack'
  | 'carton'
  | 'kg'
  | 'litre'
  | 'meter'
  | 'hour'
  | 'day'
  | 'month'
  | 'service';

export const AP_UNIT_OF_MEASURE_LABELS: Record<ApUnitOfMeasure, string> = {
  unit: 'Unit',
  piece: 'Piece',
  set: 'Set',
  box: 'Box',
  pack: 'Pack',
  carton: 'Carton',
  kg: 'KG',
  litre: 'Litre',
  meter: 'Meter',
  hour: 'Hour',
  day: 'Day',
  month: 'Month',
  service: 'Service',
};

export type ApTaxCode = 'sr' | 'zr' | 'es' | 'os';

export const AP_TAX_CODES: Record<ApTaxCode, number> = {
  sr: 6,
  zr: 0,
  es: 0,
  os: 0,
};

export type PrfType = 'payment_request' | 'claim' | 'others';

export const PRF_TYPE_LABELS: Record<PrfType, string> = {
  payment_request: 'Payment Request',
  claim: 'Claim',
  others: 'Others',
};

export interface PurchaseRequisitionItem {
  id: string;
  prf_id: string;
  doc_date: string | null;
  description: string;
  gl_account_id: string;
  quantity: number;
  unit: ApUnitOfMeasure;
  unit_price: number;
  amount: number;
  project_id: string | null;
  project_site: string | null;
  created_at?: string;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
  project?: Pick<Project, 'id' | 'project_code' | 'project_name'> | null;
}

export interface PurchaseRequisition {
  id: string;
  company_id: string;
  prf_number: string | null;
  requester_id: string;
  prf_type: PrfType;
  prf_type_others: string | null;
  payable_to: string | null;
  payment_via: string | null;
  prf_date: string | null;
  department: string | null;
  priority: 'normal' | 'urgent';
  required_by_date: string | null;
  purpose: string | null;
  justification: string | null;
  suggested_supplier_id: string | null;
  quotation_ref: string | null;
  total_amount: number;
  advance_date_received: string | null;
  advance_form_no: string | null;
  advance_amount: number;
  refund_reimburse_amount: number;
  management_remarks: string | null;
  chk_invoice: boolean;
  chk_purchase_order: boolean;
  chk_delivery_order: boolean;
  chk_purchase_req_form: boolean;
  chk_quotation: boolean;
  chk_work_order: boolean;
  chk_letter: boolean;
  chk_memo: boolean;
  chk_others: boolean;
  chk_others_text: string | null;
  accounts_dept_remarks: string | null;
  status: ApPrfStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  rejection_stage: string | null;
  verified_by: string | null;
  verified_at: string | null;
  checked_by: string | null;
  checked_at: string | null;
  created_at?: string;
  updated_at?: string;
  requester?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  suggested_supplier?: Pick<Supplier, 'id' | 'supplier_code' | 'supplier_name'> | null;
  items?: PurchaseRequisitionItem[];
  verified_by_profile?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  checked_by_profile?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
  rejected_by_profile?: {
    id: string;
    employee_id: string;
    full_name: string;
  } | null;
}

export interface ApInvoiceLine {
  id: string;
  ap_invoice_id: string;
  description: string;
  gl_account_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code: ApTaxCode;
  tax_rate: number;
  tax_amount: number;
  project_id: string | null;
  created_at?: string;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
  project?: Pick<Project, 'id' | 'project_code' | 'project_name'> | null;
}

export interface ApInvoice {
  id: string;
  company_id: string;
  invoice_number: string | null;
  supplier_id: string;
  supplier_invoice_no: string | null;
  prf_id: string | null;
  invoice_date: string;
  due_date: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_total: number;
  withholding_tax: number;
  total_amount: number;
  paid_amount: number;
  status: ApInvoiceStatus;
  remarks: string | null;
  journal_entry_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at?: string;
  updated_at?: string;
  supplier?: Pick<Supplier, 'id' | 'supplier_code' | 'supplier_name'> | null;
  prf?: Pick<PurchaseRequisition, 'id' | 'prf_number' | 'purpose'> | null;
  lines?: ApInvoiceLine[];
}

export interface PaymentVoucherAllocation {
  id: string;
  pv_id: string;
  ap_invoice_id: string;
  allocated_amount: number;
  created_at?: string;
  ap_invoice?: Pick<ApInvoice, 'id' | 'invoice_number' | 'total_amount' | 'paid_amount' | 'status'> | null;
}

export interface PaymentVoucherLine {
  id: string;
  pv_id: string;
  line_date: string;
  description: string;
  cheque_no: string | null;
  amount: number;
  sort_order: number;
  created_at?: string;
}

export type PvSourceType = 'payroll_memo' | 'claim_memo';

export interface PaymentVoucher {
  id: string;
  company_id: string;
  pv_number: string | null;
  supplier_id: string | null;
  bank_account_id: string;
  payment_date: string;
  payment_method: ApPaymentMethod;
  payment_method_other: string | null;
  reference_no: string | null;
  pay_to: string | null;
  pay_for: string | null;
  is_recurring: boolean;
  total_amount: number;
  status: ApPvStatus;
  remarks: string | null;
  journal_entry_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  post_to_type: PvPostToType | null;
  source_type: PvSourceType | null;
  source_id: string | null;
  prf_id: string | null;
  attachment_urls: string[];
  checked_at: string | null;
  checked_by: string | null;
  created_at?: string;
  updated_at?: string;
  supplier?: Pick<Supplier, 'id' | 'supplier_code' | 'supplier_name'> | null;
  bank_account?: Pick<BankAccount, 'id' | 'account_code' | 'account_name' | 'bank_name' | 'gl_account_id'> | null;
  allocations?: PaymentVoucherAllocation[];
  lines?: PaymentVoucherLine[];
  purchase_requisition?: { id: string; prf_number: string } | null;
}

export type ArInvoiceStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'posted'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

export const AR_INVOICE_STATUS_LABELS: Record<ArInvoiceStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export type ArReceiptStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'posted' | 'cancelled';

export const AR_RECEIPT_STATUS_LABELS: Record<ArReceiptStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
  cancelled: 'Cancelled',
};

export type ArPaymentMethod = 'cheque' | 'online_transfer' | 'cash' | 'credit_card';

export const AR_PAYMENT_METHOD_LABELS: Record<ArPaymentMethod, string> = {
  cheque: 'Cheque',
  online_transfer: 'Online Transfer',
  cash: 'Cash',
  credit_card: 'Credit Card',
};

export type ArTaxCode = 'sr' | 'zr' | 'es' | 'os';

export const AR_TAX_CODES: Record<ArTaxCode, number> = {
  sr: 6,
  zr: 0,
  es: 0,
  os: 0,
};

export interface ArInvoiceLine {
  id: string;
  ar_invoice_id: string;
  description: string;
  gl_account_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code: ArTaxCode;
  tax_rate: number;
  tax_amount: number;
  project_id: string | null;
  created_at?: string;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
  project?: Pick<Project, 'id' | 'project_code' | 'project_name'> | null;
}

export interface ArInvoice {
  id: string;
  company_id: string;
  invoice_number: string | null;
  customer_id: string;
  sales_order_ref: string | null;
  invoice_date: string;
  due_date: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  paid_amount: number;
  status: ArInvoiceStatus;
  remarks: string | null;
  journal_entry_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at?: string;
  updated_at?: string;
  customer?: Pick<Customer, 'id' | 'customer_code' | 'customer_name'> | null;
  lines?: ArInvoiceLine[];
}

export interface OfficialReceiptAllocation {
  id: string;
  or_id: string;
  ar_invoice_id: string;
  allocated_amount: number;
  created_at?: string;
  ar_invoice?: Pick<ArInvoice, 'id' | 'invoice_number' | 'total_amount' | 'paid_amount' | 'status'> | null;
}

export interface OfficialReceipt {
  id: string;
  company_id: string;
  receipt_number: string | null;
  customer_id: string | null;
  received_from: string | null;
  bank_account_id: string;
  receipt_date: string;
  payment_method: ArPaymentMethod;
  reference_no: string | null;
  total_amount: number;
  status: ArReceiptStatus;
  remarks: string | null;
  journal_entry_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at?: string;
  updated_at?: string;
  customer?: Pick<Customer, 'id' | 'customer_code' | 'customer_name'> | null;
  bank_account?: Pick<BankAccount, 'id' | 'account_code' | 'account_name' | 'bank_name' | 'gl_account_id'> | null;
  allocations?: OfficialReceiptAllocation[];
}

// AP Debit/Credit Notes
export type ApDcnType = 'debit_note' | 'credit_note';
export type ApDcnStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'posted' | 'cancelled';

export const AP_DCN_TYPE_LABELS: Record<ApDcnType, string> = {
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
};
export const AP_DCN_STATUS_LABELS: Record<ApDcnStatus, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', posted: 'Posted', cancelled: 'Cancelled',
};

export interface ApDebitCreditNote {
  id: string;
  company_id: string;
  note_number: string | null;
  note_type: ApDcnType;
  supplier_id: string;
  ap_invoice_id: string | null;
  note_date: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  reason: string | null;
  status: ApDcnStatus;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: ApDcnLine[];
  supplier?: { id: string; supplier_code: string; supplier_name: string } | null;
  ap_invoice?: { id: string; invoice_number: string; total_amount: number } | null;
}

export interface ApDcnLine {
  id: string;
  ap_dcn_id: string;
  description: string;
  gl_account_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code: string;
  tax_rate: number;
  tax_amount: number;
  project_id: string | null;
  sort_order: number;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
}

// AR Debit/Credit Notes
export type ArDcnType = 'debit_note' | 'credit_note';
export type ArDcnStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'posted' | 'cancelled';

export const AR_DCN_TYPE_LABELS: Record<ArDcnType, string> = {
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
};
export const AR_DCN_STATUS_LABELS: Record<ArDcnStatus, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', posted: 'Posted', cancelled: 'Cancelled',
};

export interface ArDebitCreditNote {
  id: string;
  company_id: string;
  note_number: string | null;
  note_type: ArDcnType;
  customer_id: string;
  ar_invoice_id: string | null;
  note_date: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  reason: string | null;
  status: ArDcnStatus;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: ArDcnLine[];
  customer?: { id: string; customer_code: string; customer_name: string } | null;
  ar_invoice?: { id: string; invoice_number: string; total_amount: number } | null;
}

export interface ArDcnLine {
  id: string;
  ar_dcn_id: string;
  description: string;
  gl_account_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code: string;
  tax_rate: number;
  tax_amount: number;
  project_id: string | null;
  sort_order: number;
  gl_account?: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name'> | null;
}

// Bank Reconciliation

export type BankReconciliationStatus = 'in_progress' | 'completed';

export const BANK_RECONCILIATION_STATUS_LABELS: Record<BankReconciliationStatus, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
};

export interface BankReconciliation {
  id: string;
  company_id: string;
  bank_account_id: string;
  statement_date: string;
  statement_balance: number;
  reconciled_balance: number;
  difference: number;
  status: BankReconciliationStatus;
  completed_at: string | null;
  created_at: string;
  bank_account?: Pick<BankAccount, 'id' | 'account_code' | 'account_name' | 'bank_name'> | null;
}

export interface BankReconciliationItem {
  id: string;
  reconciliation_id: string;
  journal_entry_line_id: string;
  is_reconciled: boolean;
  reconciled_at: string | null;
  // Joined from journal_entry_lines + journal_entries:
  entry_date?: string;
  entry_number?: string;
  description?: string;
  reference_type?: string;
  debit_amount?: number;
  credit_amount?: number;
}
