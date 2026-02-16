import { useState } from 'react';
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
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useApAging } from '@/hooks/finance/useFinanceReports';
import { generateApAgingPdf } from '@/lib/financeReportPdfGenerator';

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ReportApAging() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const { data: companies = [] } = useCompanies();

  const report = useApAging(
    companyId === 'all' ? undefined : companyId,
    asOfDate,
  );

  const data = report.data;
  const hasData = data && data.rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AP Aging Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4 items-end">
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
          <div className="py-10 text-center text-sm text-muted-foreground">No outstanding AP invoices found.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Code</TableHead>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead className="text-right w-32">Current (0-30)</TableHead>
                  <TableHead className="text-right w-32">31-60</TableHead>
                  <TableHead className="text-right w-32">61-90</TableHead>
                  <TableHead className="text-right w-32">90+</TableHead>
                  <TableHead className="text-right w-32">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.buckets.current)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.buckets.days30)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.buckets.days60)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.buckets.days90plus)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(row.buckets.total)}</TableCell>
                  </TableRow>
                ))}

                <TableRow className="border-t-2 bg-muted/50">
                  <TableCell className="font-bold" colSpan={2}>TOTAL</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.current)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days30)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days60)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.days90plus)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totals.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
