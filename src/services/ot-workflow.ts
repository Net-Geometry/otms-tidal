/**
 * OT Workflow Service
 *
 * Provides validation logic for OT request workflow state transitions,
 * supporting both Route A (direct supervisor) and Route B (respective supervisor) flows.
 */

import { OTRequest, OTStatus, VALID_CONFIRMATION_TRANSITIONS, canTransition } from '@/types/otms';

/**
 * Validation result for workflow transitions
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates if a supervisor can approve a Route A request
 * Status: pending_verification → supervisor_confirmed
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the supervisor attempting approval
 * @returns Validation result
 */
export function validateSupervisorApproval(
  request: OTRequest,
  userId: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'pending_verification') {
    return {
      valid: false,
      error: `Request must be in 'pending_verification' status. Current status: ${request.status}`,
    };
  }

  // Check if the supervisor is authorized
  if (request.supervisor_id !== userId) {
    return {
      valid: false,
      error: 'You are not authorized to approve this request. Only the assigned supervisor can approve.',
    };
  }

  // Verify transition is allowed
  if (!canTransition(request.status, 'supervisor_confirmed', 'supervisor')) {
    return {
      valid: false,
      error: 'This approval action is not allowed at this time.',
    };
  }

  return { valid: true };
}

/**
 * Validates if a supervisor can confirm a respective supervisor approval (Route B)
 * Status: pending_respective_supervisor_confirmation → respective_supervisor_confirmed
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the supervisor attempting confirmation
 * @returns Validation result
 */
export function validateRespectiveSupervisorConfirmation(
  request: OTRequest,
  userId: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'pending_respective_supervisor_confirmation') {
    return {
      valid: false,
      error: `Request must be awaiting respective supervisor confirmation. Current status: ${request.status}`,
    };
  }

  // Check if the respective supervisor is authorized
  if (request.respective_supervisor_id !== userId) {
    return {
      valid: false,
      error: 'You are not authorized to confirm this request. Only the assigned respective supervisor can confirm.',
    };
  }

  // Check if not already confirmed
  if (request.respective_supervisor_confirmed_at) {
    return {
      valid: false,
      error: 'This request has already been confirmed by the respective supervisor.',
    };
  }

  return { valid: true };
}

/**
 * Validates if a supervisor can deny a respective supervisor confirmation (Route B)
 * Status: pending_respective_supervisor_confirmation → rejected
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the supervisor attempting denial
 * @param denialRemarks - The remarks explaining the denial (min 10 chars)
 * @returns Validation result
 */
export function validateRespectiveSupervisorDenial(
  request: OTRequest,
  userId: string,
  denialRemarks?: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'pending_respective_supervisor_confirmation') {
    return {
      valid: false,
      error: `Request must be awaiting respective supervisor confirmation. Current status: ${request.status}`,
    };
  }

  // Check if the respective supervisor is authorized
  if (request.respective_supervisor_id !== userId) {
    return {
      valid: false,
      error: 'You are not authorized to deny this request.',
    };
  }

  // Check if remarks are provided (required for denial)
  if (!denialRemarks || denialRemarks.trim().length < 10) {
    return {
      valid: false,
      error: 'Denial remarks are required and must be at least 10 characters.',
    };
  }

  return { valid: true };
}

/**
 * Validates if a supervisor can verify a Route B request after respective SV confirms
 * Status: pending_supervisor_verification → supervisor_verified
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the supervisor attempting verification
 * @returns Validation result
 */
export function validateSupervisorVerification(
  request: OTRequest,
  userId: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'pending_supervisor_verification') {
    return {
      valid: false,
      error: `Request must be awaiting supervisor verification. Current status: ${request.status}`,
    };
  }

  // Check if the supervisor is authorized
  if (request.supervisor_id !== userId) {
    return {
      valid: false,
      error: 'You are not authorized to verify this request.',
    };
  }

  // Check if respective supervisor has already confirmed
  if (!request.respective_supervisor_confirmed_at) {
    return {
      valid: false,
      error: 'The respective supervisor must confirm before supervisor verification.',
    };
  }

  return { valid: true };
}

