import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useGLReport, type GLReportAccount } from '@/hooks/finance/useFinanceReports';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { generateGLReportPdf } from '@/lib/financeReportPdfGenerator';

function currentMonthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AccountSection({ account }: { account: GLReportAccount }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border mb-4">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between bg-muted/50 px-4 py-2 cursor-pointer hover:bg-muted/70">
            <div className="flex items-center gap-2 font-semibold text-sm">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {account.account_code} - {account.account_name}
            </div>
            <div className="text-sm text-muted-foreground">
              Opening: RM {fmt(account.opening_balance)}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-32">Entry #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Ref Type</TableHead>
                <TableHead className="text-right w-32">Debit (RM)</TableHead>
                <TableHead className="text-right w-32">Credit (RM)</TableHead>
                <TableHead className="text-right w-36">Balance (RM)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">
                    No transactions in this period.
                  </TableCell>
                </TableRow>
              ) : (
                account.transactions.map((txn, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{txn.entry_date}</TableCell>
                    <TableCell className="text-sm">{txn.entry_number}</TableCell>
                    <TableCell className="text-sm">{txn.description}</TableCell>
                    <TableCell className="text-sm">{txn.reference_type}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {txn.debit_amount > 0 ? fmt(txn.debit_amount) : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {txn.credit_amount > 0 ? fmt(txn.credit_amount) : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {fmt(txn.running_balance)}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow className="bg-muted/30 border-t-2">
                <TableCell colSpan={6} className="font-semibold text-sm">
                  Closing Balance
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-sm">
                  {fmt(account.closing_balance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ReportGLListing() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const { data: companies = [] } = useCompanies();
  const { accounts: coaAccounts } = useChartOfAccounts();

  const postableAccounts = useMemo(
    () => coaAccounts.filter((a) => a.is_postable && a.is_active).sort((a, b) => a.account_code.localeCompare(b.account_code)),
    [coaAccounts],
  );

  const report = useGLReport({
    startDate,
    endDate,
    companyId: companyId === 'all' ? undefined : companyId,
    accountId: accountId === 'all' ? undefined : accountId,
  });

  const data = report.data;
  const hasData = data && data.accounts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General Ledger Listing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {postableAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.account_code} - {a.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              if (!data) return;
              generateGLReportPdf({
                startDate,
                endDate,
                companyName: companyId === 'all' ? undefined : companies.find((c) => c.id === companyId)?.name,
                accounts: data.accounts,
              });
            }}
            disabled={!hasData}
          >
            Export PDF
          </Button>
        </div>

        {report.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading report...</div>
        ) : !hasData ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No data for selected period.</div>
        ) : (
          <div className="space-y-0">
            {data!.accounts.map((account) => (
              <AccountSection key={account.account_id} account={account} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
