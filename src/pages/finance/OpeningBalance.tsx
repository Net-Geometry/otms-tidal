import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, Send } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import {
  useOpeningBalances,
  useSaveOpeningBalances,
  usePostOpeningBalances,
} from '@/hooks/finance/useOpeningBalance';
import { ACCOUNT_TYPE_LABELS, type AccountType, type ChartOfAccount } from '@/types/finance';

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

function levelIndent(level: number) {
  if (level <= 0) return 'pl-0';
  if (level === 1) return 'pl-6';
  if (level === 2) return 'pl-12';
  if (level === 3) return 'pl-18';
  return 'pl-24';
}

interface TreeNodeProps {
  node: ChartOfAccount;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  balances: Record<string, { debit: string; credit: string }>;
  onChangeDebit: (accountId: string, value: string) => void;
  onChangeCredit: (accountId: string, value: string) => void;
}

function TreeNode({ node, expanded, onToggle, balances, onChangeDebit, onChangeCredit }: TreeNodeProps) {
  const hasChildren = !!node.children?.length;
  const isOpen = !!expanded[node.id];
  const row = balances[node.id] || { debit: '', credit: '' };

  return (
    <>
      <div className={`flex items-center gap-2 border-b py-1.5 ${levelIndent(node.level)}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onToggle(node.id)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="h-7 w-7 shrink-0" />
          )}

          <span className="font-mono text-xs text-muted-foreground shrink-0">{node.account_code}</span>
          <span className={`truncate ${node.is_postable ? 'text-sm' : 'text-sm font-semibold'}`}>
            {node.account_name}
          </span>
          {!node.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
          {node.is_postable && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {ACCOUNT_TYPE_LABELS[node.account_type as AccountType] || node.account_type}
            </Badge>
          )}
        </div>

        {node.is_postable ? (
          <div className="flex items-center gap-2 shrink-0">
            <Input
              type="number"
              min="0"
              step="0.01"
              className="text-right w-[140px] h-8"
              value={row.debit}
              onChange={(e) => onChangeDebit(node.id, e.target.value)}
              placeholder="Debit"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              className="text-right w-[140px] h-8"
              value={row.credit}
              onChange={(e) => onChangeCredit(node.id, e.target.value)}
              placeholder="Credit"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0 w-[296px]" />
        )}
      </div>

      {hasChildren && isOpen && node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          expanded={expanded}
          onToggle={onToggle}
          balances={balances}
          onChangeDebit={onChangeDebit}
          onChangeCredit={onChangeCredit}
        />
      ))}
    </>
  );
}

export default function OpeningBalance() {
  const { profile } = useAuth();
  const companies = useCompanies();

  const [companyId, setCompanyId] = useState('');
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [balances, setBalances] = useState<Record<string, { debit: string; credit: string }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Default company from profile
  useEffect(() => {
    if (!companyId && profile?.company_id) {
      setCompanyId(profile.company_id);
    }
  }, [profile?.company_id, companyId]);

  const { tree, accounts, isLoading: coaLoading } = useChartOfAccounts({ activity: 'active' });
  const openingBalances = useOpeningBalances(companyId, fiscalYear);
  const { saveOpeningBalances, isSaving } = useSaveOpeningBalances();
  const { postOpeningBalances, isPosting } = usePostOpeningBalances();

  // Expand root nodes by default
  useEffect(() => {
    if (tree.length > 0) {
      setExpanded((prev) => {
        const initial: Record<string, boolean> = {};
        for (const root of tree) initial[root.id] = true;
        return { ...initial, ...prev };
      });
    }
  }, [tree]);

  // Build postable account IDs set for balance tracking
  const postableIds = useMemo(() => {
    return new Set(accounts.filter((a) => a.is_postable && a.is_active).map((a) => a.id));
  }, [accounts]);

  // When opening balances load, pre-fill the state
  useEffect(() => {
    if (postableIds.size === 0) return;

    const initial: Record<string, { debit: string; credit: string }> = {};
    for (const id of postableIds) {
      initial[id] = { debit: '', credit: '' };
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
  }, [postableIds, openingBalances.data]);

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

  const onToggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const isLoadingData = coaLoading || openingBalances.isLoading;

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

        {/* Opening Balances Tree */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Account Balances</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  Total Debit: <strong>{formatMoney(totals.debit)}</strong>
                </span>
                <span>
                  Total Credit: <strong>{formatMoney(totals.credit)}</strong>
                </span>
                <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>
                  Diff: <strong>{formatMoney(totals.difference)}</strong>
                  {isBalanced ? ' (Balanced)' : ' (Unbalanced)'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!companyId ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Select a company to view accounts.
              </div>
            ) : isLoadingData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading accounts...
              </div>
            ) : tree.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No accounts found. Set up your Chart of Accounts first.
              </div>
            ) : (
              <div className="rounded-md border">
                {/* Column headers */}
                <div className="flex items-center gap-2 border-b py-2 px-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div className="flex-1">Account</div>
                  <div className="w-[140px] text-right">Debit (MYR)</div>
                  <div className="w-[140px] text-right">Credit (MYR)</div>
                  <div className="w-4" />
                </div>
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    expanded={expanded}
                    onToggle={onToggle}
                    balances={balances}
                    onChangeDebit={onChangeDebit}
                    onChangeCredit={onChangeCredit}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
