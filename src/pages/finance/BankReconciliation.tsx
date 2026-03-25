import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bot, CheckCircle2, Eye, PlusCircle } from 'lucide-react';
import { BankStatementExtractDialog } from '@/components/finance/BankStatementExtractDialog';
import { matchTransactions, type MatchResult } from '@/lib/bankStatementMatcher';
import type { ExtractionResult } from '@/lib/bankStatementExtractor';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useBankAccounts } from '@/hooks/finance/useFinanceFoundation';
import {
  useBankReconciliations,
  useCompleteReconciliation,
  useCreateReconciliation,
  useReconciliationDetail,
  useToggleReconciled,
} from '@/hooks/finance/useBankReconciliation';
import {
  BANK_RECONCILIATION_STATUS_LABELS,
  type BankReconciliation,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

interface NewReconForm {
  company_id: string;
  bank_account_id: string;
  statement_date: string;
  statement_balance: string;
}

function makeInitialForm(companyId: string): NewReconForm {
  return {
    company_id: companyId,
    bank_account_id: '',
    statement_date: new Date().toISOString().slice(0, 10),
    statement_balance: '',
  };
}

export default function BankReconciliationPage() {
  const { data: companies = [] } = useCompanies();
  const bankAccounts = useBankAccounts();

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c: any) => map.set(c.id, c.code || c.name));
    return map;
  }, [companies]);

  const [companyFilter, setCompanyFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NewReconForm>(makeInitialForm(''));
  const [detailId, setDetailId] = useState<string | null>(null);

  const reconciliations = useBankReconciliations({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
  });

  const createRecon = useCreateReconciliation();
  const detail = useReconciliationDetail(detailId);
  const toggleReconciled = useToggleReconciled();
  const completeRecon = useCompleteReconciliation();

  const rows = reconciliations.data || [];

  const filteredBankAccounts = useMemo(() => {
    if (!form.company_id) return bankAccounts.bankAccounts;
    return bankAccounts.bankAccounts.filter((account) => account.company_id === form.company_id);
  }, [bankAccounts.bankAccounts, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;

    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.company_id || !form.bank_account_id || !form.statement_date) return;

    const result = await createRecon.createReconciliation({
      company_id: form.company_id,
      bank_account_id: form.bank_account_id,
      statement_date: form.statement_date,
      statement_balance: Number(form.statement_balance || 0),
    });

    setDialogOpen(false);
    setDetailId(result.id);
  };

  const reconData = detail.data?.reconciliation;
  const reconItems = detail.data?.items || [];

  const sortedItems = useMemo(() => {
    return [...reconItems].sort((a, b) => {
      const dateA = a.entry_date || '';
      const dateB = b.entry_date || '';
      return dateA.localeCompare(dateB);
    });
  }, [reconItems]);

  const unreconciledCount = reconItems.filter((item) => !item.is_reconciled).length;

  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [extractedTxns, setExtractedTxns] = useState<ExtractionResult | null>(null);

  const handleExtracted = (result: ExtractionResult) => {
    setExtractedTxns(result);
    const matched = matchTransactions(result.transactions, reconItems);
    setMatchResult(matched);
  };

  const handleAutoReconcile = async () => {
    if (!matchResult || !detailId) return;
    for (const [itemId] of matchResult.matches) {
      await toggleReconciled.toggleReconciled({
        reconciliationId: detailId,
        itemId,
        isReconciled: true,
      });
    }
    setMatchResult(null);
    setExtractedTxns(null);
  };

  const handleToggle = async (itemId: string, checked: boolean) => {
    if (!detailId) return;
    await toggleReconciled.toggleReconciled({
      reconciliationId: detailId,
      itemId,
      isReconciled: checked,
    });
  };

  const handleComplete = async () => {
    if (!detailId) return;
    await completeRecon.completeReconciliation({ reconciliationId: detailId });
  };

  // If detailId is set, show detail view
  if (detailId) {
    return (
      <AppLayout>
        <PageLayout
          title="Bank Reconciliation Detail"
          description={
            reconData
              ? `${reconData.bank_account?.account_name || 'Bank Account'} - Statement ${reconData.statement_date}`
              : 'Loading...'
          }
          actions={
            <div className="flex gap-2">
              {reconData?.status === 'in_progress' && (
                <Button variant="outline" onClick={() => setExtractDialogOpen(true)}>
                  <Bot className="mr-2 h-4 w-4" />
                  Extract Statement
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetailId(null)}>
                Back to List
              </Button>
            </div>
          }
        >
          {reconData && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Statement Balance</p>
                    <p className="text-2xl font-bold">{formatMoney(reconData.statement_balance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Reconciled Balance</p>
                    <p className="text-2xl font-bold">{formatMoney(reconData.reconciled_balance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Unreconciled Items</p>
                    <p className="text-2xl font-bold">{unreconciledCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Difference</p>
                    <p className={`text-2xl font-bold ${Math.abs(reconData.difference) > 0.001 ? 'text-destructive' : 'text-green-600'}`}>
                      {formatMoney(reconData.difference)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {matchResult && extractedTxns && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">AI Match Results</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setMatchResult(null); setExtractedTxns(null); }}
                      >
                        Dismiss
                      </Button>
                      {matchResult.matches.size > 0 && (
                        <Button
                          size="sm"
                          onClick={handleAutoReconcile}
                          disabled={toggleReconciled.isToggling}
                        >
                          {toggleReconciled.isToggling ? 'Reconciling...' : `Auto-Reconcile ${matchResult.matches.size} Matches`}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 text-sm md:grid-cols-3">
                      <p className="text-green-600 font-medium">
                        Matched: {matchResult.matches.size}
                      </p>
                      <p className="text-amber-600 font-medium">
                        Unmatched (statement): {matchResult.unmatchedExtracted.length}
                      </p>
                      <p className="text-red-600 font-medium">
                        Unmatched (GL): {matchResult.unmatchedItems.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Header info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-2 text-sm md:grid-cols-4">
                    <p><span className="text-muted-foreground">Bank Account:</span> {reconData.bank_account?.account_name || '-'}</p>
                    <p><span className="text-muted-foreground">Bank:</span> {reconData.bank_account?.bank_name || '-'}</p>
                    <p><span className="text-muted-foreground">Statement Date:</span> {format(new Date(reconData.statement_date), 'dd MMM yyyy')}</p>
                    <p>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant={reconData.status === 'completed' ? 'default' : 'secondary'}>
                        {BANK_RECONCILIATION_STATUS_LABELS[reconData.status]}
                      </Badge>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Items table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Journal Entry Lines</CardTitle>
                  {reconData.status === 'in_progress' && (
                    <Button
                      onClick={handleComplete}
                      disabled={Math.abs(reconData.difference) > 0.001 || completeRecon.isCompleting}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {completeRecon.isCompleting ? 'Completing...' : 'Complete Reconciliation'}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {!sortedItems.length ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No journal entry lines found for this bank account.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Match</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Entry #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Ref Type</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedItems.map((item) => (
                            <TableRow
                              key={item.id}
                              className={matchResult?.matches.has(item.id) ? 'bg-green-50 dark:bg-green-950/20' : ''}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={item.is_reconciled}
                                  disabled={reconData.status === 'completed' || toggleReconciled.isToggling}
                                  onCheckedChange={(checked) => handleToggle(item.id, checked === true)}
                                />
                              </TableCell>
                              <TableCell>
                                {item.entry_date
                                  ? format(new Date(item.entry_date), 'dd MMM yyyy')
                                  : '-'}
                              </TableCell>
                              <TableCell className="font-medium">{item.entry_number || '-'}</TableCell>
                              <TableCell>{item.description || '-'}</TableCell>
                              <TableCell>{item.reference_type || '-'}</TableCell>
                              <TableCell className="text-right">
                                {(item.debit_amount || 0) > 0 ? formatMoney(item.debit_amount || 0) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {(item.credit_amount || 0) > 0 ? formatMoney(item.credit_amount || 0) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <BankStatementExtractDialog
                open={extractDialogOpen}
                onOpenChange={setExtractDialogOpen}
                onExtracted={handleExtracted}
              />
            </>
          )}
        </PageLayout>
      </AppLayout>
    );
  }

  // List view
  return (
    <AppLayout>
      <PageLayout
        title="Bank Reconciliation"
        description="Match bank statement balances against GL transactions."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Reconciliation
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={companyFilter}
                onValueChange={(value) => setCompanyFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reconciliation Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !reconciliations.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No bank reconciliations found.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank Account</TableHead>
                      {companyFilter === 'all' && <TableHead>Company</TableHead>}
                      <TableHead>Statement Date</TableHead>
                      <TableHead className="text-right">Statement Balance</TableHead>
                      <TableHead className="text-right">Reconciled Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((recon: BankReconciliation) => (
                      <TableRow key={recon.id}>
                        <TableCell className="font-medium">
                          {recon.bank_account?.account_name || '-'}
                          {recon.bank_account?.bank_name && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({recon.bank_account.bank_name})
                            </span>
                          )}
                        </TableCell>
                        {companyFilter === 'all' && (
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{companyMap.get(recon.company_id) || '-'}</span>
                          </TableCell>
                        )}
                        <TableCell>{format(new Date(recon.statement_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right">{formatMoney(recon.statement_balance)}</TableCell>
                        <TableCell className="text-right">{formatMoney(recon.reconciled_balance)}</TableCell>
                        <TableCell className={`text-right ${Math.abs(recon.difference) > 0.001 ? 'text-destructive' : ''}`}>
                          {formatMoney(recon.difference)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={recon.status === 'completed' ? 'default' : 'secondary'}>
                            {BANK_RECONCILIATION_STATUS_LABELS[recon.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(recon.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Reconciliation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Bank Reconciliation</DialogTitle>
              <DialogDescription>
                Create a reconciliation session by selecting a bank account and entering the statement balance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={form.company_id || 'none'}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      company_id: value === 'none' ? '' : value,
                      bank_account_id: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bank Account</Label>
                <Select
                  value={form.bank_account_id || 'none'}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, bank_account_id: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select bank account</SelectItem>
                    {filteredBankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_code} - {account.account_name} ({account.bank_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Statement Date</Label>
                <Input
                  type="date"
                  value={form.statement_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, statement_date: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Statement Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.statement_balance}
                  onChange={(event) => setForm((prev) => ({ ...prev, statement_balance: event.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  createRecon.isCreating
                  || !form.company_id
                  || !form.bank_account_id
                  || !form.statement_date
                }
              >
                {createRecon.isCreating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
