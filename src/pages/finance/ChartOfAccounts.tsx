import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { COAFilterBar, type COAFilters } from '@/components/finance/COAFilterBar';
import { COATreeView } from '@/components/finance/COATreeView';
import { COAAccountForm } from '@/components/finance/COAAccountForm';
import {
  useChartOfAccounts,
  useDeleteAccount,
  useUpsertAccount,
} from '@/hooks/finance/useChartOfAccounts';
import type { ChartOfAccount } from '@/types/finance';

export default function ChartOfAccounts() {
  const [filters, setFilters] = useState<COAFilters>({
    accountType: 'all',
    activity: 'active',
    search: '',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

  const coa = useChartOfAccounts({
    accountType: filters.accountType,
    activity: filters.activity,
    search: filters.search,
  });
  const upsert = useUpsertAccount();
  const deactivate = useDeleteAccount();

  return (
    <AppLayout>
      <PageLayout title="Chart of Accounts" description="Manage account hierarchy, posting accounts, and finance system mappings.">
        <COAFilterBar
          filters={filters}
          onChange={setFilters}
          onAddAccount={() => {
            setEditingAccount(null);
            setFormOpen(true);
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Tree</CardTitle>
          </CardHeader>
          <CardContent>
            {coa.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading chart of accounts...</div>
            ) : (
              <COATreeView
                tree={coa.tree}
                onEdit={(account) => {
                  setEditingAccount(account);
                  setFormOpen(true);
                }}
                onDeactivate={async (account) => {
                  await deactivate.deleteAccount(account.id);
                }}
              />
            )}
          </CardContent>
        </Card>

        <COAAccountForm
          open={formOpen}
          onOpenChange={setFormOpen}
          account={editingAccount}
          accounts={coa.accounts}
          onSave={upsert.upsertAccount}
          isSaving={upsert.isSaving}
        />
      </PageLayout>
    </AppLayout>
  );
}
