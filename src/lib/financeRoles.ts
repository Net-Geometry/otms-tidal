import type { AppRole } from '@/types/otms';

/** The specific finance roles (consolidated March 2026) */
export const FINANCE_SPECIFIC_ROLES: AppRole[] = [
  'finance_admin',
  'account_assistant',
  'account_exec',
];

/** All finance roles: legacy 'finance' + 5 specific roles + executive finance roles */
export const ALL_FINANCE_ROLES: AppRole[] = ['finance', ...FINANCE_SPECIFIC_ROLES, 'head_finance'];

/** Check if a single role string is any finance role */
export function isFinanceRole(role: string | null): boolean {
  if (!role) return false;
  return (ALL_FINANCE_ROLES as string[]).includes(role);
}

/** Check if a roles array contains any finance role */
export function hasAnyFinanceRole(roles: AppRole[]): boolean {
  return roles.some((r) => (ALL_FINANCE_ROLES as string[]).includes(r));
}

/** Get the first finance_* role a user has (for activeRole selection) */
export function getFirstFinanceRole(roles: AppRole[]): AppRole | null {
  return roles.find((r) => (ALL_FINANCE_ROLES as string[]).includes(r)) ?? null;
}

/** Human-readable labels for finance roles */
export const FINANCE_ROLE_LABELS: Record<string, string> = {
  finance: 'Finance (Legacy)',
  finance_admin: 'Finance Admin',
  account_assistant: 'Account Assistant',
  account_exec: 'Account Executive',
};
