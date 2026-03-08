import type { PayrollItem } from '@/types/payroll';

/** Convert RM amount to cents string, left-padded with zeros to minWidth */
function toCents(amount: number, minWidth = 6): string {
  const cents = Math.round(amount * 100);
  return String(cents).padStart(minWidth, '0');
}

export interface SocsoExportContext {
  employerSocsoNo: string;
  month: number;
  year: number;
  items: PayrollItem[];
}

export function generateSocsoEisTxt(ctx: SocsoExportContext): string {
  const lines: string[] = [];
  const mm = String(ctx.month).padStart(2, '0');

  for (const item of ctx.items) {
    const socsoNo = item.profiles?.socso_no || '';
    const name = item.profiles?.full_name || '';
    const netSalary = Number(item.net_salary || 0);
    const erSocso = Number(item.employer_socso || 0);
    const eeSocso = Number(item.employee_socso || 0);
    const erEis = Number(item.employer_eis || 0);
    const eeEis = Number(item.employee_eis || 0);

    // Skip employees with no SOCSO contributions
    if (erSocso === 0 && eeSocso === 0 && erEis === 0 && eeEis === 0) continue;

    // Line 1: employer SOCSO no + spaces + member SOCSO no + employee name
    lines.push(`${ctx.employerSocsoNo}  ${socsoNo}${name}`);

    // Line 2: MM|YYYY|NetSalary|ErSOCSO|EeSOCSO|ErEIS|EeEIS (all in cents)
    lines.push(
      `${mm}|${ctx.year}|${toCents(netSalary)}|${toCents(erSocso, 4)}|${toCents(eeSocso, 4)}|${toCents(erEis, 4)}|${toCents(eeEis, 4)}`
    );
  }

  return lines.join('\n');
}

export interface EpfExportContext {
  employerEpfNo: string;
  companyName: string;
  month: number;
  year: number;
  items: PayrollItem[];
}

export function generateEpfTxt(ctx: EpfExportContext): string {
  const lines: string[] = [];
  const mm = String(ctx.month).padStart(2, '0');
  const paymentCode = `A${ctx.year}${mm}`;

  // Filter to employees with EPF contributions
  const epfItems = ctx.items.filter(
    (item) => Number(item.employer_epf || 0) > 0 || Number(item.employee_epf || 0) > 0
  );

  // Compute totals
  let totalErEpf = 0;
  let totalEeEpf = 0;
  for (const item of epfItems) {
    totalErEpf += Number(item.employer_epf || 0);
    totalEeEpf += Number(item.employee_epf || 0);
  }

  // 00 - Header
  lines.push(
    `00EPF MONTHLY FORM A${paymentCode}${String(epfItems.length).padStart(6, '0')}${toCents(totalErEpf, 10)}${toCents(totalEeEpf, 10)}${ctx.employerEpfNo}`
  );

  // 01 - Sub-header
  lines.push(
    `01${ctx.employerEpfNo}${mm}${ctx.year}${ctx.companyName}`
  );

  // 02 - Employee records
  for (const item of epfItems) {
    const epfNo = (item.profiles?.epf_no || '').padEnd(8, ' ');
    const icNo = (item.profiles?.ic_no || '').padEnd(12, ' ');
    const name = (item.profiles?.full_name || '').padEnd(40, ' ');
    const staffId = (item.profiles?.employee_id || '').padEnd(10, ' ');
    const erEpf = Number(item.employer_epf || 0);
    const eeEpf = Number(item.employee_epf || 0);
    const totalEpf = erEpf + eeEpf;

    lines.push(
      `02${'0'.repeat(6)}${epfNo}${icNo}${name}${staffId}${toCents(erEpf, 8)}${toCents(eeEpf, 8)}${toCents(totalEpf, 8)}`
    );
  }

  // 99 - Footer
  const grandTotal = totalErEpf + totalEeEpf;
  lines.push(
    `99${String(epfItems.length).padStart(6, '0')}${toCents(totalErEpf, 10)}${toCents(totalEeEpf, 10)}${toCents(grandTotal, 10)}`
  );

  return lines.join('\n');
}