/**
 * Validates if HR can certify an OT request
 * Status: supervisor_confirmed or supervisor_verified → hr_certified
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the HR user attempting certification (optional, for audit)
 * @returns Validation result
 */
export function validateHRCertification(
  request: OTRequest,
  userId?: string
): ValidationResult {
  // Check if request is in one of the valid states for HR certification
  if (request.status !== 'supervisor_confirmed' && request.status !== 'supervisor_verified') {
    return {
      valid: false,
      error: `Request must be supervisor confirmed or verified. Current status: ${request.status}`,
    };
  }

  // Check if not already certified
  if (request.hr_approved_at) {
    return {
      valid: false,
      error: 'This request has already been certified by HR.',
    };
  }

  return { valid: true };
}

/**
 * Validates if HR can reject a request and send it back for amendment
 * Status: hr_certified → pending_verification (Route A) or pending_respective_supervisor_confirmation (Route B)
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the HR user attempting rejection (optional, for audit)
 * @returns Validation result with the reset status
 */
export function validateHRRejection(
  request: OTRequest,
  userId?: string
): ValidationResult & { resetStatus?: OTStatus } {
  // Check if request is in the HR certification status
  if (request.status !== 'hr_certified') {
    return {
      valid: false,
      error: `Request must be HR certified to be rejected. Current status: ${request.status}`,
    };
  }

  // Determine the reset status based on the request route
  const resetStatus = request.respective_supervisor_id
    ? 'pending_respective_supervisor_confirmation'
    : 'pending_verification';

  return { valid: true, resetStatus };
}

/**
 * Validates if management can approve a request
 * Status: hr_certified → management_approved
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the management user attempting approval (optional, for audit)
 * @returns Validation result
 */
export function validateManagementApproval(
  request: OTRequest,
  userId?: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'hr_certified') {
    return {
      valid: false,
      error: `Request must be HR certified for management approval. Current status: ${request.status}`,
    };
  }

  return { valid: true };
}

/**
 * Validates if management can reject and send back to HR for recertification
 * Status: management_approved → hr_certified
 *
 * @param request - The OT request to validate
 * @param userId - The ID of the management user attempting rejection (optional, for audit)
 * @returns Validation result
 */
export function validateManagementRejection(
  request: OTRequest,
  userId?: string
): ValidationResult {
  // Check if request is in the correct status
  if (request.status !== 'management_approved') {
    return {
      valid: false,
      error: `Request must be management approved to be rejected. Current status: ${request.status}`,
    };
  }

  return { valid: true };
}

/**
 * Generic status transition validator
 * Uses VALID_CONFIRMATION_TRANSITIONS to determine if a transition is allowed
 *
 * @param fromStatus - Current status of the request
 * @param toStatus - Desired status to transition to
 * @param role - Role attempting the transition
 * @returns Validation result
 */
export function validateStatusTransition(
  fromStatus: OTStatus,
  toStatus: OTStatus,
  role: 'supervisor' | 'hr' | 'management'
): ValidationResult {
  if (!canTransition(fromStatus, toStatus, role)) {
    return {
      valid: false,
      error: `Invalid status transition from '${fromStatus}' to '${toStatus}' for role '${role}'`,
    };
  }

  return { valid: true };
}

/**
 * Validates remarks length and content
 *
 * @param remarks - The remarks to validate
 * @param maxLength - Maximum allowed length (default 500)
 * @param required - Whether remarks are required (default false)
 * @returns Validation result
 */
export function validateRemarks(
  remarks: string | undefined,
  maxLength: number = 500,
  required: boolean = false
): ValidationResult {
  if (!remarks) {
    if (required) {
      return {
        valid: false,
        error: 'Remarks are required for this action.',
      };
    }
    return { valid: true };
  }

  const trimmed = remarks.trim();
  if (trimmed.length === 0 && required) {
    return {
      valid: false,
      error: 'Remarks cannot be empty.',
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Remarks cannot exceed ${maxLength} characters. Current length: ${trimmed.length}`,
    };
  }

  return { valid: true };
}
