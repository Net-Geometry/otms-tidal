export interface YearsOfServiceResult {
  years: number;
  months: number;
  totalMonths: number;
  display: string; // e.g. "3 years, 2 months"
}

export function calculateYearsOfService(
  joiningDate: string | null | undefined
): YearsOfServiceResult | null {
  if (!joiningDate) return null;

  const join = new Date(joiningDate);
  const now = new Date();

  if (isNaN(join.getTime()) || join > now) return null;

  let years = now.getFullYear() - join.getFullYear();
  let months = now.getMonth() - join.getMonth();

  if (now.getDate() < join.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);

  return {
    years,
    months,
    totalMonths,
    display: parts.length > 0 ? parts.join(', ') : 'Less than a month',
  };
}

/**
 * Get sick leave entitlement based on YOS per Malaysian Employment Act
 * < 2 years: 14 days
 * 2-5 years: 18 days
 * > 5 years: 22 days
 */
export function getSickLeaveEntitlement(
  joiningDate: string | null | undefined
): number {
  const yos = calculateYearsOfService(joiningDate);
  if (!yos) return 14; // default
  if (yos.years < 2) return 14;
  if (yos.years <= 5) return 18;
  return 22;
}
