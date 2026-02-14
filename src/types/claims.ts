export type ClaimRequestStatus =
  | 'pending_supervisor'
  | 'supervisor_approved'
  | 'pending_hr'
  | 'hr_approved'
  | 'pending_finance'
  | 'pending_director'
  | 'pending_gm'
  | 'pending_head_finance'
  | 'finance_approved'
  | 'director_approved'
  | 'gm_approved'
  | 'head_finance_approved'
  | 'rejected'
  | 'cancelled';

export type ClaimFinalApprover = 'hr' | 'finance' | 'director' | 'gm' | 'head_finance' | 'assistant';

// Next approver options after finance review
export type NextApproverOption = 'director' | 'gm' | 'head_finance' | 'final_approve';

export interface ClaimType {
  id: string;
  code: string;
  name: string;
  final_approver: ClaimFinalApprover;
  final_approver_user_id?: string | null;
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
  // Approver profiles
  supervisor_profile?: {
    id: string;
    full_name: string;
  } | null;
  hr_profile?: {
    id: string;
    full_name: string;
  } | null;
  finance_profile?: {
    id: string;
    full_name: string;
  } | null;
  director_profile?: {
    id: string;
    full_name: string;
  } | null;
  gm_profile?: {
    id: string;
    full_name: string;
  } | null;
  head_finance_profile?: {
    id: string;
    full_name: string;
  } | null;
}

/**
 * Transition list is intentionally permissive for HR branching.
 * The actual HR target depends on `claim_type.final_approver`:
 * - `hr` routes to `hr_approved`
 * - `finance` routes to `pending_finance`
 * Hooks enforce the final target per claim type before updating.
 */
export const CLAIM_STATUS_TRANSITIONS = [
  { from: 'pending_supervisor', to: 'supervisor_approved', role: 'supervisor' },
  { from: 'pending_supervisor', to: 'rejected', role: 'supervisor' },

  // HR always forwards to finance for review
  { from: 'pending_hr', to: 'pending_finance', role: 'hr' },
  { from: 'pending_hr', to: 'rejected', role: 'hr' },

  { from: 'supervisor_approved', to: 'pending_finance', role: 'hr' },
  { from: 'supervisor_approved', to: 'rejected', role: 'hr' },

  // Finance can forward to next approver or finalize
  { from: 'pending_finance', to: 'pending_director', role: 'finance' },
  { from: 'pending_finance', to: 'pending_gm', role: 'finance' },
  { from: 'pending_finance', to: 'pending_head_finance', role: 'finance' },
  { from: 'pending_finance', to: 'finance_approved', role: 'finance' },
  { from: 'pending_finance', to: 'rejected', role: 'finance' },

  // Final approvers
  { from: 'pending_director', to: 'director_approved', role: 'director' },
  { from: 'pending_director', to: 'rejected', role: 'director' },

  { from: 'pending_gm', to: 'gm_approved', role: 'gm' },
  { from: 'pending_gm', to: 'rejected', role: 'gm' },

  { from: 'pending_head_finance', to: 'head_finance_approved', role: 'head_finance' },
  { from: 'pending_head_finance', to: 'rejected', role: 'head_finance' },
] as const;

export function canTransitionClaim(from: string, to: string, role: string): boolean {
  return CLAIM_STATUS_TRANSITIONS.some((t) => t.from === from && t.to === to && t.role === role);
}

// Tidal spec status labels
export const CLAIM_STATUS_LABELS: Record<ClaimRequestStatus, string> = {
  pending_supervisor: 'Pending',
  supervisor_approved: 'Checked',
  pending_hr: 'Pending Review',
  hr_approved: 'Reviewed',
  pending_finance: 'Pending Finance',
  pending_director: 'Pending Director',
  pending_gm: 'Pending GM',
  pending_head_finance: 'Pending Head of Finance',
  finance_approved: 'Finance Approved',
  director_approved: 'Director Approved',
  gm_approved: 'GM Approved',
  head_finance_approved: 'Head Finance Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

// Get display label for claim status with approver info
export function getClaimStatusDisplay(status: ClaimRequestStatus, approverName?: string | null): string {
  const baseLabel = CLAIM_STATUS_LABELS[status];
  if (approverName && (status === 'supervisor_approved' || status === 'hr_approved' || status === 'finance_approved')) {
    return `${baseLabel} by ${approverName}`;
  }
  return baseLabel;
}

// Statuses that are considered fully approved
export const CLAIM_FINAL_APPROVED_STATUSES: ClaimRequestStatus[] = [
  'finance_approved',
  'director_approved',
  'gm_approved',
  'head_finance_approved',
];

// Check if claim is in final approved state
export function isClaimFullyApproved(status: ClaimRequestStatus): boolean {
  return CLAIM_FINAL_APPROVED_STATUSES.includes(status);
}

// Get approver name based on status
export function getClaimApproverName(claim: Claim): string | null {
  if (claim.status === 'supervisor_approved' && claim.supervisor_profile?.full_name) {
    return claim.supervisor_profile.full_name;
  }
  if (claim.status === 'hr_approved' && claim.hr_profile?.full_name) {
    return claim.hr_profile.full_name;
  }
  if ((claim.status === 'finance_approved' || claim.status.startsWith('pending_')) && claim.finance_profile?.full_name) {
    return claim.finance_profile.full_name;
  }
  if (claim.status === 'director_approved' && claim.director_profile?.full_name) {
    return claim.director_profile.full_name;
  }
  if (claim.status === 'gm_approved' && claim.gm_profile?.full_name) {
    return claim.gm_profile.full_name;
  }
  if (claim.status === 'head_finance_approved' && claim.head_finance_profile?.full_name) {
    return claim.head_finance_profile.full_name;
  }
  return null;
}
