import { useMemo, useState } from 'react';
import { format } from 'date-fns';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileDown, BookOpen, Search } from 'lucide-react';
import { useCashBook, type CashBookEntry } from '@/hooks/finance/useCashBook';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { GL_REFERENCE_TYPE_LABELS } from '@/types/finance';
import { generateCashBookPdf } from '@/lib/financeReportPdfGenerator';

const PAGE_SIZE = 20;

function formatMoney(amount: number) {
  return amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CashBook() {
  const [companyFilter, setCompanyFilter] = useState('');
  const [bankAccountId, setBankAccountId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailEntry, setDetailEntry] = useState<CashBookEntry | null>(null);

  const { data: companies = [] } = useCompanies();

  const cashBook = useCashBook({
    companyId: companyFilter || undefined,
    bankAccountId: bankAccountId === 'all' ? undefined : bankAccountId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Client-side search filter
  const filteredEntries = useMemo(() => {
    if (!search.trim()) return cashBook.entries;
    const term = search.toLowerCase();
    return cashBook.entries.filter(
      (entry) =>
        entry.entry_number?.toLowerCase().includes(term) ||
        entry.description?.toLowerCase().includes(term) ||
        entry.source_doc?.toLowerCase().includes(term) ||
        (GL_REFERENCE_TYPE_LABELS[entry.reference_type] || '').toLowerCase().includes(term)
    );
  }, [cashBook.entries, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paginatedEntries = filteredEntries.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const selectedBankName =
    bankAccountId !== 'all'
      ? cashBook.bankAccounts.find((b) => b.id === bankAccountId)
      : null;

  // Summary stats
  const stats = useMemo(() => {
    return {
      entryCount: cashBook.entries.length,
      totalDebit: cashBook.totalDebit,
      totalCredit: cashBook.totalCredit,
      closingBalance: cashBook.closingBalance,
    };
  }, [cashBook.entries.length, cashBook.totalDebit, cashBook.totalCredit, cashBook.closingBalance]);

  const handleExportPdf = () => {
    const bankLabel = selectedBankName
      ? `${selectedBankName.account_code} - ${selectedBankName.account_name} (${selectedBankName.bank_name})`
      : 'All Bank Accounts';

    const dateRange =
      startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
          ? `From ${startDate}`
          : endDate
            ? `Up to ${endDate}`
            : 'All Dates';

    generateCashBookPdf({
      bankAccountLabel: bankLabel,
      dateRange,
      rows: cashBook.entries.map((entry) => ({
        entry_date: format(new Date(entry.entry_date), 'dd MMM yyyy'),
        entry_number: entry.entry_number,
        description: entry.description || '-',
        reference_type: GL_REFERENCE_TYPE_LABELS[entry.reference_type] || entry.reference_type,
        debit_amount: entry.debit_amount,
        credit_amount: entry.credit_amount,
        running_balance: entry.running_balance,
      })),
      totalDebit: cashBook.totalDebit,
      totalCredit: cashBook.totalCredit,
      closingBalance: cashBook.closingBalance,
    });
  };

  return (
    <AppLayout>
      <PageLayout
        title="Cash Book"
        description="View all bank and cash transactions in chronological order with running balance."
        actions={
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={cashBook.entries.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        }
      >
        {/* ── Summary Cards ── */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entries</p>
              <p className="text-2xl font-bold mt-1">{stats.entryCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Debits</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{formatMoney(stats.totalDebit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Credits</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{formatMoney(stats.totalCredit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closing Balance</p>
              <p className={`text-2xl font-bold mt-1 ${stats.closingBalance < 0 ? 'text-red-600' : ''}`}>
                {formatMoney(stats.closingBalance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ── */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Select
                value={companyFilter || 'default'}
                onValueChange={(value) => {
                  setCompanyFilter(value === 'default' ? '' : value);
                  setBankAccountId('all');
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">My Company</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.code || company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={bankAccountId}
                onValueChange={(value) => { setBankAccountId(value); setPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bank Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bank Accounts</SelectItem>
                  {cashBook.bankAccounts.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.account_code} - {bank.account_name} ({bank.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={startDate}
                onChange={(event) => { setStartDate(event.target.value); setPage(1); }}
                placeholder="Start Date"
              />

              <Input
                type="date"
                value={endDate}
                onChange={(event) => { setEndDate(event.target.value); setPage(1); }}
                placeholder="End Date"
              />

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entry or description"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Register Table ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cash Book Register</CardTitle>
              {search.trim() && (
                <Badge variant="secondary">{filteredEntries.length} results</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!filteredEntries.length && !cashBook.isLoading ? (
              <div className="py-16 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No cash book entries found.</p>
                <p className="text-xs text-muted-foreground mt-1">Adjust your filters or select a different bank account.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="min-w-[120px]">Entry #</TableHead>
                      <TableHead className="w-[130px]">Source Doc</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-[120px]">Ref Type</TableHead>
                      <TableHead className="text-right w-[120px]">Debit</TableHead>
                      <TableHead className="text-right w-[120px]">Credit</TableHead>
                      <TableHead className="text-right w-[130px]">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="group cursor-pointer"
                        onClick={() => setDetailEntry(entry)}
                      >
                        <TableCell>
                          <span className="text-sm tabular-nums">
                            {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-medium">
                            {entry.entry_number}
                          </span>
                        </TableCell>
                        <TableCell>
                          {entry.source_doc ? (
                            <span className="font-mono text-xs text-primary">{entry.source_doc}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                            {entry.description || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {GL_REFERENCE_TYPE_LABELS[entry.reference_type] || entry.reference_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm tabular-nums">
                            {entry.debit_amount > 0 ? formatMoney(entry.debit_amount) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm tabular-nums">
                            {entry.credit_amount > 0 ? formatMoney(entry.credit_amount) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-mono text-sm tabular-nums font-medium ${
                              entry.running_balance < 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {formatMoney(entry.running_balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {page} of {totalPages} ({filteredEntries.length} entries)
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>{detailEntry?.entry_number || 'Entry'}</DialogTitle>
                {detailEntry && (
                  <Badge variant="outline">
                    {GL_REFERENCE_TYPE_LABELS[detailEntry.reference_type] || detailEntry.reference_type}
                  </Badge>
                )}
              </div>
              <DialogDescription>Cash book entry details.</DialogDescription>
            </DialogHeader>

            {detailEntry && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{format(new Date(detailEntry.entry_date), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entry #</span>
                      <span className="font-mono font-medium">{detailEntry.entry_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ref Type</span>
                      <span>{GL_REFERENCE_TYPE_LABELS[detailEntry.reference_type] || detailEntry.reference_type}</span>
                    </div>
                    {detailEntry.source_doc && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Source Doc</span>
                        <span className="font-mono font-medium text-primary">{detailEntry.source_doc}</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Debit</span>
                      <span className="font-mono font-medium text-green-600">
                        {detailEntry.debit_amount > 0 ? formatMoney(detailEntry.debit_amount) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Credit</span>
                      <span className="font-mono font-medium text-blue-600">
                        {detailEntry.credit_amount > 0 ? formatMoney(detailEntry.credit_amount) : '-'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Running Balance</span>
                      <span className={`text-base font-bold ${detailEntry.running_balance < 0 ? 'text-red-600' : ''}`}>
                        {formatMoney(detailEntry.running_balance)}
                      </span>
                    </div>
                  </div>
                </div>

                {detailEntry.description && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <span className="text-muted-foreground">Description: </span>
                    {detailEntry.description}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
