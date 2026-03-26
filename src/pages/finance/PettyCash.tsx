import { useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageLayout } from '@/components/ui/page-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PettyCashBalanceCard } from '@/components/finance/PettyCashBalanceCard';
import { PettyCashTxnForm } from '@/components/finance/PettyCashTxnForm';
import { PettyCashTxnTable } from '@/components/finance/PettyCashTxnTable';
import { usePettyCashTransactions } from '@/hooks/finance/usePettyCashTransactions';
import { usePettyCashBalance } from '@/hooks/finance/usePettyCashBalance';
import { useProjects } from '@/hooks/finance/useProjects';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useDepartments } from '@/hooks/hr/useDepartments';

export default function PettyCash() {
  const [txnFormOpen, setTxnFormOpen] = useState(false);
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [txnType, setTxnType] = useState<'all' | 'top_up' | 'expenditure'>('all');
  const [search, setSearch] = useState('');
  const [selectedFundId, setSelectedFundId] = useState<string>('');

  const balance = usePettyCashBalance(selectedFundId || undefined);
  const projects = useProjects();
  const coa = useChartOfAccounts({ accountType: 'all', activity: 'active', search: '' });
  const expenseCoa = useChartOfAccounts({ accountType: 'expense', activity: 'active', search: '' });
  const departments = useDepartments();

  const fundAccounts = useMemo(() => {
    return (coa.accounts || []).filter(
      (a) => (a.special_type === 'CH' || a.system_tag === 'petty_cash') && a.is_postable,
    );
  }, [coa.accounts]);

  const txns = usePettyCashTransactions({
    status,
    txnType,
    search,
    fundAccountId: selectedFundId || undefined,
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
      <PageLayout title="Petty Cash" description="Track petty cash float, postings, and transaction receipts.">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-64">
            <label className="text-sm font-medium mb-1 block">Petty Cash Fund</label>
            <Select value={selectedFundId || 'all'} onValueChange={(v) => setSelectedFundId(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Funds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Funds</SelectItem>
                {fundAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} - {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
          onPost={(txnId) => txns.postTransaction({ txnId })}
          isPosting={txns.isPosting}
        />

        <PettyCashTxnForm
          open={txnFormOpen}
          onOpenChange={setTxnFormOpen}
          accounts={expenseCoa.accounts}
          fundAccounts={fundAccounts}
          projects={projects.projects}
          departments={departments.data || []}
          isSubmitting={txns.isCreating}
          onSubmit={async (values) => {
            await txns.createTransaction({
              txn_type: values.txn_type,
              txn_date: values.txn_date,
              description: values.description,
              fund_account_id: values.fund_account_id,
              lines: values.lines.map((l) => ({
                account_id: l.account_id,
                description: l.description || '',
                amount: Number(l.amount || 0),
              })),
              project_id: values.project_id || null,
              receipt_urls: values.receipt_urls,
              payee: values.payee || null,
              department: values.department || null,
              tax_amount: Number(values.tax_amount || 0),
            });
          }}
        />
      </PageLayout>
    </AppLayout>
  );
}
