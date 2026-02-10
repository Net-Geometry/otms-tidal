import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CalendarOff, CheckCircle, ClipboardList, Settings2, Search, Users2 } from 'lucide-react';
import { LeaveRequestTable } from '@/components/leave/LeaveRequestTable';
import { LeaveTypeSetup } from '@/components/leave/LeaveTypeSetup';
import { LeaveBalanceManager } from '@/components/leave/LeaveBalanceManager';
import { useLeaveApproval, type LeaveApprovalTab } from '@/hooks/leave/useLeaveApproval';
import { supabase } from '@/integrations/supabase/client';

export default function Leave() {
  const [section, setSection] = useState<'requests' | 'types' | 'balances'>('requests');
  const [tab, setTab] = useState<LeaveApprovalTab>('pending');
  const [search, setSearch] = useState('');

  const approval = useLeaveApproval({ role: 'hr', tab });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return approval.data || [];
    return (approval.data || []).filter((r) => {
      const name = r.profiles?.full_name || '';
      const type = r.leave_type?.name || '';
      return (
        r.ticket_number?.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [approval.data, search]);

  const { data: stats } = useQuery({
    queryKey: ['leave-hr-stats'],
    queryFn: async () => {
      const db = supabase as any;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await db
        .from('leave_requests')
        .select('status, total_days, created_at')
        .gte('created_at', monthStart.toISOString());

      if (error) throw error;

      const pending = (data || []).filter((r: any) => ['pending_hr', 'supervisor_approved'].includes(r.status)).length;
      const approvedThisMonth = (data || []).filter((r: any) => r.status === 'management_approved').length;
      const totalDaysThisMonth = (data || [])
        .filter((r: any) => r.status === 'management_approved')
        .reduce((sum: number, r: any) => sum + Number(r.total_days || 0), 0);

      return { pending, approvedThisMonth, totalDaysThisMonth };
    },
    staleTime: 30 * 1000,
  });

  return (
    <AppLayout>
      <PageLayout
        title="Leave Management"
        description="Leave requests, approvals, types, and balance administration."
      >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pending (HR)"
            value={String(stats?.pending ?? '-')}
            subtitle="Awaiting HR review"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Approved This Month"
            value={String(stats?.approvedThisMonth ?? '-')}
            subtitle="Management approved"
            icon={CheckCircle}
          />
          <DashboardCard
            title="Approved Days (Month)"
            value={stats ? Number(stats.totalDaysThisMonth).toFixed(1) : '-'}
            subtitle="Total leave days"
            icon={CalendarOff}
          />
        </div>

        <Tabs value={section} onValueChange={(v) => setSection(v as any)} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests" className="gap-2">
              <Users2 className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Leave Types
            </TabsTrigger>
            <TabsTrigger value="balances" className="gap-2">
              <CalendarOff className="h-4 w-4" />
              Balances
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
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
                      placeholder="Search by ticket, employee, or type..."
                      className="pl-9"
                    />
                  </div>

                  <LeaveRequestTable
                    requests={filtered}
                    isLoading={approval.isLoading}
                    role="hr"
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
          </TabsContent>

          <TabsContent value="types" className="mt-6">
            <LeaveTypeSetup />
          </TabsContent>

          <TabsContent value="balances" className="mt-6">
            <LeaveBalanceManager />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
