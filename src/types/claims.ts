export type ClaimRequestStatus =
  | 'pending_supervisor'
  | 'supervisor_approved'
  | 'pending_hr'
  | 'hr_approved'
  | 'pending_finance'
  | 'finance_approved'
  | 'rejected'
  | 'cancelled';

export type ClaimFinalApprover = 'hr' | 'finance';

export interface ClaimType {
  id: string;
  code: string;
  name: string;
  final_approver: ClaimFinalApprover;
  limit_amount: number | null;
  limit_period: string | null;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Claim {
  id: string;
  ticket_number: string;

  employee_id: string;
  claim_type_id: string;

  claim_date: string; // yyyy-mm-dd
  amount: number;
  purpose: string | null;
  receipt_urls: string[];
  limit_warning: string | null;

  status: ClaimRequestStatus;

  supervisor_id: string | null;
  supervisor_approved_at: string | null;
  supervisor_remarks: string | null;

  hr_id: string | null;
  hr_approved_at: string | null;
  hr_remarks: string | null;

  finance_id: string | null;
  finance_approved_at: string | null;
  finance_remarks: string | null;

  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  rejection_stage: string | null;

  cancelled_at: string | null;
  cancellation_reason: string | null;

  is_posted: boolean;
  posted_at: string | null;
  posted_by: string | null;
  posting_reference: string | null;
  posting_remarks: string | null;

  created_at: string;
  updated_at: string;

  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    department_id?: string;
    departments?: { name: string };
  };
  claim_type?: ClaimType;
}

export const CLAIM_STATUS_TRANSITIONS = [
  { from: 'pending_supervisor', to: 'supervisor_approved', role: 'supervisor' },
  { from: 'pending_supervisor', to: 'rejected', role: 'supervisor' },

  // HR can either finalize (hr_approved) or forward to finance (pending_finance)
  { from: 'pending_hr', to: 'hr_approved', role: 'hr' },
  { from: 'pending_hr', to: 'pending_finance', role: 'hr' },
  { from: 'pending_hr', to: 'rejected', role: 'hr' },

  { from: 'supervisor_approved', to: 'hr_approved', role: 'hr' },
  { from: 'supervisor_approved', to: 'pending_finance', role: 'hr' },
  { from: 'supervisor_approved', to: 'rejected', role: 'hr' },

  { from: 'pending_finance', to: 'finance_approved', role: 'finance' },
  { from: 'pending_finance', to: 'rejected', role: 'finance' },
] as const;
