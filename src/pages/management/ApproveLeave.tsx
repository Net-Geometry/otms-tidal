import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { LeaveRequestTable } from '@/components/leave/LeaveRequestTable';
import { useLeaveApproval, type LeaveApprovalTab } from '@/hooks/leave/useLeaveApproval';

export default function ApproveLeave() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LeaveApprovalTab>('pending');
  const [search, setSearch] = useState('');
  const approval = useLeaveApproval({ role: 'management', tab });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return approval.data || [];
    return (approval.data || []).filter((r) => {
      const name = r.profiles?.full_name || '';
      return (
        r.ticket_number?.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [approval.data, search]);

  return (
    <AppLayout>
      <PageLayout
        title="Approve Leave (Management)"
        description="Final approval for leave requests."
        onBack={() => navigate('/dashboard')}
      >
        <Card className="p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as LeaveApprovalTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ticket or employee..."
                  className="pl-9"
                />
              </div>

              <LeaveRequestTable
                requests={filtered}
                isLoading={approval.isLoading}
                role="management"
                enableBatch={tab === 'pending'}
                onApprove={async (ids, remarks) => approval.approveLeave({ requestIds: ids, remarks })}
                onReject={async (ids, remarks) => approval.rejectLeave({ requestIds: ids, remarks })}
                isApproving={approval.isApproving}
                isRejecting={approval.isRejecting}
                showActions
              />
            </TabsContent>
          </Tabs>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
