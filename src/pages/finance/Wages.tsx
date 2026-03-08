import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ClipboardList, CheckCircle, Search } from 'lucide-react';
import { PayrollRunsTable } from '@/components/payroll/PayrollRunsTable';
import { usePayrollRuns, type PayrollRunsFilter } from '@/hooks/payroll/usePayrollRuns';

export default function Wages() {
  const [tab, setTab] = useState<PayrollRunsFilter>('finalized');
  const [search, setSearch] = useState('');

  const { data: runs, isLoading } = usePayrollRuns({ filter: tab });
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

  const draftCount = (allRuns.data || []).filter((r) => r.status === 'draft').length;
  const finalizedCount = (allRuns.data || []).filter((r) => r.status === 'finalized').length;

  return (
    <AppLayout>
      <PageLayout title="Wages" description="View payroll runs. Approval and posting is managed via consolidated memos.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Draft Runs"
            value={String(draftCount)}
            subtitle="In progress"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Finalized Runs"
            value={String(finalizedCount)}
            subtitle="Ready for memo"
            icon={CheckCircle}
          />
        </div>

        <Card className="p-6 mt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as PayrollRunsFilter)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="finalized">Finalized</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by run number or company..."
                  className="pl-9"
                />
              </div>
              <PayrollRunsTable
                runs={filtered}
                isLoading={isLoading}
                basePath="/hr/payroll"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
