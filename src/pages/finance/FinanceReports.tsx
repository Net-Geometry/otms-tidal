import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportProfitLoss } from '@/components/finance/ReportProfitLoss';
import { ReportBalanceSheet } from '@/components/finance/ReportBalanceSheet';
import { ReportProjectCostSummary } from '@/components/finance/ReportProjectCostSummary';
import { ReportClaimsReport } from '@/components/finance/ReportClaimsReport';
import { ReportPettyCashStatement } from '@/components/finance/ReportPettyCashStatement';
import { ReportPaymentRegister } from '@/components/finance/ReportPaymentRegister';
import { ReportApAging } from '@/components/finance/ReportApAging';
import { ReportArAging } from '@/components/finance/ReportArAging';
import { ReportGLListing } from '@/components/finance/ReportGLListing';
import { ReportCashFlow } from '@/components/finance/ReportCashFlow';
import { ReportSSTSummary } from '@/components/finance/ReportSSTSummary';

export default function FinanceReports() {
  return (
    <AppLayout>
      <PageLayout title="Finance Reports" description="Financial statements, project cost, claims, petty cash, and payment register reports.">
        <Tabs defaultValue="profit-loss">
          <TabsList className="w-full flex flex-wrap h-auto justify-start">
            <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="gl-listing">General Ledger</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
            <TabsTrigger value="ap-aging">AP Aging</TabsTrigger>
            <TabsTrigger value="ar-aging">AR Aging</TabsTrigger>
            <TabsTrigger value="sst-summary">SST Summary</TabsTrigger>
            <TabsTrigger value="project-cost-summary">Project Cost Summary</TabsTrigger>
            <TabsTrigger value="claims-report">Claims Report</TabsTrigger>
            <TabsTrigger value="petty-cash-statement">Petty Cash Statement</TabsTrigger>
            <TabsTrigger value="payment-register">Payment Register</TabsTrigger>
          </TabsList>

          <TabsContent value="profit-loss">
            <ReportProfitLoss />
          </TabsContent>

          <TabsContent value="balance-sheet">
            <ReportBalanceSheet />
          </TabsContent>

          <TabsContent value="gl-listing">
            <ReportGLListing />
          </TabsContent>

          <TabsContent value="cash-flow">
            <ReportCashFlow />
          </TabsContent>

          <TabsContent value="ap-aging">
            <ReportApAging />
          </TabsContent>

          <TabsContent value="ar-aging">
            <ReportArAging />
          </TabsContent>

          <TabsContent value="sst-summary">
            <ReportSSTSummary />
          </TabsContent>

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
