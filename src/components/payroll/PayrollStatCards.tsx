import { DashboardCard } from '@/components/DashboardCard';
import { Wallet, FileText, Shield, Users } from 'lucide-react';
import type { PayrollRun } from '@/types/payroll';
import { formatCurrency } from '@/lib/otCalculations';

interface PayrollStatCardsProps {
  runs: PayrollRun[];
  isLoading: boolean;
}

export function PayrollStatCards({ runs, isLoading }: PayrollStatCardsProps) {
  const totalGross = runs.reduce((sum, r) => sum + Number(r.total_gross_salary || 0), 0);
  const pendingCount = runs.filter((r) =>
    ['pending_hr_review', 'hr_approved', 'pending_director', 'director_approved', 'pending_finance'].includes(r.status)
  ).length;
  const totalEpf = runs.reduce((sum, r) => sum + Number(r.total_employer_epf || 0) + Number(r.total_employee_epf || 0), 0);
  const totalSocso = runs.reduce((sum, r) => sum + Number(r.total_employer_socso || 0) + Number(r.total_employee_socso || 0), 0);

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardCard
        title="Total Payroll"
        value={isLoading ? '-' : formatCurrency(totalGross)}
        subtitle="All runs"
        icon={Wallet}
      />
      <DashboardCard
        title="Pending Runs"
        value={isLoading ? '-' : String(pendingCount)}
        subtitle="Awaiting approval"
        icon={FileText}
      />
      <DashboardCard
        title="EPF Summary"
        value={isLoading ? '-' : formatCurrency(totalEpf)}
        subtitle="Employer + Employee"
        icon={Shield}
      />
      <DashboardCard
        title="SOCSO Summary"
        value={isLoading ? '-' : formatCurrency(totalSocso)}
        subtitle="Employer + Employee"
        icon={Users}
      />
    </div>
  );
}
