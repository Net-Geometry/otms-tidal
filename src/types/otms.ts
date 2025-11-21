// DISABLED: Management role removed - OT process now stops at HR approval
export type AppRole = 'employee' | 'supervisor' | 'hr' | 'management' | 'admin';
// Include all database statuses for compatibility
export type OTStatus = 
  | 'pending_verification' 
  | 'verified'
  | 'supervisor_verified' 
  | 'approved'
  | 'hr_certified' 
  | 'bod_approved'
  | 'management_approved' 
  | 'reviewed'
  | 'rejected' 
  | 'pending_hr_recertification' 
  | 'pending_supervisor_confirmation' 
  | 'supervisor_confirmed' 
  | 'pending_respective_supervisor_confirmation' 
  | 'respective_supervisor_confirmed' 
  | 'pending_supervisor_review';
export type DayType = 'weekday' | 'saturday' | 'sunday' | 'public_holiday';

export interface OTRequest {
  id: string;
  ticket_number: string;
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  day_type: DayType;
  reason: string;
  attachment_urls: string[];
  orp: number | null;
  hrp: number | null;
  ot_amount: number | null;
  status: OTStatus;
  supervisor_id: string | null;
  supervisor_verified_at: string | null;
  supervisor_remarks: string | null;
  supervisor_confirmation_at: string | null;
  supervisor_confirmation_remarks: string | null;
  respective_supervisor_id: string | null;
  respective_supervisor_confirmed_at: string | null;
  respective_supervisor_remarks: string | null;
  respective_supervisor_denied_at: string | null;
  respective_supervisor_denial_remarks: string | null;
  hr_id: string | null;
  hr_approved_at: string | null;
  hr_remarks: string | null;
  // DISABLED: Management fields removed - OT process now stops at HR approval
  // management_reviewed_at: string | null;
  // management_remarks: string | null;
  management_reviewed_at?: string | null; // Kept for backward compatibility
  management_remarks?: string | null; // Kept for backward compatibility
  eligibility_rule_id: string | null;
  formula_id: string | null;
  threshold_violations: any;
  parent_request_id: string | null;
  resubmission_count: number;
  rejection_stage: string | null;
  is_resubmission: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    department_id?: string;
    basic_salary?: number;
    departments?: {
      name: string;
    };
  };
}

export interface Position {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  employee_count?: number;
}

export interface OTSession {
  id: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  status?: OTStatus;
  reason?: string;
  attachment_urls?: string[];
}

export interface GroupedOTRequest extends Omit<OTRequest, 'start_time' | 'end_time' | 'total_hours'> {
  sessions: OTSession[];
  total_hours: number;
  request_ids: string[];
}

export interface Profile {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  ic_no: string | null;
  phone_no: string | null;
  company_id: string | null;
  department_id: string | null;
  basic_salary: number;
  epf_no: string | null;
  socso_no: string | null;
  income_tax_no: string | null;
  employment_type: string | null;
  designation: string | null;
  position: string | null;
  position_id: string | null;
  supervisor_id: string | null;
  joining_date: string | null;
  work_location: string | null;
  state: string | null;
  status: string;
  is_ot_eligible: boolean;
  require_ot_attachment?: boolean;
  user_roles?: Array<{ role: AppRole }>;
  company?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string } | null;
  position_obj?: Position | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for confirming OT requests
 * Used in the supervisor confirmation workflow after verification
 */
export interface ConfirmRequestInput {
  /** Array of OT request IDs to confirm (supports batch confirmation) */
  requestIds: string[];
  /** Optional remarks from supervisor during confirmation (max 500 chars recommended) */
  remarks?: string;
}

/**
 * Input type for respective supervisor confirming OT requests
 * Used in the respective supervisor confirmation workflow
 */
export interface ConfirmRespectiveSupervisorInput {
  /** Array of OT request IDs to confirm (supports batch confirmation) */
  requestIds: string[];
  /** Optional remarks from respective supervisor (max 500 chars recommended) */
  remarks?: string;
}

/**
 * Input type for respective supervisor denying OT requests
 * Used when respective supervisor denies the OT confirmation request
 */
export interface DenyRespectiveSupervisorInput {
  /** Array of OT request IDs to deny (supports batch denial) */
  requestIds: string[];
  /** Required remarks explaining why the OT is being denied */
  denialRemarks: string;
}

/**
 * Input type for supervisor requesting respective supervisor confirmation
 * Used when supervisor wants to verify OT with the instructing supervisor
 */
export interface RequestRespectiveSupervisorConfirmationInput {
  /** Array of OT request IDs to request confirmation for */
  requestIds: string[];
}

/**
 * Response type for confirmation mutation
 */
export interface ConfirmRequestResponse {
  success: boolean;
  message: string;
  confirmedIds?: string[];
  error?: string;
}

/**
 * Valid status transitions for supervisor confirmation workflow
 */
export type ConfirmationStatusTransition = {
  from: OTStatus;
  to: OTStatus;
  role: 'supervisor' | 'hr' | 'management';
};

/**
 * Helper type for validation of status transitions
 */
export const VALID_CONFIRMATION_TRANSITIONS: ConfirmationStatusTransition[] = [
  { from: 'pending_supervisor_confirmation', to: 'pending_respective_supervisor_confirmation', role: 'supervisor' },
  { from: 'pending_respective_supervisor_confirmation', to: 'respective_supervisor_confirmed', role: 'supervisor' },
  { from: 'pending_respective_supervisor_confirmation', to: 'pending_supervisor_review', role: 'supervisor' },
  { from: 'pending_supervisor_review', to: 'rejected', role: 'supervisor' },
  { from: 'pending_supervisor_review', to: 'pending_supervisor_confirmation', role: 'supervisor' },
  { from: 'respective_supervisor_confirmed', to: 'pending_supervisor_confirmation', role: 'supervisor' },
  { from: 'respective_supervisor_confirmed', to: 'hr_certified', role: 'hr' },
];