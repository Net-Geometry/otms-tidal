import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePaymentRegister } from '@/hooks/finance/useFinanceReports';
import { generatePaymentRegisterPdf } from '@/lib/financeReportPdfGenerator';
import { formatCurrency } from '@/lib/otCalculations';

function currentMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

export function ReportPaymentRegister() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const report = usePaymentRegister({ startDate, endDate });

  const rows = report.data?.rows || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Register</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Button
            variant="outline"
            onClick={() => {
              generatePaymentRegisterPdf({
                startDate,
                endDate,
                rows: rows.map((row: any) => ({
                  source: row.source,
                  reference_no: row.reference_no,
                  posting_reference: row.posting_reference,
                  posted_at: row.posted_at,
                  description: row.description,
                  amount: Number(row.amount || 0),
                })),
                totalAmount: Number(report.data?.totalAmount || 0),
              });
            }}
            disabled={!rows.length}
          >
            Export PDF
          </Button>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Total Amount</div>
          <div className="text-lg font-semibold">{formatCurrency(Number(report.data?.totalAmount || 0))}</div>
        </div>

        {report.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading register...</div>
        ) : !rows.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No posted payments in selected date range.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Posting Ref</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={`${row.source}-${row.id}`}>
                    <TableCell>{row.posted_at ? new Date(row.posted_at).toISOString().slice(0, 10) : '-'}</TableCell>
                    <TableCell className="capitalize">{String(row.source).replace('_', ' ')}</TableCell>
                    <TableCell className="font-medium">{row.reference_no}</TableCell>
                    <TableCell>{row.posting_reference || '-'}</TableCell>
                    <TableCell>{row.description}</TableCell>
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
