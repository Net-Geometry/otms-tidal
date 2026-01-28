/**
 * OT Submission Validation Utilities
 * Handles validation for overtime submission deadlines with a 7-day window restriction
 */

/**
 * Checks if a given date is allowed for OT submission
 *
 * Rules:
 * - Cannot submit for future dates
 * - Can only submit for dates within the last 8 days (from 8 days ago to today inclusive)
 *
 * @param otDate - The date the OT was worked
 * @param currentDate - The current date (defaults to today)
 * @param cutoffDay - Deprecated parameter (kept for backward compatibility, not used)
 * @returns Object with { isAllowed: boolean, message?: string }
 */
export function canSubmitOTForDate(
  otDate: Date,
  currentDate: Date = new Date(),
  cutoffDay: number = 10,
  gracePeriodEnabled: boolean = false
): { isAllowed: boolean; message?: string } {
  // Normalize dates to start of day for consistent comparison
  const ot = new Date(otDate);
  ot.setHours(0, 0, 0, 0);

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const currentDayOfMonth = today.getDate();
  const otMonth = ot.getMonth();
  const otYear = ot.getFullYear();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Cannot submit future dates
  if (ot > today) {
    return {
      isAllowed: false,
      message: "Cannot submit OT for future dates",
    };
  }

  // Grace Period Mode: allow any past date
  if (gracePeriodEnabled) {
    return { isAllowed: true };
  }

  // Check if OT date is within the last 8 days
  const eightDaysAgo = new Date(today);
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  if (ot < eightDaysAgo) {
    return {
      isAllowed: false,
      message: "OT can only be submitted for work done within the last 8 days",
    };
  }

  return { isAllowed: true };
}

/**
 * Validates a date range for OT submission (start and end dates)
 * Both dates must be valid for submission
 *
 * @param startDate - Start date of OT period
 * @param endDate - End date of OT period
 * @param currentDate - The current date
 * @param cutoffDay - The day of month for cutoff
 * @returns Object with { isAllowed: boolean, message?: string }
 */
export function canSubmitOTForDateRange(
  startDate: Date,
  endDate: Date,
  currentDate: Date = new Date(),
  cutoffDay: number = 10
): { isAllowed: boolean; message?: string } {
  const startValidation = canSubmitOTForDate(startDate, currentDate, cutoffDay);
  if (!startValidation.isAllowed) {
    return startValidation;
  }

  const endValidation = canSubmitOTForDate(endDate, currentDate, cutoffDay);
  if (!endValidation.isAllowed) {
    return endValidation;
  }

  return { isAllowed: true };
}

/**
 * Gets a list of months that are currently allowed for OT submission
 * Useful for UI filtering of available months
 *
 * @param currentDate - The current date
 * @param cutoffDay - The day of month for cutoff
 * @param monthsToInclude - How many months back to check (default: 12)
 * @returns Array of { year: number, month: number, isAllowed: boolean, monthName: string }
 */
export function getAllowedSubmissionMonths(
  currentDate: Date = new Date(),
  cutoffDay: number = 10,
  monthsToInclude: number = 12
): Array<{ year: number; month: number; isAllowed: boolean; monthName: string }> {
  const result: Array<{ year: number; month: number; isAllowed: boolean; monthName: string }> = [];
  const today = new Date(currentDate);
  const currentDayOfMonth = today.getDate();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  for (let i = 0; i < monthsToInclude; i++) {
    const checkDate = new Date(today);
    checkDate.setMonth(checkDate.getMonth() - i);

    const year = checkDate.getFullYear();
    const month = checkDate.getMonth();

    let isAllowed = false;

    // Current month is always allowed (though with 8-day lookback)
    if (
      i === 0 &&
      year === today.getFullYear() &&
      month === today.getMonth()
    ) {
      isAllowed = true;
    }
    // Previous months are allowed only if we're on/before cutoff day
    else if (i > 0 && currentDayOfMonth <= cutoffDay) {
      isAllowed = true;
    }

    result.push({
      year,
      month: month + 1, // JavaScript months are 0-indexed
      isAllowed,
      monthName: monthNames[month],
    });
  }

  return result;
}

/**
 * Gets a formatted message explaining the current submission rules
 *
 * @param cutoffDay - The day of month for cutoff
 * @returns Formatted string explaining the rules
 */
export function getSubmissionRuleMessage(cutoffDay: number = 10): string {
  return `OT submissions follow these rules:\n` +
    `• Current month: Can be submitted within 8 days of the date worked\n` +
    `• Previous months: Can be submitted until the ${cutoffDay}th of the current month\n` +
    `• Older months: Cannot be submitted`;
}
