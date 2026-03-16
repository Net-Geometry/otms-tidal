import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CheckCircle, ClipboardList, PackageCheck, Search } from 'lucide-react';
import { ClaimRequestTable } from '@/components/claims/ClaimRequestTable';
import { useClaimApproval } from '@/hooks/claims/useClaimApproval';
import { useClaimPosting, type ClaimPostingTab } from '@/hooks/claims/useClaimPosting';
import { supabase } from '@/integrations/supabase/client';

type FinanceClaimsTab = 'pending_approval' | 'ready_to_post' | 'posted';

export default function ClaimsPosting() {
  const [tab, setTab] = useState<FinanceClaimsTab>('pending_approval');
  const [search, setSearch] = useState('');

  const approvals = useClaimApproval({ role: 'finance', tab: tab === 'pending_approval' ? 'pending' : 'all' });
  const postingTab: ClaimPostingTab = tab === 'posted' ? 'posted' : 'ready';
  const posting = useClaimPosting({ tab: postingTab });

  const currentRows = useMemo(() => {
    const rows = tab === 'pending_approval' ? approvals.data || [] : posting.data || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.profiles?.full_name || '';
      const type = r.claim_type?.name || '';
      return (
        r.ticket_number?.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [approvals.data, posting.data, search, tab]);

  const { data: stats } = useQuery({
    queryKey: ['claims-finance-stats'],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db.from('claims').select('status, is_posted');
      if (error) throw error;

      const pendingFinance = (data || []).filter((r: any) => r.status === 'pending_finance').length;
      const readyToPost = (data || []).filter((r: any) => r.status === 'hr_approved' && !r.is_posted).length;
      const posted = (data || []).filter((r: any) => r.status === 'hr_approved' && r.is_posted).length;
      return { pendingFinance, readyToPost, posted };
    },
    staleTime: 20 * 1000,
  });

  return (
    <AppLayout>
      <PageLayout title="Claims Posting" description="Finance approval and posting of claims.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pending Finance Approval"
            value={String(stats?.pendingFinance ?? '-')}
            subtitle="Awaiting finance decision"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Ready To Post"
            value={String(stats?.readyToPost ?? '-')}
            subtitle="HR approved"
            icon={CheckCircle}
          />
          <DashboardCard
            title="Posted"
            value={String(stats?.posted ?? '-')}
            subtitle="Marked as posted"
            icon={PackageCheck}
          />
        </div>

        <Card className="p-6 mt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FinanceClaimsTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending_approval">Pending Finance Approval</TabsTrigger>
              <TabsTrigger value="ready_to_post">Ready To Post</TabsTrigger>
              <TabsTrigger value="posted">Posted</TabsTrigger>
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

              {tab === 'pending_approval' ? (
                <ClaimRequestTable
                  requests={currentRows}
                  isLoading={approvals.isLoading}
                  role="finance"
                  enableBatch
                  onApprove={async (ids, remarks) => approvals.approveClaim({ requestIds: ids, remarks })}
                  onReject={async (ids, remarks) => approvals.rejectClaim({ requestIds: ids, remarks })}
                  isApproving={approvals.isApproving}
                  isRejecting={approvals.isRejecting}
                  showActions
                />
              ) : (
                <ClaimRequestTable
                  requests={currentRows}
                  isLoading={posting.isLoading}
                  role="finance"
                  enableBatch={false}
                  onPost={async (claimId, reference, remarks) => {
                    await posting.postClaims({ claimIds: [claimId], reference, remarks });
                  }}
                  isPosting={posting.isPosting}
                  showActions
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
