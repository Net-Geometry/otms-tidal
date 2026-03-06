export interface CyclePeriod {
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
}

/** Pad a number to 2 digits */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format a Date as yyyy-mm-dd */
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Get last day of a given month (1-indexed month, but we use Date trick) */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the claim submission cycle that contains the given claim date.
 *
 * Rules:
 * - January claims: Jan 1 – Feb 9
 * - If claim_date is between 1st–9th of month (month > Jan): belongs to previous month's cycle
 * - If claim_date is between 10th–last day: belongs to current month's cycle (10th – next month 9th)
 */
export function getClaimCyclePeriod(claimDate: string): CyclePeriod {
  const d = new Date(claimDate + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  const day = d.getDate();

  // January claim dates always belong to the January cycle
  if (month === 1) {
    return {
      start: `${year}-01-01`,
      end: `${year}-02-09`,
    };
  }

  // Days 1-9: belongs to previous month's cycle
  if (day <= 9) {
    const prevMonth = month - 1;
    if (prevMonth === 1) {
      // Previous month is January — special case
      return {
        start: `${year}-01-01`,
        end: `${year}-02-09`,
      };
    }
    // Previous month's cycle: prevMonth 10th – current month 9th
    return {
      start: `${year}-${pad(prevMonth)}-10`,
      end: `${year}-${pad(month)}-09`,
    };
  }

  // Days 10+: current month's cycle (10th – next month 9th)
  if (month === 12) {
    return {
      start: `${year}-12-10`,
      end: `${year + 1}-01-09`,
    };
  }

  return {
    start: `${year}-${pad(month)}-10`,
    end: `${year}-${pad(month + 1)}-09`,
  };
}

/**
 * Returns the full calendar month period for an OT date.
 */
export function getOtCyclePeriod(otDate: string): CyclePeriod {
  const d = new Date(otDate + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const last = lastDayOfMonth(year, month);

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(last)}`,
  };
}

/**
 * Checks whether a submission date falls within (or before the end of)
 * the claim cycle for the given claim date.
 */
export function isSubmissionOpen(claimDate: string, submissionDate: string): boolean {
  const cycle = getClaimCyclePeriod(claimDate);
  return submissionDate <= cycle.end;
}
