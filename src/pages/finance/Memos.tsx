import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Wallet } from 'lucide-react';
import { ConsolidatedClaimMemo } from '@/components/claims/ConsolidatedClaimMemo';
import { ConsolidatedPayrollMemo } from '@/components/payroll/ConsolidatedPayrollMemo';

export default function FinanceMemos() {
  const [tab, setTab] = useState<'combined' | 'payroll'>('combined');

  return (
    <AppLayout>
      <PageLayout
        title="Memos"
        description="Review and approve consolidated memos for claims, OT, allowances, and payroll."
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="combined" className="gap-2">
              <FileText className="h-4 w-4" />
              Claim, OT & Allowance
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <Wallet className="h-4 w-4" />
              Payroll Memo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="combined" className="mt-6">
            <ConsolidatedClaimMemo />
          </TabsContent>

          <TabsContent value="payroll" className="mt-6">
            <ConsolidatedPayrollMemo />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
