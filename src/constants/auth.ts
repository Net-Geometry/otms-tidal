/**
 * Default temporary password for newly created employees
 * Employees must change this password on their first login
 *
 * Update this constant in the following places if changed:
 * - src/constants/auth.ts (this file)
 * - supabase/functions/invite-employee/index.ts
 * - src/pages/SetupPassword.tsx
 * - src/pages/ChangePassword.tsx
 * - src/hooks/hr/useInviteEmployee.ts
 * - src/pages/Auth.tsx
 */
export const TEMP_PASSWORD = 'Temp@12345';

/**
 * Requirements for new passwords
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: false, // Supabase handles this via auth
  requireNumbers: false,    // Supabase handles this via auth
  requireSpecialChars: false, // Supabase handles this via auth
} as const;
