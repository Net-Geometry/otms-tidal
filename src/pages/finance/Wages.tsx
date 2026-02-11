import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, ClipboardList, PackageCheck, Search } from 'lucide-react';
import { PayrollRunsTable } from '@/components/payroll/PayrollRunsTable';
import { usePayrollApproval, type PayrollApprovalTab } from '@/hooks/payroll/usePayrollApproval';
import { usePayrollPosting, type PayrollPostingTab } from '@/hooks/payroll/usePayrollPosting';

type FinanceWagesTab = 'pending_approval' | 'ready_to_post' | 'posted';

export default function Wages() {
  const [tab, setTab] = useState<FinanceWagesTab>('pending_approval');
  const [search, setSearch] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [postingRunId, setPostingRunId] = useState('');
  const [postRef, setPostRef] = useState('');
  const [postRemarks, setPostRemarks] = useState('');

  const approvalTab: PayrollApprovalTab = tab === 'pending_approval' ? 'pending' : 'all';
  const approvals = usePayrollApproval({ role: 'finance', tab: approvalTab });

  const postingTab: PayrollPostingTab = tab === 'posted' ? 'posted' : 'ready';
  const posting = usePayrollPosting({ tab: postingTab });

  const currentRows = useMemo(() => {
    const rows = tab === 'pending_approval' ? approvals.data || [] : posting.data || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const company = r.companies?.name || '';
      return (
        r.run_number?.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q)
      );
    });
  }, [approvals.data, posting.data, search, tab]);

  const pendingCount = (approvals.data || []).filter((r) => r.status === 'pending_finance').length;
  const readyCount = (posting.data || []).filter((r) => !r.is_posted).length;
  const postedCount = tab === 'posted' ? (posting.data || []).length : 0;

  const handlePost = async () => {
    if (!postingRunId) return;
    await posting.postPayrollRuns({
      runIds: [postingRunId],
      reference: postRef || undefined,
      remarks: postRemarks || undefined,
    });
    setPostOpen(false);
    setPostRef('');
    setPostRemarks('');
    setPostingRunId('');
  };

  return (
    <AppLayout>
      <PageLayout title="Wages Posting" description="Payroll approval and posting for finance.">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Pending Finance Approval"
            value={String(pendingCount)}
            subtitle="Awaiting finance decision"
            icon={ClipboardList}
          />
          <DashboardCard
            title="Ready To Post"
            value={String(readyCount)}
            subtitle="Finance approved"
            icon={CheckCircle}
          />
          <DashboardCard
            title="Posted"
            value={String(postedCount)}
            subtitle="Marked as posted"
            icon={PackageCheck}
          />
        </div>

        <Card className="p-6 mt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FinanceWagesTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>
              <TabsTrigger value="ready_to_post">Ready To Post</TabsTrigger>
              <TabsTrigger value="posted">Posted</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by run number or company..."
                  className="pl-9"
                />
              </div>

              {tab === 'pending_approval' && (
                <>
                  <PayrollRunsTable
                    runs={currentRows}
                    isLoading={approvals.isLoading}
                    basePath="/hr/payroll"
                  />
                  {currentRows.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      {currentRows
                        .filter((r) => r.status === 'pending_finance')
                        .map((r) => (
                          <Button
                            key={r.id}
                            size="sm"
                            onClick={() => approvals.approvePayrollRun({ runId: r.id })}
                            disabled={approvals.isApproving}
                          >
                            Approve {r.run_number}
                          </Button>
                        ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'ready_to_post' && (
                <>
                  <PayrollRunsTable
                    runs={currentRows}
                    isLoading={posting.isLoading}
                    basePath="/hr/payroll"
                  />
                  {currentRows.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      {currentRows
                        .filter((r) => !r.is_posted)
                        .map((r) => (
                          <Button
                            key={r.id}
                            size="sm"
                            onClick={() => {
                              setPostingRunId(r.id);
                              setPostOpen(true);
                            }}
                            disabled={posting.isPosting}
                          >
                            Post {r.run_number}
                          </Button>
                        ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'posted' && (
                <PayrollRunsTable
                  runs={currentRows}
                  isLoading={posting.isLoading}
                  basePath="/hr/payroll"
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <Dialog open={postOpen} onOpenChange={setPostOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post Payroll Run</DialogTitle>
              <DialogDescription>Mark this payroll run as posted with an optional reference.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Posting Reference</Label>
                <Input
                  value={postRef}
                  onChange={(e) => setPostRef(e.target.value)}
                  placeholder="e.g. JV-2026-02-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={postRemarks}
                  onChange={(e) => setPostRemarks(e.target.value)}
                  placeholder="Any notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button>
              <Button onClick={handlePost} disabled={posting.isPosting}>
                {posting.isPosting ? 'Posting...' : 'Confirm Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
