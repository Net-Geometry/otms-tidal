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
  company_id: string;
  joining_date: string | null;
  deleted_at: string | null;
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
  cp38_amount: number;
  zakat_amount: number;
  sports_club: number;
  staff_loan: number;
  rental_deduction: number;
  other_deductions: number;
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

/**
 * Simplified monthly PCB (MTD) lookup table based on LHDN Schedule.
 * Assumes single person (Category 1) with no additional deductions.
 * Each entry: [upperBound, pcbAmount]. Sorted ascending by upperBound.
 * Gross income up to the upperBound maps to the corresponding pcbAmount.
 */
export const PCB_MONTHLY_TABLE: [number, number][] = [
  [2500, 0],
  [3000, 13],
  [3500, 43],
  [4000, 73],
  [4500, 108],
  [5000, 153],
  [5500, 198],
  [6000, 248],
  [6500, 303],
  [7000, 358],
  [7500, 423],
  [8000, 498],
  [8500, 573],
  [9000, 658],
  [9500, 743],
  [10000, 838],
  [11000, 1023],
  [12000, 1218],
  [13000, 1433],
  [14000, 1648],
  [15000, 1893],
  [16000, 2143],
  [17000, 2393],
  [18000, 2643],
  [19000, 2893],
  [20000, 3143],
  [25000, 4393],
  [30000, 5643],
  [35000, 6893],
  [40000, 8293],
  [45000, 9793],
  [50000, 11293],
  [60000, 14293],
  [70000, 17293],
  [80000, 20293],
  [100000, 26293],
  [Infinity, 26293], // cap at highest bracket
];

export function lookupPcb(monthlyGross: number): number {
  for (const [upperBound, pcb] of PCB_MONTHLY_TABLE) {
    if (monthlyGross <= upperBound) return pcb;
  }
  return 0;
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
  year: number
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

  // SOCSO calculation - use per-employee rate if set, otherwise use lookup table
  let employerSocso: number;
  let employeeSocso: number;
  if (profile.employer_socso_rate !== null && profile.employer_socso_rate !== undefined &&
      profile.employee_socso_rate !== null && profile.employee_socso_rate !== undefined) {
    employerSocso = round2(grossSalary * (Number(profile.employer_socso_rate) / 100));
    employeeSocso = round2(grossSalary * (Number(profile.employee_socso_rate) / 100));
  } else {
    const socso = lookupSocso(grossSalary, socsoTable, settings.socso_scheme);
    employerSocso = socso.employer;
    employeeSocso = socso.employee;
  }

  // EIS calculation - use per-employee rate if set, otherwise use global settings
  const eisWage = Math.min(grossSalary, Number(settings.eis_wage_ceiling));
  const employerEisRate = (profile.employer_eis_rate !== null && profile.employer_eis_rate !== undefined)
    ? Number(profile.employer_eis_rate) / 100
    : Number(settings.eis_employer_rate) / 100;
  const employeeEisRate = (profile.employee_eis_rate !== null && profile.employee_eis_rate !== undefined)
    ? Number(profile.employee_eis_rate) / 100
    : Number(settings.eis_employee_rate) / 100;
  const employerEis = round2(eisWage * employerEisRate);
  const employeeEis = round2(eisWage * employeeEisRate);

  // HRDC
  const employerHrdc = settings.hrdc_enabled
    ? round2(grossSalary * (Number(settings.hrdc_rate) / 100))
    : 0;

  // Director fee
  const isDirector = profile.is_director || false;
  const directorFee = isDirector ? Number(profile.director_fee) || 0 : 0;

  // PCB/MTD lookup (simplified monthly schedule)
  const pcbAmount = lookupPcb(grossSalary);

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
    cp38_amount: 0,
    zakat_amount: 0,
    sports_club: 0,
    staff_loan: 0,
    rental_deduction: 0,
    other_deductions: 0,
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
      pcb_amount: pcbAmount,
      socso_scheme: settings.socso_scheme,
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
 * Fetches all payroll_items for a run, aggregates totals, and updates the payroll_runs row.
 */
export async function recalculateRunTotals(payrollRunId: string): Promise<void> {
  const db = supabase as any;

  const { data: items, error: fetchError } = await db
    .from('payroll_items')
    .select('gross_salary, net_salary, employer_epf, employee_epf, employer_socso, employee_socso, employer_eis, employee_eis, employer_hrdc, pcb_amount, total_allowances, total_deductions, director_fee')
    .eq('payroll_run_id', payrollRunId);

  if (fetchError) throw fetchError;
  if (!items || items.length === 0) return;

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
