import { describe, it, expect } from 'vitest';
import { getClaimCyclePeriod, getOtCyclePeriod, isSubmissionOpen } from '@/lib/submissionCycles';

describe('getClaimCyclePeriod', () => {
  it('returns Jan cycle: Jan 1 - Feb 9 for claim_date in Jan', () => {
    const result = getClaimCyclePeriod('2026-01-15');
    expect(result.start).toBe('2026-01-01');
    expect(result.end).toBe('2026-02-09');
  });

  it('returns Feb cycle: Feb 10 - Mar 9 for claim_date Feb 15', () => {
    const result = getClaimCyclePeriod('2026-02-15');
    expect(result.start).toBe('2026-02-10');
    expect(result.end).toBe('2026-03-09');
  });

  it('returns Mar cycle: Mar 10 - Apr 9 for claim_date Mar 20', () => {
    const result = getClaimCyclePeriod('2026-03-20');
    expect(result.start).toBe('2026-03-10');
    expect(result.end).toBe('2026-04-09');
  });

  it('returns Dec cycle: Dec 10 - Jan 9 for claim_date Dec 25', () => {
    const result = getClaimCyclePeriod('2026-12-25');
    expect(result.start).toBe('2026-12-10');
    expect(result.end).toBe('2027-01-09');
  });

  it('claim_date Feb 5 belongs to Jan cycle (Jan 1 - Feb 9)', () => {
    const result = getClaimCyclePeriod('2026-02-05');
    expect(result.start).toBe('2026-01-01');
    expect(result.end).toBe('2026-02-09');
  });

  it('claim_date Mar 5 belongs to Feb cycle (Feb 10 - Mar 9)', () => {
    const result = getClaimCyclePeriod('2026-03-05');
    expect(result.start).toBe('2026-02-10');
    expect(result.end).toBe('2026-03-09');
  });
});

describe('getOtCyclePeriod', () => {
  it('returns full calendar month for Jan', () => {
    const result = getOtCyclePeriod('2026-01-15');
    expect(result.start).toBe('2026-01-01');
    expect(result.end).toBe('2026-01-31');
  });

  it('handles Feb correctly (non-leap year 2026)', () => {
    const result = getOtCyclePeriod('2026-02-10');
    expect(result.start).toBe('2026-02-01');
    expect(result.end).toBe('2026-02-28');
  });
});

describe('isSubmissionOpen', () => {
  it('allows submission within the cycle window', () => {
    expect(isSubmissionOpen('2026-01-15', '2026-02-01')).toBe(true);
  });

  it('blocks submission after cycle closes', () => {
    expect(isSubmissionOpen('2026-01-15', '2026-02-10')).toBe(false);
  });

  it('allows submission on the last day of cycle', () => {
    expect(isSubmissionOpen('2026-01-15', '2026-02-09')).toBe(true);
  });

  it('allows submission for current month claims within cycle', () => {
    expect(isSubmissionOpen('2026-02-12', '2026-02-12')).toBe(true);
  });
});
