import { useState } from 'react';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileDown } from 'lucide-react';
import { useCashBook } from '@/hooks/finance/useCashBook';
import { GL_REFERENCE_TYPE_LABELS } from '@/types/finance';
import { generateCashBookPdf } from '@/lib/financeReportPdfGenerator';

function formatMoney(amount: number) {
  return amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CashBook() {
  const [bankAccountId, setBankAccountId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const cashBook = useCashBook({
    bankAccountId: bankAccountId === 'all' ? undefined : bankAccountId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const selectedBankName =
    bankAccountId !== 'all'
      ? cashBook.bankAccounts.find((b) => b.id === bankAccountId)
      : null;

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
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                value={bankAccountId}
                onValueChange={(value) => setBankAccountId(value)}
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
                onChange={(event) => setStartDate(event.target.value)}
                placeholder="Start Date"
              />

              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                placeholder="End Date"
              />

              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBankAccountId('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash Book</CardTitle>
          </CardHeader>
          <CardContent>
            {!cashBook.entries.length && !cashBook.isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No cash book entries found for the selected filters.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ref Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashBook.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.entry_number}
                        </TableCell>
                        <TableCell>{entry.description || '-'}</TableCell>
                        <TableCell>
                          {GL_REFERENCE_TYPE_LABELS[entry.reference_type] || entry.reference_type}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.debit_amount > 0 ? formatMoney(entry.debit_amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.credit_amount > 0 ? formatMoney(entry.credit_amount) : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            entry.running_balance < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {formatMoney(entry.running_balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-medium">
                        Totals
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(cashBook.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(cashBook.totalCredit)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          cashBook.closingBalance < 0 ? 'text-red-600' : ''
                        }`}
                      >
                        {formatMoney(cashBook.closingBalance)}
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
