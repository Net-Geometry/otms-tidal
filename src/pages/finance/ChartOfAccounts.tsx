import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { COAFilterBar, type COAFilters } from '@/components/finance/COAFilterBar';
import { COATreeView } from '@/components/finance/COATreeView';
import { COAAccountForm } from '@/components/finance/COAAccountForm';
import {
  useCanEditCOA,
  useChartOfAccounts,
  useDeleteAccount,
  useUpsertAccount,
} from '@/hooks/finance/useChartOfAccounts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
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
  const { canEdit, isLoading: isLoadingPermission } = useCanEditCOA();

  return (
    <AppLayout>
      <PageLayout title="Chart of Accounts" description="Manage account hierarchy, posting accounts, and finance system mappings.">
        {!isLoadingPermission && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {canEdit
                ? 'You are managing the group Chart of Accounts.'
                : 'Chart of Accounts is managed by Tidal Holdings Sdn. Bhd.'}
            </AlertDescription>
          </Alert>
        )}

        <COAFilterBar
          filters={filters}
          onChange={setFilters}
          onAddAccount={() => {
            setEditingAccount(null);
            setFormOpen(true);
          }}
          readOnly={!canEdit}
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
                readOnly={!canEdit}
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
