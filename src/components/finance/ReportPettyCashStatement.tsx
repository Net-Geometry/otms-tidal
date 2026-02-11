import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePettyCashStatement } from '@/hooks/finance/useFinanceReports';
import { generatePettyCashStatementPdf } from '@/lib/financeReportPdfGenerator';
import { formatCurrency } from '@/lib/otCalculations';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function ReportPettyCashStatement() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const report = usePettyCashStatement({ month: Number(month), year: Number(year) });
  const statement = report.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Petty Cash Statement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((row) => (
                <SelectItem key={row.value} value={String(row.value)}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((row) => (
                <SelectItem key={row} value={String(row)}>
                  {row}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="md:col-span-2"
            variant="outline"
            onClick={() => {
              if (!statement) return;
              generatePettyCashStatementPdf({
                periodLabel: statement.periodLabel,
                openingBalance: statement.openingBalance,
                closingBalance: statement.closingBalance,
                rows: statement.rows.map((row: any) => ({
                  txn_number: row.txn_number,
                  txn_date: row.txn_date,
                  description: row.description,
                  txn_type: row.txn_type,
                  status: row.status,
                  amount: Number(row.amount || 0),
                })),
              });
            }}
            disabled={!statement?.rows?.length}
          >
            Export PDF
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Opening Balance</div>
            <div className="text-lg font-semibold">{formatCurrency(Number(statement?.openingBalance || 0))}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Total Top-ups</div>
            <div className="text-lg font-semibold text-green-600">{formatCurrency(Number(statement?.totalTopUps || 0))}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Total Expenditures</div>
            <div className="text-lg font-semibold">{formatCurrency(Number(statement?.totalExpenditures || 0))}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Closing Balance</div>
            <div className="text-lg font-semibold">{formatCurrency(Number(statement?.closingBalance || 0))}</div>
          </div>
        </div>

        {report.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading statement...</div>
        ) : !statement?.rows?.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No transactions found for selected month.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.txn_number}</TableCell>
                    <TableCell>{format(new Date(row.txn_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.txn_type.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(row.amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
