import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FinanceReports() {
  return (
    <AppLayout>
      <PageLayout title="Finance Reports" description="Standard finance reports and exports (scaffold).">
        <Tabs defaultValue="project-cost-summary">
          <TabsList className="w-full flex flex-wrap h-auto justify-start">
            <TabsTrigger value="project-cost-summary">Project Cost Summary</TabsTrigger>
            <TabsTrigger value="claims-report">Claims Report</TabsTrigger>
            <TabsTrigger value="petty-cash-statement">Petty Cash Statement</TabsTrigger>
            <TabsTrigger value="payment-register">Payment Register</TabsTrigger>
          </TabsList>

          <TabsContent value="project-cost-summary">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Coming soon</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claims-report">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Coming soon</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="petty-cash-statement">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Coming soon</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-register">
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Coming soon</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
