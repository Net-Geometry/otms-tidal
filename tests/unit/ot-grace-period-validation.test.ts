import { describe, it, expect } from 'vitest';
import { canSubmitOTForDate } from '@/utils/otValidation';

describe('Grace Period Mode Validation', () => {
  describe('canSubmitOTForDate with gracePeriodEnabled', () => {
    const today = new Date('2026-01-28');

    describe('when grace period is DISABLED (default behavior)', () => {
      it('should reject dates older than 8 days', () => {
        const oldDate = new Date('2026-01-15'); // 13 days ago
        const result = canSubmitOTForDate(oldDate, today, 10, false);

        expect(result.isAllowed).toBe(false);
        expect(result.message).toContain('within the last 8 days');
      });

      it('should allow dates within the 8-day window', () => {
        const recentDate = new Date('2026-01-25'); // 3 days ago
        const result = canSubmitOTForDate(recentDate, today, 10, false);

        expect(result.isAllowed).toBe(true);
        expect(result.message).toBeUndefined();
      });

      it('should allow today', () => {
        const result = canSubmitOTForDate(today, today, 10, false);

        expect(result.isAllowed).toBe(true);
      });

      it('should reject future dates', () => {
        const futureDate = new Date('2026-01-30');
        const result = canSubmitOTForDate(futureDate, today, 10, false);

        expect(result.isAllowed).toBe(false);
        expect(result.message).toContain('future dates');
      });

      it('should allow date exactly 8 days ago', () => {
        const eightDaysAgo = new Date('2026-01-20');
        const result = canSubmitOTForDate(eightDaysAgo, today, 10, false);

        expect(result.isAllowed).toBe(true);
      });

      it('should reject date 9 days ago', () => {
        const nineDaysAgo = new Date('2026-01-19');
        const result = canSubmitOTForDate(nineDaysAgo, today, 10, false);

        expect(result.isAllowed).toBe(false);
      });
    });

    describe('when grace period is ENABLED', () => {
      it('should allow dates older than 8 days', () => {
        const oldDate = new Date('2026-01-15'); // 13 days ago
        const result = canSubmitOTForDate(oldDate, today, 10, true);

        expect(result.isAllowed).toBe(true);
        expect(result.message).toBeUndefined();
      });

      it('should allow dates from previous months', () => {
        const lastMonth = new Date('2025-12-15'); // Previous month
        const result = canSubmitOTForDate(lastMonth, today, 10, true);

        expect(result.isAllowed).toBe(true);
      });

      it('should allow dates from many months ago', () => {
        const oldDate = new Date('2025-06-01'); // 7+ months ago
        const result = canSubmitOTForDate(oldDate, today, 10, true);

        expect(result.isAllowed).toBe(true);
      });

      it('should still reject future dates even with grace period enabled', () => {
        const futureDate = new Date('2026-01-30');
        const result = canSubmitOTForDate(futureDate, today, 10, true);

        expect(result.isAllowed).toBe(false);
        expect(result.message).toContain('future dates');
      });

      it('should allow today', () => {
        const result = canSubmitOTForDate(today, today, 10, true);

        expect(result.isAllowed).toBe(true);
      });

      it('should allow recent dates within the normal window', () => {
        const recentDate = new Date('2026-01-25');
        const result = canSubmitOTForDate(recentDate, today, 10, true);

        expect(result.isAllowed).toBe(true);
      });
    });

    describe('gracePeriodEnabled parameter defaults', () => {
      it('should default to false when not provided', () => {
        const oldDate = new Date('2026-01-10'); // 18 days ago
        const result = canSubmitOTForDate(oldDate, today, 10);

        expect(result.isAllowed).toBe(false);
        expect(result.message).toContain('within the last 8 days');
      });
    });

    describe('edge cases', () => {
      it('should handle date at midnight correctly', () => {
        const dateAtMidnight = new Date('2026-01-25T00:00:00.000Z');
        const result = canSubmitOTForDate(dateAtMidnight, today, 10, false);

        expect(result.isAllowed).toBe(true);
      });

      it('should handle date with time component correctly', () => {
        const dateWithTime = new Date('2026-01-25T15:30:00.000Z');
        const result = canSubmitOTForDate(dateWithTime, today, 10, false);

        expect(result.isAllowed).toBe(true);
      });

      it('should handle year boundary with grace period enabled', () => {
        const lastYear = new Date('2025-01-01');
        const result = canSubmitOTForDate(lastYear, today, 10, true);

        expect(result.isAllowed).toBe(true);
      });
    });
  });
});
