import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Save, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompanies } from '@/hooks/hr/useCompanies';
import {
  useOpeningBalances,
  usePostableAccounts,
  useSaveOpeningBalances,
  usePostOpeningBalances,
} from '@/hooks/finance/useOpeningBalance';
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types/finance';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

const currentYear = new Date().getFullYear();
const FISCAL_YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function OpeningBalance() {
  const { profile } = useAuth();
  const companies = useCompanies();

  const [companyId, setCompanyId] = useState('');
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [balances, setBalances] = useState<Record<string, { debit: string; credit: string }>>({});

  // Default company from profile
  useEffect(() => {
    if (!companyId && profile?.company_id) {
      setCompanyId(profile.company_id);
    }
  }, [profile?.company_id, companyId]);

  const postableAccounts = usePostableAccounts(companyId);
  const openingBalances = useOpeningBalances(companyId, fiscalYear);
  const { saveOpeningBalances, isSaving } = useSaveOpeningBalances();
  const { postOpeningBalances, isPosting } = usePostOpeningBalances();

  // When opening balances load or accounts change, pre-fill the state
  useEffect(() => {
    if (!postableAccounts.data) return;

    const initial: Record<string, { debit: string; credit: string }> = {};
    for (const account of postableAccounts.data) {
      initial[account.id] = { debit: '', credit: '' };
    }

    // Overlay existing balances
    if (openingBalances.data) {
      for (const ob of openingBalances.data) {
        if (initial[ob.account_id]) {
          initial[ob.account_id] = {
            debit: ob.debit_amount > 0 ? ob.debit_amount.toString() : '',
            credit: ob.credit_amount > 0 ? ob.credit_amount.toString() : '',
          };
        }
      }
    }

    setBalances(initial);
  }, [postableAccounts.data, openingBalances.data]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const value of Object.values(balances)) {
      debit += Number(value.debit || 0);
      credit += Number(value.credit || 0);
    }
    return { debit, credit, difference: debit - credit };
  }, [balances]);

  const nonZeroCount = useMemo(() => {
    return Object.values(balances).filter(
      (v) => Number(v.debit || 0) > 0 || Number(v.credit || 0) > 0,
    ).length;
  }, [balances]);

  const isBalanced = Math.abs(totals.difference) <= 0.0001;
  const canPost = isBalanced && nonZeroCount > 0;

  const onChangeDebit = (accountId: string, value: string) => {
    setBalances((prev) => ({
      ...prev,
      [accountId]: {
        debit: value,
        credit: value && Number(value) > 0 ? '' : prev[accountId]?.credit || '',
      },
    }));
  };

  const onChangeCredit = (accountId: string, value: string) => {
    setBalances((prev) => ({
      ...prev,
      [accountId]: {
        debit: value && Number(value) > 0 ? '' : prev[accountId]?.debit || '',
        credit: value,
      },
    }));
  };

  const onSave = async () => {
    const entries = Object.entries(balances)
      .filter(([, v]) => Number(v.debit || 0) > 0 || Number(v.credit || 0) > 0)
      .map(([accountId, v]) => ({
        account_id: accountId,
        debit_amount: Number(v.debit || 0),
        credit_amount: Number(v.credit || 0),
      }));

    await saveOpeningBalances({
      companyId,
      fiscalYear,
      balances: entries,
    });
  };

  const onPost = async () => {
    await postOpeningBalances({ companyId, fiscalYear });
  };

  const accounts = postableAccounts.data || [];

  return (
    <AppLayout>
      <PageLayout
        title="Opening Balances"
        description="Set initial account balances for the selected fiscal year and post them to the General Ledger."
      >
        {/* Header Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies.data || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fiscal Year</label>
                <Select
                  value={fiscalYear.toString()}
                  onValueChange={(v) => setFiscalYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FISCAL_YEARS.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={onSave} disabled={isSaving || !companyId}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>

              <Button onClick={onPost} disabled={isPosting || !canPost || !companyId} variant="default">
                <Send className="mr-2 h-4 w-4" />
                {isPosting ? 'Posting...' : 'Post to GL'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Opening Balances Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {!companyId ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Select a company to view accounts.
              </div>
            ) : postableAccounts.isLoading || openingBalances.isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No postable accounts found. Set up your Chart of Accounts first.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="w-[120px]">Type</TableHead>
                      <TableHead className="w-[160px] text-right">Debit (MYR)</TableHead>
                      <TableHead className="w-[160px] text-right">Credit (MYR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const row = balances[account.id] || { debit: '', credit: '' };
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                          <TableCell>{account.account_name}</TableCell>
                          <TableCell>
                            {ACCOUNT_TYPE_LABELS[account.account_type as AccountType] || account.account_type}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="text-right"
                              value={row.debit}
                              onChange={(e) => onChangeDebit(account.id, e.target.value)}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="text-right"
                              value={row.credit}
                              onChange={(e) => onChangeCredit(account.id, e.target.value)}
                              placeholder="0.00"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Totals
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(totals.debit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(totals.credit)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Difference
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className={`text-right font-semibold ${
                          !isBalanced ? 'text-destructive' : 'text-green-600'
                        }`}
                      >
                        {formatMoney(totals.difference)}
                        {isBalanced ? ' (Balanced)' : ' (Unbalanced)'}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
