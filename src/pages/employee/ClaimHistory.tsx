import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ClaimRequestTable } from '@/components/claims/ClaimRequestTable';
import { useClaimRequests, type ClaimRequestsFilter } from '@/hooks/claims/useClaimRequests';

export default function ClaimHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClaimRequestsFilter>('pending');
  const requests = useClaimRequests({ filter: tab });

  return (
    <AppLayout>
      <PageLayout
        title="Claim History"
        description="Track your claims and cancel pending submissions."
        onBack={() => navigate('/dashboard')}
      >
        <Card className="p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ClaimRequestsFilter)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <ClaimRequestTable
                requests={requests.data || []}
                isLoading={requests.isLoading}
                role="employee"
                enableBatch={false}
                onCancel={async (requestId, reason) => {
                  await requests.cancelClaimRequest({ requestId, reason });
                }}
                isCancelling={requests.isCancelling}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
