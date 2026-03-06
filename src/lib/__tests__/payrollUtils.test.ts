/**
 * Unit Tests: payrollUtils pure functions
 * Tests for round2, lookupPcb, lookupSocso, and calculateEmployee
 */

import { describe, it, expect } from 'vitest';
import type { PayrollSettings, SocsoContributionRow } from '@/types/payroll';
import {
  round2,
  lookupPcb,
  lookupSocso,
  calculateEmployee,
  getAgeAtDate,
  PCB_MONTHLY_TABLE,
  type EmployeeProfile,
} from '@/lib/payrollUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<PayrollSettings> = {}): PayrollSettings {
  return {
    id: 1,
    employer_epf_rate: 13,
    employee_epf_rate_below_60: 11,
    employee_epf_rate_above_60: 5.5,
    socso_scheme: 'both',
    eis_employer_rate: 0.2,
    eis_employee_rate: 0.2,
    eis_wage_ceiling: 5000,
    hrdc_rate: 1,
    hrdc_enabled: true,
    working_days_per_month: 26,
    payroll_cutoff_day: 25,
    show_allowance_on_payslip: false,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<EmployeeProfile> = {}): EmployeeProfile {
  return {
    id: 'emp-001',
    basic_salary: 5000,
    is_ot_eligible: true,
    ot_base: null,
    is_director: false,
    director_fee: 0,
    epf_category: 'below_60',
    marital_status: 'single',
    pcb_category: 1,
    company_id: 'company-001',
    joining_date: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeSocsoTable(): SocsoContributionRow[] {
  return [
    {
      id: '1',
      wage_from: 0,
      wage_to: 30,
      employer_first_category: 0.4,
      employee_first_category: 0.1,
      employer_second_category: 0.3,
    },
    {
      id: '2',
      wage_from: 30.01,
      wage_to: 50,
      employer_first_category: 0.7,
      employee_first_category: 0.2,
      employer_second_category: 0.5,
    },
    {
      id: '3',
      wage_from: 1000,
      wage_to: 2000,
      employer_first_category: 14.75,
      employee_first_category: 5.25,
      employer_second_category: 10.75,
    },
    {
      id: '4',
      wage_from: 2000.01,
      wage_to: 3000,
      employer_first_category: 29.65,
      employee_first_category: 10.5,
      employer_second_category: 21.55,
    },
    {
      id: '5',
      wage_from: 3000.01,
      wage_to: 4000,
      employer_first_category: 39.35,
      employee_first_category: 14.75,
      employer_second_category: 28.55,
    },
    {
      id: '6',
      wage_from: 4000.01,
      wage_to: 5000,
      employer_first_category: 49.4,
      employee_first_category: 18.5,
      employer_second_category: 36.9,
    },
    {
      id: '7',
      wage_from: 5000.01,
      wage_to: 6000,
      employer_first_category: 59.1,
      employee_first_category: 21.75,
      employer_second_category: 44.1,
    },
  ];
}

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    // Note: JavaScript floating-point means some .5 midpoints round down
    // e.g. 1.015 * 100 = 101.49999... so Math.round gives 101 -> 1.01
    expect(round2(1.005)).toBe(1);
    expect(round2(1.015)).toBe(1.01); // IEEE 754 representation rounds down
    expect(round2(1.125)).toBe(1.13);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(1.555)).toBe(1.56);
    expect(round2(3.456)).toBe(3.46);
  });

  it('handles integers', () => {
    expect(round2(5)).toBe(5);
    expect(round2(0)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(round2(-1.125)).toBe(-1.12);
    expect(round2(-2.345)).toBe(-2.35);
  });

  it('handles already-rounded values', () => {
    expect(round2(3.14)).toBe(3.14);
    expect(round2(100.00)).toBe(100);
  });

  it('handles very small fractions', () => {
    expect(round2(0.001)).toBe(0);
    expect(round2(0.009)).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// lookupPcb
// ---------------------------------------------------------------------------

describe('lookupPcb', () => {
  it('returns 0 for salary at or below 2500', () => {
    expect(lookupPcb(0)).toBe(0);
    expect(lookupPcb(2000)).toBe(0);
    expect(lookupPcb(2500)).toBe(0);
  });

  it('returns correct PCB for the 3000 bracket', () => {
    expect(lookupPcb(2501)).toBe(13);
    expect(lookupPcb(3000)).toBe(13);
  });

  it('returns correct PCB for mid-range salary (5000)', () => {
    expect(lookupPcb(5000)).toBe(153);
  });

  it('returns correct PCB for 10000 bracket', () => {
    expect(lookupPcb(10000)).toBe(838);
  });

  it('returns correct PCB for high salary (50000)', () => {
    expect(lookupPcb(50000)).toBe(11293);
  });

  it('returns capped PCB for very high salary', () => {
    expect(lookupPcb(200000)).toBe(26293);
    expect(lookupPcb(1000000)).toBe(26293);
  });

  it('handles boundary values correctly', () => {
    // Just above 3000 should hit the 3500 bracket
    expect(lookupPcb(3001)).toBe(43);
    // Exactly 3500 should still be in the 3500 bracket
    expect(lookupPcb(3500)).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// lookupSocso
// ---------------------------------------------------------------------------

describe('lookupSocso', () => {
  const table = makeSocsoTable();

  describe('scheme: both (first category)', () => {
    it('returns correct employer and employee amounts for wage in range', () => {
      const result = lookupSocso(5000, table, 'both');
      expect(result.employer).toBe(49.4);
      expect(result.employee).toBe(18.5);
    });

    it('returns correct amounts for lower wage bracket', () => {
      const result = lookupSocso(1500, table, 'both');
      expect(result.employer).toBe(14.75);
      expect(result.employee).toBe(5.25);
    });

    it('returns zeroes when wage is not in any range', () => {
      const result = lookupSocso(999, table, 'both');
      expect(result.employer).toBe(0);
      expect(result.employee).toBe(0);
    });
  });

  describe('scheme: employment_injury (second category)', () => {
    it('returns employer amount only, employee is 0', () => {
      const result = lookupSocso(5000, table, 'employment_injury');
      expect(result.employer).toBe(36.9);
      expect(result.employee).toBe(0);
    });

    it('returns correct employer amount for lower bracket', () => {
      const result = lookupSocso(1500, table, 'employment_injury');
      expect(result.employer).toBe(10.75);
      expect(result.employee).toBe(0);
    });

    it('returns zeroes when wage is not in any range', () => {
      const result = lookupSocso(999, table, 'employment_injury');
      expect(result.employer).toBe(0);
      expect(result.employee).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateEmployee
// ---------------------------------------------------------------------------

describe('calculateEmployee', () => {
  const socsoTable = makeSocsoTable();

  it('calculates a standard employee correctly', () => {
    const profile = makeProfile({ basic_salary: 5000 });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employee_id).toBe('emp-001');
    expect(result.basic_salary).toBe(5000);
    expect(result.working_days).toBe(26);
    expect(result.days_worked).toBe(26);
    expect(result.is_pro_rated).toBe(false);
    expect(result.pro_rated_salary).toBe(5000);
    expect(result.gross_salary).toBe(5000);

    // EPF: employer 13% of 5000 = 650, employee 11% of 5000 = 550
    expect(result.employer_epf).toBe(650);
    expect(result.employee_epf).toBe(550);

    // SOCSO: wage 5000 falls in 4000.01-5000 bracket
    expect(result.employer_socso).toBe(49.4);
    expect(result.employee_socso).toBe(18.5);

    // EIS: min(5000, 5000) * 0.2% = 10
    expect(result.employer_eis).toBe(10);
    expect(result.employee_eis).toBe(10);

    // HRDC: 5000 * 1% = 50
    expect(result.employer_hrdc).toBe(50);

    // PCB: lookupPcb(5000) = 153
    expect(result.pcb_amount).toBe(153);

    // Total deductions: employee_epf + employee_socso + employee_eis + pcb
    // 550 + 18.5 + 10 + 153 = 731.5
    expect(result.total_deductions).toBe(731.5);

    // Net salary: 5000 - 731.5 = 4268.5
    expect(result.net_salary).toBe(4268.5);

    // Not a director
    expect(result.is_director).toBe(false);
    expect(result.director_fee).toBe(0);
    expect(result.ot_amount).toBe(0);
  });

  it('calculates a pro-rated employee (joined mid-month)', () => {
    // Employee joins on Jan 15, 2026
    // January has 31 days, remaining = 31 - 15 + 1 = 17 days
    // daysWorked = round2((17/31) * 26) = round2(14.258...) = 14.26
    const profile = makeProfile({
      basic_salary: 3000,
      joining_date: '2026-01-15',
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.is_pro_rated).toBe(true);

    // dailyRate = 3000 / 26 = 115.384615...
    // daysWorked = round2((17/31)*26) = round2(14.2580...) = 14.26
    const expectedDaysWorked = round2((17 / 31) * 26);
    expect(result.days_worked).toBe(expectedDaysWorked);

    // proRatedSalary = round2(115.384615... * 14.26) = round2(1645.38...)
    const dailyRate = 3000 / 26;
    const expectedProRated = round2(dailyRate * expectedDaysWorked);
    expect(result.pro_rated_salary).toBe(expectedProRated);
    expect(result.gross_salary).toBe(expectedProRated);

    // Verify deductions are based on pro-rated salary
    expect(result.employee_epf).toBe(round2(expectedProRated * 0.11));
    expect(result.employer_epf).toBe(round2(expectedProRated * 0.13));
  });

  it('calculates a director correctly', () => {
    const profile = makeProfile({
      basic_salary: 8000,
      is_director: true,
      director_fee: 2000,
    });
    const settings = makeSettings();
    // Use a socso table with a range that includes 8000
    const extendedSocsoTable: SocsoContributionRow[] = [
      ...socsoTable,
      {
        id: '8',
        wage_from: 6000.01,
        wage_to: 10000,
        employer_first_category: 69.05,
        employee_first_category: 24.75,
        employer_second_category: 51.65,
      },
    ];

    const result = calculateEmployee(profile, settings, extendedSocsoTable, 1, 2026);

    expect(result.is_director).toBe(true);
    expect(result.director_fee).toBe(2000);
    expect(result.net_director_fee).toBe(2000);
    expect(result.basic_salary).toBe(8000);
    expect(result.gross_salary).toBe(8000);

    // EPF on gross
    expect(result.employer_epf).toBe(round2(8000 * 0.13));
    expect(result.employee_epf).toBe(round2(8000 * 0.11));

    // SOCSO from table
    expect(result.employer_socso).toBe(69.05);
    expect(result.employee_socso).toBe(24.75);

    // EIS capped at wage ceiling (5000)
    expect(result.employer_eis).toBe(round2(5000 * 0.002));
    expect(result.employee_eis).toBe(round2(5000 * 0.002));

    // PCB for 8000
    expect(result.pcb_amount).toBe(lookupPcb(8000));
    expect(result.pcb_amount).toBe(498);
  });

  it('uses above_60 EPF rate when epf_category is above_60', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      epf_category: 'above_60',
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    // Employee rate for above_60 = 5.5% of 5000 = 275
    expect(result.employee_epf).toBe(275);
    // Employer rate stays at 13% = 650
    expect(result.employer_epf).toBe(650);
  });

  it('uses custom per-employee EPF rates when set', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      employee_epf_rate: 9,
      employer_epf_rate: 15,
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    // Custom rates: employee 9%, employer 15%
    expect(result.employee_epf).toBe(round2(5000 * 0.09));
    expect(result.employer_epf).toBe(round2(5000 * 0.15));
  });

  it('uses custom per-employee SOCSO rates when set', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      employee_socso_rate: 2,
      employer_socso_rate: 3,
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employee_socso).toBe(round2(5000 * 0.02));
    expect(result.employer_socso).toBe(round2(5000 * 0.03));
  });

  it('disables HRDC when hrdc_enabled is false', () => {
    const profile = makeProfile({ basic_salary: 5000 });
    const settings = makeSettings({ hrdc_enabled: false });
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_hrdc).toBe(0);
  });

  it('does not pro-rate if joining_date is before the pay period', () => {
    const profile = makeProfile({
      basic_salary: 4000,
      joining_date: '2025-06-01',
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.is_pro_rated).toBe(false);
    expect(result.days_worked).toBe(26);
    expect(result.pro_rated_salary).toBe(4000);
  });

  it('returns zero defaults for OT, allowances, unpaid leave, and claims', () => {
    const profile = makeProfile({ basic_salary: 5000 });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.ot_amount).toBe(0);
    expect(result.total_allowances).toBe(0);
    expect(result.unpaid_leave_days).toBe(0);
    expect(result.unpaid_leave_deduction).toBe(0);
    expect(result.claims_amount).toBe(0);
  });

  it('includes calculation_notes with metadata', () => {
    const profile = makeProfile({ basic_salary: 5000 });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.calculation_notes).toBeDefined();
    expect(result.calculation_notes.epf_category).toBe('below_60');
    expect(result.calculation_notes.socso_scheme).toBe('both');
    expect(result.calculation_notes.pro_rated).toBe(false);
    expect(result.calculation_notes.calculated_at).toBeDefined();
    expect(result.calculation_notes.employer_epf_pct).toBe(13);
    expect(result.calculation_notes.employee_epf_pct).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// getAgeAtDate
// ---------------------------------------------------------------------------

describe('getAgeAtDate', () => {
  it('calculates age correctly', () => {
    expect(getAgeAtDate('1966-01-15', '2026-03-01')).toBe(60);
    expect(getAgeAtDate('1966-03-15', '2026-03-01')).toBe(59);
    expect(getAgeAtDate('1966-03-01', '2026-03-01')).toBe(60);
  });

  it('returns negative for future DOB', () => {
    expect(getAgeAtDate('2030-01-01', '2026-03-01')).toBe(-4);
  });
});

// ---------------------------------------------------------------------------
// calculateEmployee - age-based EIS/SOCSO rules
// ---------------------------------------------------------------------------

describe('calculateEmployee - age-based EIS/SOCSO rules', () => {
  const socsoTable = makeSocsoTable();

  it('zeroes EIS for employee aged 60+', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      date_of_birth: '1966-01-15',
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_eis).toBe(0);
    expect(result.employee_eis).toBe(0);
  });

  it('uses employment_injury SOCSO scheme for employee aged 60+', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      date_of_birth: '1966-01-15',
    });
    const settings = makeSettings({ socso_scheme: 'both' });
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_socso).toBe(36.9);
    expect(result.employee_socso).toBe(0);
  });

  it('applies normal rules when DOB is null', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      date_of_birth: undefined,
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_eis).toBe(10);
    expect(result.employee_eis).toBe(10);
    expect(result.employee_socso).toBe(18.5);
  });

  it('applies normal rules when employee is under 60', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      date_of_birth: '1990-05-20',
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_eis).toBe(10);
    expect(result.employee_eis).toBe(10);
    expect(result.employee_socso).toBe(18.5);
  });

  it('zeroes EIS even with custom rate overrides for above 60', () => {
    const profile = makeProfile({
      basic_salary: 5000,
      date_of_birth: '1966-01-15',
      employee_eis_rate: 0.2,
      employer_eis_rate: 0.2,
    });
    const settings = makeSettings();
    const result = calculateEmployee(profile, settings, socsoTable, 1, 2026);

    expect(result.employer_eis).toBe(0);
    expect(result.employee_eis).toBe(0);
  });
});
