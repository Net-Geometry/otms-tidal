/**
 * OT Workflow Service
 * 
 * Provides validation logic and state management for OT request workflow,
 * including supervisor confirmation, verification, HR approval, and management review.
 */

import { OTRequest, OTStatus, VALID_CONFIRMATION_TRANSITIONS } from '@/types/otms';

/**
 * Validation result for status transitions
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates if a supervisor can confirm an OT request
 * 
 * @param request - The OT request to validate
 * @param userId - The ID of the supervisor attempting to confirm
 * @returns Validation result with success status and error message if invalid
 */
export function validateConfirmationTransition(
  request: OTRequest,
  userId: string
): ValidationResult {
  // Check if request is in the correct status for confirmation
  if (request.status !== 'pending_supervisor_confirmation') {
    return {
      valid: false,
      error: `Request must be in 'pending_supervisor_confirmation' status. Current status: ${request.status}`,
    };
  }

  // Check if the supervisor is authorized for this request
  if (request.supervisor_id !== userId) {
    return {
      valid: false,
      error: 'You are not authorized to confirm this request. Only the assigned supervisor can confirm.',
    };
  }

  // Check if request has already been confirmed
  if (request.supervisor_confirmation_at) {
    return {
      valid: false,
      error: 'This request has already been confirmed.',
    };
  }

  return { valid: true };
}

/**
 * Checks if an OT request is a legacy request (bypasses confirmation)
 * Legacy requests are those that were verified before the confirmation workflow was introduced
 * 
 * @param request - The OT request to check
 * @returns true if request is legacy and should bypass confirmation
 */
export function isLegacyRequest(request: OTRequest): boolean {
  // Legacy requests have supervisor_verified status and no confirmation timestamp
  return (
    request.status === 'supervisor_verified' &&
    request.supervisor_confirmation_at === null
  );
}

/**
 * Validates if a status transition is allowed for a given role
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
  // Check if transition is in the valid transitions list
  const validTransition = VALID_CONFIRMATION_TRANSITIONS.find(
    (t) => t.from === fromStatus && t.to === toStatus && t.role === role
  );

  if (validTransition) {
    return { valid: true };
  }

  // Check other common valid transitions (not just confirmation-specific)
  const commonTransitions: Record<string, OTStatus[]> = {
    supervisor: ['pending_verification', 'pending_supervisor_confirmation', 'rejected'],
    hr: ['supervisor_confirmed', 'hr_certified', 'rejected'],
    management: ['hr_certified', 'management_approved', 'pending_hr_recertification'],
  };

  const allowedStatuses = commonTransitions[role] || [];
  if (allowedStatuses.includes(toStatus)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Invalid status transition from '${fromStatus}' to '${toStatus}' for role '${role}'`,
  };
}

/**
 * Validates remarks length
 * 
 * @param remarks - The remarks to validate
 * @param maxLength - Maximum allowed length (default 500)
 * @returns Validation result
 */
export function validateRemarks(
  remarks: string | undefined,
  maxLength: number = 500
): ValidationResult {
  if (!remarks) {
    return { valid: true };
  }

  if (remarks.length > maxLength) {
    return {
      valid: false,
      error: `Remarks cannot exceed ${maxLength} characters. Current length: ${remarks.length}`,
    };
  }

  return { valid: true };
}

/**
 * Validates a batch of request IDs for confirmation
 * 
 * @param requests - Array of OT requests to validate
 * @param userId - ID of the supervisor attempting confirmation
 * @returns Validation result with array of errors if any
 */
export function validateBatchConfirmation(
  requests: OTRequest[],
  userId: string
): ValidationResult & { errors?: Array<{ requestId: string; error: string }> } {
  const errors: Array<{ requestId: string; error: string }> = [];

  requests.forEach((request) => {
    const validation = validateConfirmationTransition(request, userId);
    if (!validation.valid && validation.error) {
      errors.push({
        requestId: request.id,
        error: validation.error,
      });
    }
  });

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Validation failed for ${errors.length} request(s)`,
      errors,
    };
  }

  return { valid: true };
}
