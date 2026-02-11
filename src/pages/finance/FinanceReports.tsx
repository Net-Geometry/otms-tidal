import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportProjectCostSummary } from '@/components/finance/ReportProjectCostSummary';
import { ReportClaimsReport } from '@/components/finance/ReportClaimsReport';
import { ReportPettyCashStatement } from '@/components/finance/ReportPettyCashStatement';
import { ReportPaymentRegister } from '@/components/finance/ReportPaymentRegister';

export default function FinanceReports() {
  return (
    <AppLayout>
      <PageLayout title="Finance Reports" description="Generate project, claims, petty cash, and payment register reports.">
        <Tabs defaultValue="project-cost-summary">
          <TabsList className="w-full flex flex-wrap h-auto justify-start">
            <TabsTrigger value="project-cost-summary">Project Cost Summary</TabsTrigger>
            <TabsTrigger value="claims-report">Claims Report</TabsTrigger>
            <TabsTrigger value="petty-cash-statement">Petty Cash Statement</TabsTrigger>
            <TabsTrigger value="payment-register">Payment Register</TabsTrigger>
          </TabsList>

          <TabsContent value="project-cost-summary">
            <ReportProjectCostSummary />
          </TabsContent>

          <TabsContent value="claims-report">
            <ReportClaimsReport />
          </TabsContent>

          <TabsContent value="petty-cash-statement">
            <ReportPettyCashStatement />
          </TabsContent>

          <TabsContent value="payment-register">
            <ReportPaymentRegister />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
