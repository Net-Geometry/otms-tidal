import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CheckCircle, ClipboardList, DollarSign, Receipt, Search, Settings2 } from 'lucide-react';
import { ClaimRequestTable } from '@/components/claims/ClaimRequestTable';
import { ClaimTypeSetup } from '@/components/claims/ClaimTypeSetup';
import { useClaimApproval, type ClaimApprovalTab } from '@/hooks/claims/useClaimApproval';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/otCalculations';

export default function Claims() {
  const [section, setSection] = useState<'requests' | 'types'>('requests');
  const [tab, setTab] = useState<ClaimApprovalTab>('pending');
  const [search, setSearch] = useState('');

  const approval = useClaimApproval({ role: 'hr', tab });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return approval.data || [];
    return (approval.data || []).filter((r) => {
      const name = r.profiles?.full_name || '';
      const type = r.claim_type?.name || '';
      return (
        r.ticket_number?.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [approval.data, search]);

  const { data: stats } = useQuery({
    queryKey: ['claims-hr-stats'],
    queryFn: async () => {
      const db = supabase as any;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await db
        .from('claims')
        .select('status, amount, created_at')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;

      const pendingHr = (data || []).filter((r: any) => ['pending_hr', 'supervisor_approved'].includes(r.status)).length;
      const pendingFinance = (data || []).filter((r: any) => r.status === 'pending_finance').length;
      const approvedCount = (data || []).filter((r: any) => ['hr_approved', 'finance_approved'].includes(r.status)).length;
      const approvedAmount = (data || [])
        .filter((r: any) => ['hr_approved', 'finance_approved'].includes(r.status))
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      return { pendingHr, pendingFinance, approvedCount, approvedAmount };
    },
    staleTime: 30 * 1000,
  });

  return (
    <AppLayout>
      <PageLayout title="Claims Management" description="Claims requests, approvals, and claim type setup.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pending (HR)"
            value={String(stats?.pendingHr ?? '-')}
            subtitle="Awaiting HR review"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Pending (Finance)"
            value={String(stats?.pendingFinance ?? '-')}
            subtitle="Forwarded to finance"
            icon={Receipt}
          />
          <DashboardCard
            title="Approved Amount (Month)"
            value={stats ? formatCurrency(Number(stats.approvedAmount)) : '-'}
            subtitle={stats ? `${stats.approvedCount} approved` : 'This month'}
            icon={DollarSign}
          />
        </div>

        <Tabs value={section} onValueChange={(v) => setSection(v as any)} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Claim Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-6">
            <Card className="p-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClaimApprovalTab)}>
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

                  <ClaimRequestTable
                    requests={filtered}
                    isLoading={approval.isLoading}
                    role="hr"
                    enableBatch={tab === 'pending'}
                    onApprove={async (ids, remarks) => approval.approveClaim({ requestIds: ids, remarks })}
                    onReject={async (ids, remarks) => approval.rejectClaim({ requestIds: ids, remarks })}
                    isApproving={approval.isApproving}
                    isRejecting={approval.isRejecting}
                    showActions
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </TabsContent>

          <TabsContent value="types" className="mt-6">
            <ClaimTypeSetup />
          </TabsContent>
        </Tabs>
      </PageLayout>
    </AppLayout>
  );
}
