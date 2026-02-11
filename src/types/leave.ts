export type LeaveRequestStatus =
  | 'pending_supervisor'
  | 'supervisor_approved'
  | 'pending_hr'
  | 'hr_approved'
  | 'pending_management'
  | 'management_approved'
  | 'rejected'
  | 'cancelled';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  default_days: number;
  is_half_day_allowed: boolean;
  requires_attachment: boolean;
  is_paid: boolean;
  max_days: number | null;
  is_carry_forward: boolean;
  max_carry_forward: number;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  carried_forward: number;
  adjustment: number;
  remaining: number;
  leave_type?: LeaveType;
}

export interface LeaveRequest {
  id: string;
  ticket_number: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  half_day_period: 'morning' | 'afternoon' | null;
  total_days: number;
  reason: string | null;
  attachment_urls: string[];
  status: LeaveRequestStatus;
  supervisor_id: string | null;
  supervisor_approved_at: string | null;
  supervisor_remarks: string | null;
  hr_id: string | null;
  hr_approved_at: string | null;
  hr_remarks: string | null;
  management_id: string | null;
  management_approved_at: string | null;
  management_remarks: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_remarks: string | null;
  rejection_stage: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    department_id?: string;
    departments?: { name: string };
  };
  leave_type?: LeaveType;
}

export const LEAVE_STATUS_TRANSITIONS = [
  { from: 'pending_supervisor', to: 'supervisor_approved', role: 'supervisor' },
  { from: 'pending_supervisor', to: 'rejected', role: 'supervisor' },
  { from: 'pending_hr', to: 'hr_approved', role: 'hr' },
  { from: 'pending_hr', to: 'rejected', role: 'hr' },
  { from: 'supervisor_approved', to: 'hr_approved', role: 'hr' },
  { from: 'supervisor_approved', to: 'rejected', role: 'hr' },
  { from: 'hr_approved', to: 'management_approved', role: 'management' },
  { from: 'hr_approved', to: 'rejected', role: 'management' },
  { from: 'pending_management', to: 'management_approved', role: 'management' },
  { from: 'pending_management', to: 'rejected', role: 'management' },
] as const;

export function canTransitionLeave(from: string, to: string, role: string): boolean {
  return LEAVE_STATUS_TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role,
  );
}
