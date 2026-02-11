import { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageLayout } from '@/components/ui/page-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PettyCashBalanceCard } from '@/components/finance/PettyCashBalanceCard';
import { PettyCashSettingsForm } from '@/components/finance/PettyCashSettingsForm';
import { PettyCashTxnForm } from '@/components/finance/PettyCashTxnForm';
import { PettyCashTxnTable } from '@/components/finance/PettyCashTxnTable';
import { usePettyCashSettings } from '@/hooks/finance/usePettyCashSettings';
import { usePettyCashTransactions } from '@/hooks/finance/usePettyCashTransactions';
import { usePettyCashBalance } from '@/hooks/finance/usePettyCashBalance';
import { useProjects } from '@/hooks/finance/useProjects';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';

export default function PettyCash() {
  const [tab, setTab] = useState<'settings' | 'transactions'>('transactions');
  const [txnFormOpen, setTxnFormOpen] = useState(false);
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [txnType, setTxnType] = useState<'all' | 'top_up' | 'expenditure'>('all');
  const [search, setSearch] = useState('');

  const settings = usePettyCashSettings();
  const balance = usePettyCashBalance();
  const projects = useProjects();
  const coa = useChartOfAccounts({ accountType: 'expense', activity: 'active', search: '' });

  const txns = usePettyCashTransactions({
    status,
    txnType,
    search,
  });

  const stats = useMemo(() => {
    const rows = txns.transactions || [];
    return {
      pending: rows.filter((row) => row.status === 'pending').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      posted: rows.filter((row) => row.is_posted).length,
    };
  }, [txns.transactions]);

  return (
    <AppLayout>
      <PageLayout title="Petty Cash" description="Track petty cash float, approvals, postings, and transaction receipts.">
        <div className="grid gap-4 lg:grid-cols-3">
          <PettyCashBalanceCard
            balance={Number(balance.data?.balance || 0)}
            floatAmount={Number(balance.data?.floatAmount || 0)}
            utilizationPct={Number(balance.data?.utilizationPct || 0)}
            totalTopUps={Number(balance.data?.totalTopUps || 0)}
            totalExpenditures={Number(balance.data?.totalExpenditures || 0)}
          />
          <DashboardCard title="Pending Approval" value={stats.pending} subtitle="Awaiting finance action" icon={PlusCircle} />
          <DashboardCard title="Approved / Posted" value={`${stats.approved} / ${stats.posted}`} subtitle="Approval and posting progress" icon={PlusCircle} />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'settings' | 'transactions')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4 pt-2">
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <Input
                    className="md:col-span-2"
                    placeholder="Search transaction, account, project..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <Select value={txnType} onValueChange={(value) => setTxnType(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="top_up">Top-up</SelectItem>
                      <SelectItem value="expenditure">Expenditure</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={status} onValueChange={(value) => setStatus(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button onClick={() => setTxnFormOpen(true)}>
                    New Transaction
                  </Button>
                </div>
              </CardContent>
            </Card>

            <PettyCashTxnTable
              transactions={txns.transactions}
              isLoading={txns.isLoading}
              onApprove={(txnId, remarks) => txns.approveTransaction({ txnId, approve: true, remarks })}
              onReject={(txnId, remarks) => txns.approveTransaction({ txnId, approve: false, remarks })}
              onPost={(txnId) => txns.postTransaction({ txnId })}
              isApproving={txns.isApproving}
              isPosting={txns.isPosting}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 pt-2">
            <PettyCashSettingsForm
              settings={settings.settings}
              onSave={settings.updateSettings}
              isSaving={settings.isSaving}
            />
          </TabsContent>
        </Tabs>

        <PettyCashTxnForm
          open={txnFormOpen}
          onOpenChange={setTxnFormOpen}
          accounts={coa.accounts}
          projects={projects.projects}
          isSubmitting={txns.isCreating}
          onSubmit={async (values) => {
            await txns.createTransaction({
              txn_type: values.txn_type,
              txn_date: values.txn_date,
              amount: values.amount,
              description: values.description,
              account_id: values.account_id,
              project_id: values.project_id || null,
              receipt_urls: values.receipt_urls,
            });
          }}
        />
      </PageLayout>
    </AppLayout>
  );
}
