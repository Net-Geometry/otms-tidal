import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Settings2, CheckCircle } from 'lucide-react';
import { PayrollStatCards } from '@/components/payroll/PayrollStatCards';
import { PayrollRunsTable } from '@/components/payroll/PayrollRunsTable';
import { CreatePayrollRunDialog } from '@/components/payroll/CreatePayrollRunDialog';
import { PayrollSettingsForm } from '@/components/payroll/PayrollSettingsForm';
import { AllowanceTypeSetup } from '@/components/payroll/AllowanceTypeSetup';
import { DeductionTypeSetup } from '@/components/payroll/DeductionTypeSetup';
import { usePayrollRuns, type PayrollRunsFilter } from '@/hooks/payroll/usePayrollRuns';

export default function Payroll() {
  const [section, setSection] = useState<'runs' | 'settings'>('runs');
  const [tab, setTab] = useState<PayrollRunsFilter>('all');
  const [search, setSearch] = useState('');

  const { data: runs, isLoading, createPayrollRun, isCreating } = usePayrollRuns({ filter: tab });

  const allRuns = usePayrollRuns({ filter: 'all' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return runs || [];
    return (runs || []).filter((r) => {
      const company = r.companies?.name || '';
      return (
        r.run_number?.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q)
      );
    });
  }, [runs, search]);

  return (
    <AppLayout>
      <PageLayout
        title="Payroll Management"
        description="Payroll runs, payslips, and statutory deductions."
      >
        <PayrollStatCards runs={allRuns.data || []} isLoading={allRuns.isLoading} />

        <Tabs value={section} onValueChange={(v) => setSection(v as any)} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="runs" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Payroll Runs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Tabs value={tab} onValueChange={(v) => setTab(v as PayrollRunsFilter)}>
                  <TabsList className="grid grid-cols-5 w-auto">
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>
                </Tabs>
                <CreatePayrollRunDialog onSubmit={createPayrollRun} isCreating={isCreating} />
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by run number or company..."
                  className="pl-9"
                />
              </div>

              <PayrollRunsTable runs={filtered} isLoading={isLoading} />
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-6">
            <PayrollSettingsForm />
            <AllowanceTypeSetup />
            <DeductionTypeSetup />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
