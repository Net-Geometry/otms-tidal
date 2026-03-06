import { supabase } from '@/integrations/supabase/client';
import type {
  PayrollSettings,
  SocsoContributionRow,
} from '@/types/payroll';

export interface EmployeeProfile {
  id: string;
  basic_salary: number;
  is_ot_eligible: boolean;
  ot_base: number | null;
  is_director: boolean;
  director_fee: number;
  epf_category: string;
  marital_status: string;
  pcb_category: number;
  company_id: string;
  joining_date: string | null;
  deleted_at: string | null;
  date_of_birth?: string | null;
  // Per-employee contribution rate overrides
  employee_epf_rate?: number | null;
  employer_epf_rate?: number | null;
  employee_socso_rate?: number | null;
  employer_socso_rate?: number | null;
  employee_eis_rate?: number | null;
  employer_eis_rate?: number | null;
}

export interface CalculatedItem {
  employee_id: string;
  basic_salary: number;
  working_days: number;
  days_worked: number;
  is_pro_rated: boolean;
  pro_rated_salary: number;
  is_director: boolean;
  director_fee: number;
  gross_salary: number;
  ot_amount: number;
  employee_epf: number;
  employee_socso: number;
  employee_eis: number;
  employer_epf: number;
  employer_socso: number;
  employer_eis: number;
  employer_hrdc: number;
  pcb_amount: number;
  total_allowances: number;
  total_deductions: number;
  net_salary: number;
  net_director_fee: number;
  unpaid_leave_days: number;
  unpaid_leave_deduction: number;
  claims_amount: number;
  calculation_notes: Record<string, unknown>;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getAgeAtDate(dob: string, referenceDate: string): number {
  const birth = new Date(dob);
  const ref = new Date(referenceDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * LHDN 2026 PCB (MTD) calculation with full marginal tax rate system.
 * Supports Categories 1 (single/divorced), 2 (married, spouse not working),
 * and 3 (married, both working — taxed same as Category 1).
 */

export interface PcbDeductions {
  epfMonthly: number;
  socsoEisMonthly: number;
}

/** LHDN 2026 marginal tax brackets: [upperLimit, rate] */
const TAX_BRACKETS: [number, number][] = [
  [5000, 0],
  [20000, 0.01],
  [35000, 0.03],
  [50000, 0.06],
  [70000, 0.11],
  [100000, 0.19],
  [400000, 0.25],
  [600000, 0.26],
  [2000000, 0.28],
  [Infinity, 0.30],
];

export function calculatePcb(
  monthlyGross: number,
  category: number,
  qualifyingChildren: number,
  deductions: PcbDeductions
): number {
  const annualGross = monthlyGross * 12;

  // Reliefs
  const individualRelief = 9000;
  const epfRelief = Math.min(deductions.epfMonthly * 12, 4000);
  const socsoEisRelief = Math.min(deductions.socsoEisMonthly * 12, 350);
  const spouseRelief = category === 2 ? 4000 : 0;
  const childRelief = qualifyingChildren * 2000;

  const totalRelief = individualRelief + epfRelief + socsoEisRelief + spouseRelief + childRelief;
  const chargeableIncome = Math.max(0, annualGross - totalRelief);

  // Compute tax using marginal rate brackets
  let tax = 0;
  let previousLimit = 0;
  for (const [upperLimit, rate] of TAX_BRACKETS) {
    if (chargeableIncome <= previousLimit) break;
    const taxableInBracket = Math.min(chargeableIncome, upperLimit) - previousLimit;
    tax += taxableInBracket * rate;
    previousLimit = upperLimit;
  }

  // Rebate for chargeable income <= RM35,000
  if (chargeableIncome <= 35000) {
    const rebate = category === 2 ? 800 : 400;
    tax = Math.max(0, tax - rebate);
  }

  return round2(tax / 12);
}

/** Backward-compatible wrapper — Category 1, no dependents, no deductions */
export function lookupPcb(monthlyGross: number): number {
  return calculatePcb(monthlyGross, 1, 0, { epfMonthly: 0, socsoEisMonthly: 0 });
}

export function lookupSocso(
  grossSalary: number,
  socsoTable: SocsoContributionRow[],
  scheme: 'employment_injury' | 'both'
): { employer: number; employee: number } {
  const row = socsoTable.find(
    (r) => grossSalary >= r.wage_from && grossSalary <= r.wage_to
  );
  if (!row) return { employer: 0, employee: 0 };
  if (scheme === 'both') {
    return {
      employer: Number(row.employer_first_category),
      employee: Number(row.employee_first_category),
    };
  }
  return {
    employer: Number(row.employer_second_category),
    employee: 0,
  };
}

export function calculateEmployee(
  profile: EmployeeProfile,
  settings: PayrollSettings,
  socsoTable: SocsoContributionRow[],
  month: number,
  year: number,
  qualifyingChildren: number = 0
): CalculatedItem {
  const workingDays = settings.working_days_per_month;
  const basicSalary = Number(profile.basic_salary) || 0;

  // Pro-ration check
  let daysWorked = workingDays;
  let isProRated = false;

  if (profile.joining_date) {
    const joinDate = new Date(profile.joining_date);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    if (joinDate >= periodStart && joinDate <= periodEnd) {
      // Joined mid-month
      const remainingDays = periodEnd.getDate() - joinDate.getDate() + 1;
      const calendarDays = periodEnd.getDate();
      daysWorked = round2((remainingDays / calendarDays) * workingDays);
      isProRated = true;
    }
  }

  const dailyRate = basicSalary / workingDays;
  const proRatedSalary = isProRated ? round2(dailyRate * daysWorked) : basicSalary;

  // Gross = pro-rated salary (OT will be added separately if available)
  const grossSalary = proRatedSalary;

  // Calculate employee age for age-based contribution rules
  const periodEnd = new Date(year, month, 0); // last day of pay period month
  const periodEndStr = `${year}-${String(month).padStart(2, '0')}-${String(periodEnd.getDate()).padStart(2, '0')}`;
  const employeeAge = profile.date_of_birth
    ? getAgeAtDate(profile.date_of_birth, periodEndStr)
    : null;
  const isAbove60 = employeeAge !== null && employeeAge >= 60;

  // EPF calculation - use per-employee rate if set, otherwise use global settings
  const epfAbleWage = grossSalary;
  const employerEpfRate = (profile.employer_epf_rate !== null && profile.employer_epf_rate !== undefined)
    ? Number(profile.employer_epf_rate) / 100
    : Number(settings.employer_epf_rate) / 100;
  const employeeEpfRateRaw = (profile.employee_epf_rate !== null && profile.employee_epf_rate !== undefined)
    ? Number(profile.employee_epf_rate)
    : profile.epf_category === 'above_60'
      ? Number(settings.employee_epf_rate_above_60)
      : Number(settings.employee_epf_rate_below_60);
  const employeeEpfRate = employeeEpfRateRaw / 100;
  const employerEpf = round2(epfAbleWage * employerEpfRate);
  const employeeEpf = round2(epfAbleWage * employeeEpfRate);

  // SOCSO calculation
  let employerSocso: number;
  let employeeSocso: number;
  if (isAbove60) {
    // Above 60: employer contributes (employment_injury scheme), employee = 0
    if (profile.employer_socso_rate !== null && profile.employer_socso_rate !== undefined) {
      employerSocso = round2(grossSalary * (Number(profile.employer_socso_rate) / 100));
    } else {
      const socso = lookupSocso(grossSalary, socsoTable, 'employment_injury');
      employerSocso = socso.employer;
    }
    employeeSocso = 0;
  } else if (profile.employer_socso_rate !== null && profile.employer_socso_rate !== undefined &&
      profile.employee_socso_rate !== null && profile.employee_socso_rate !== undefined) {
    employerSocso = round2(grossSalary * (Number(profile.employer_socso_rate) / 100));
    employeeSocso = round2(grossSalary * (Number(profile.employee_socso_rate) / 100));
  } else {
    const socso = lookupSocso(grossSalary, socsoTable, settings.socso_scheme);
    employerSocso = socso.employer;
    employeeSocso = socso.employee;
  }

  // EIS calculation
  let employerEis: number;
  let employeeEis: number;
  if (isAbove60) {
    // Above 60: no EIS contribution at all
    employerEis = 0;
    employeeEis = 0;
  } else {
    const eisWage = Math.min(grossSalary, Number(settings.eis_wage_ceiling));
    const employerEisRate = (profile.employer_eis_rate !== null && profile.employer_eis_rate !== undefined)
      ? Number(profile.employer_eis_rate) / 100
      : Number(settings.eis_employer_rate) / 100;
    const employeeEisRate = (profile.employee_eis_rate !== null && profile.employee_eis_rate !== undefined)
      ? Number(profile.employee_eis_rate) / 100
      : Number(settings.eis_employee_rate) / 100;
    employerEis = round2(eisWage * employerEisRate);
    employeeEis = round2(eisWage * employeeEisRate);
  }

  // HRDC
  const employerHrdc = settings.hrdc_enabled
    ? round2(grossSalary * (Number(settings.hrdc_rate) / 100))
    : 0;

  // Director fee
  const isDirector = profile.is_director || false;
  const directorFee = isDirector ? Number(profile.director_fee) || 0 : 0;

  // PCB/MTD — full LHDN 2026 calculation with reliefs
  const pcbAmount = calculatePcb(
    grossSalary,
    profile.pcb_category || 1,
    qualifyingChildren,
    {
      epfMonthly: employeeEpf,
      socsoEisMonthly: employeeSocso + employeeEis,
    }
  );

  // Total deductions (employee portion)
  const totalDeductions = round2(
    employeeEpf + employeeSocso + employeeEis + pcbAmount
  );

  // Net salary
  const netSalary = round2(grossSalary - totalDeductions);
  const netDirectorFee = directorFee;

  return {
    employee_id: profile.id,
    basic_salary: basicSalary,
    working_days: workingDays,
    days_worked: daysWorked,
    is_pro_rated: isProRated,
    pro_rated_salary: proRatedSalary,
    is_director: isDirector,
    director_fee: directorFee,
    gross_salary: grossSalary,
    ot_amount: 0,
    employee_epf: employeeEpf,
    employee_socso: employeeSocso,
    employee_eis: employeeEis,
    employer_epf: employerEpf,
    employer_socso: employerSocso,
    employer_eis: employerEis,
    employer_hrdc: employerHrdc,
    pcb_amount: pcbAmount,
    total_allowances: 0,
    total_deductions: totalDeductions,
    net_salary: netSalary,
    net_director_fee: netDirectorFee,
    unpaid_leave_days: 0,
    unpaid_leave_deduction: 0,
    claims_amount: 0,
    calculation_notes: {
      calculated_at: new Date().toISOString(),
      epf_category: profile.epf_category || 'below_60',
      epf_rate: `${(employerEpfRate * 100).toFixed(2)}% / ${employeeEpfRateRaw.toFixed(2)}%`,
      employer_epf_pct: round2(employerEpfRate * 100),
      employee_epf_pct: round2(employeeEpfRateRaw),
      pcb_amount: pcbAmount,
      socso_scheme: settings.socso_scheme,
      age_at_payroll: employeeAge,
      is_above_60: isAbove60,
      pro_rated: isProRated,
      used_custom_rates: {
        epf: profile.employer_epf_rate !== null || profile.employee_epf_rate !== null,
        socso: profile.employer_socso_rate !== null || profile.employee_socso_rate !== null,
        eis: profile.employer_eis_rate !== null || profile.employee_eis_rate !== null,
      },
    },
  };
}

/**
 * Populates claims_amount on payroll_items from fully-approved claims for the given pay period.
 * Sums all claims with a final-approved status for each employee in the period month/year.
 */
export async function populateClaimsForRun(
  payrollRunId: string,
  month: number,
  year: number
): Promise<void> {
  const db = supabase as any;

  // Get employee IDs in this payroll run
  const { data: items, error: itemsErr } = await db
    .from('payroll_items')
    .select('id, employee_id')
    .eq('payroll_run_id', payrollRunId);

  if (itemsErr) throw itemsErr;
  if (!items || items.length === 0) return;

  const employeeIds = (items as any[]).map((i) => i.employee_id);

  // Date range for claims: full calendar month
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Fetch all fully-approved claims for these employees in this period
  const approvedStatuses = ['finance_approved', 'director_approved', 'gm_approved', 'head_finance_approved'];
  const { data: claims, error: claimsErr } = await db
    .from('claims')
    .select('employee_id, amount')
    .in('employee_id', employeeIds)
    .in('status', approvedStatuses)
    .gte('claim_date', periodStart)
    .lte('claim_date', periodEnd);

  if (claimsErr) throw claimsErr;

  // Aggregate claims by employee
  const claimsByEmployee: Record<string, number> = {};
  for (const c of (claims || []) as any[]) {
    claimsByEmployee[c.employee_id] = (claimsByEmployee[c.employee_id] || 0) + Number(c.amount || 0);
  }

  // Update each payroll item with its claims_amount
  for (const item of items as any[]) {
    const claimsAmount = round2(claimsByEmployee[item.employee_id] || 0);
    await db
      .from('payroll_items')
      .update({ claims_amount: claimsAmount })
      .eq('id', item.id);
  }
}

/**
 * Fetches all payroll_items for a run, aggregates totals, and updates the payroll_runs row.
 */
export async function recalculateRunTotals(payrollRunId: string): Promise<void> {
  const db = supabase as any;

  const { data: items, error: fetchError } = await db
    .from('payroll_items')
    .select('gross_salary, net_salary, employer_epf, employee_epf, employer_socso, employee_socso, employer_eis, employee_eis, employer_hrdc, pcb_amount, total_allowances, total_deductions, director_fee, claims_amount, ot_amount')
    .eq('payroll_run_id', payrollRunId);

  if (fetchError) throw fetchError;

  if (!items || items.length === 0) {
    const { error: updateError } = await db
      .from('payroll_runs')
      .update({
        total_gross_salary: 0, total_net_salary: 0,
        total_employer_epf: 0, total_employee_epf: 0,
        total_employer_socso: 0, total_employee_socso: 0,
        total_employer_eis: 0, total_employee_eis: 0,
        total_hrdc: 0, total_pcb: 0,
        total_allowances: 0, total_deductions: 0,
        total_director_fee: 0, employee_count: 0,
      })
      .eq('id', payrollRunId);
    if (updateError) throw updateError;
    return;
  }

  const totals = (items as any[]).reduce(
    (acc, item) => ({
      total_gross_salary: acc.total_gross_salary + Number(item.gross_salary || 0),
      total_net_salary: acc.total_net_salary + Number(item.net_salary || 0),
      total_employer_epf: acc.total_employer_epf + Number(item.employer_epf || 0),
      total_employee_epf: acc.total_employee_epf + Number(item.employee_epf || 0),
      total_employer_socso: acc.total_employer_socso + Number(item.employer_socso || 0),
      total_employee_socso: acc.total_employee_socso + Number(item.employee_socso || 0),
      total_employer_eis: acc.total_employer_eis + Number(item.employer_eis || 0),
      total_employee_eis: acc.total_employee_eis + Number(item.employee_eis || 0),
      total_hrdc: acc.total_hrdc + Number(item.employer_hrdc || 0),
      total_pcb: acc.total_pcb + Number(item.pcb_amount || 0),
      total_allowances: acc.total_allowances + Number(item.total_allowances || 0),
      total_deductions: acc.total_deductions + Number(item.total_deductions || 0),
      total_director_fee: acc.total_director_fee + Number(item.director_fee || 0),
    }),
    {
      total_gross_salary: 0,
      total_net_salary: 0,
      total_employer_epf: 0,
      total_employee_epf: 0,
      total_employer_socso: 0,
      total_employee_socso: 0,
      total_employer_eis: 0,
      total_employee_eis: 0,
      total_hrdc: 0,
      total_pcb: 0,
      total_allowances: 0,
      total_deductions: 0,
      total_director_fee: 0,
    }
  );

  const roundedTotals = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, round2(v as number)])
  );

  const { error: updateError } = await db
    .from('payroll_runs')
    .update({
      ...roundedTotals,
      employee_count: items.length,
    })
    .eq('id', payrollRunId);

  if (updateError) throw updateError;
}
