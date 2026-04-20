import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useApAging, type ApAgingStatus } from '@/hooks/finance/useFinanceReports';
import { generateApAgingPdf } from '@/lib/financeReportPdfGenerator';

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STATUS_LABEL: Record<ApAgingStatus, string> = {
  outstanding: 'Outstanding',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
};

const STATUS_BADGE_CLASS: Record<ApAgingStatus, string> = {
  outstanding: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  partially_paid: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  paid: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
};

export function ReportApAging() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const [includePaid, setIncludePaid] = useState(false);
  const { data: companies = [] } = useCompanies();

  const report = useApAging(
    companyId === 'all' ? undefined : companyId,
    asOfDate,
    includePaid,
  );

  const data = report.data;
  const hasData = data && data.rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AP Aging Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">As of Date</Label>
            <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
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

          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="include-paid"
              checked={includePaid}
              onCheckedChange={(checked) => setIncludePaid(checked === true)}
            />
            <Label htmlFor="include-paid" className="cursor-pointer text-sm font-normal">
              Include Paid Transactions
            </Label>
          </div>

          <div />

          <Button
            variant="outline"
            onClick={() => {
              if (!data) return;
              generateApAgingPdf({
                asOfDate,
                companyName: companyId === 'all' ? undefined : companies.find((c) => c.id === companyId)?.name,
                rows: data.rows,
                totals: data.totals,
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
          <div className="py-10 text-center text-sm text-muted-foreground">
            No AP invoices found{includePaid ? '' : ' (try ticking "Include Paid Transactions" to see paid items)'}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right w-24">Current</TableHead>
                  <TableHead className="text-right w-24">31-60</TableHead>
                  <TableHead className="text-right w-24">61-90</TableHead>
                  <TableHead className="text-right w-24">90+</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>PV Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((row) => (
                  <TableRow key={row.id} className={row.status === 'paid' ? 'opacity-70' : undefined}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{row.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">{row.supplier_code}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE_CLASS[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.original_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.paid_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(row.outstanding_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(row.buckets.current)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(row.buckets.days30)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(row.buckets.days60)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(row.buckets.days90plus)}</TableCell>
                    <TableCell className="text-xs">
                      {row.payment_date ? format(new Date(row.payment_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.payment_ref || '—'}</TableCell>
                  </TableRow>
                ))}

                <TableRow className="border-t-2 bg-muted/50">
                  <TableCell className="font-bold" colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.original_total)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.paid_total)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.total)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.current)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days30)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days60)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days90plus)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
