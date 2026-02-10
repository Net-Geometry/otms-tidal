import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { LeaveRequestTable } from '@/components/leave/LeaveRequestTable';
import { useLeaveRequests, type LeaveRequestsFilter } from '@/hooks/leave/useLeaveRequests';

export default function LeaveHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LeaveRequestsFilter>('pending');
  const requests = useLeaveRequests({ filter: tab });

  return (
    <AppLayout>
      <PageLayout
        title="Leave History"
        description="Track your leave requests and cancel pending submissions."
        onBack={() => navigate('/dashboard')}
      >
        <Card className="p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as LeaveRequestsFilter)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <LeaveRequestTable
                requests={requests.data || []}
                isLoading={requests.isLoading}
                role="employee"
                enableBatch={false}
                onCancel={async (requestId, reason) => {
                  await requests.cancelLeaveRequest({ requestId, reason });
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
