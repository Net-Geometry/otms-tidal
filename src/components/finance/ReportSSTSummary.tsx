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
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useSSTReport } from '@/hooks/finance/useFinanceReports';
import { generateSSTSummaryPdf } from '@/lib/financeReportPdfGenerator';

function currentQuarterStart() {
  const d = new Date();
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10);
}

function currentQuarterEnd() {
  const d = new Date();
  const quarter = Math.floor(d.getMonth() / 3);
  const endMonth = quarter * 3 + 2;
  const lastDay = new Date(d.getFullYear(), endMonth + 1, 0).getDate();
  return new Date(d.getFullYear(), endMonth, lastDay).toISOString().slice(0, 10);
}

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ReportSSTSummary() {
  const [startDate, setStartDate] = useState(currentQuarterStart());
  const [endDate, setEndDate] = useState(currentQuarterEnd());
  const [companyId, setCompanyId] = useState('all');
  const { data: companies = [] } = useCompanies();

  const report = useSSTReport({
    startDate,
    endDate,
    companyId: companyId === 'all' ? undefined : companyId,
  });

  const data = report.data;
  const hasData = !!data;

  const companyName = useMemo(() => {
    if (companyId === 'all') return undefined;
    return companies.find((c) => c.id === companyId)?.name;
  }, [companyId, companies]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SST Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4 items-end">
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

          <Button
            variant="outline"
            onClick={() => {
              if (!data) return;
              generateSSTSummaryPdf({
                startDate,
                endDate,
                companyName,
                outputTax: data.outputTax,
                inputTax: data.inputTax,
                netPayable: data.netPayable,
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-44">Taxable Amount (RM)</TableHead>
                  <TableHead className="text-right w-44">Tax Amount (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Output Tax */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold" colSpan={3}>OUTPUT TAX (SALES)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingLeft: '2.25rem' }}>Standard Rated (SR 6%)</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(data!.outputTax.taxableAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(data!.outputTax.taxAmount)}</TableCell>
                </TableRow>
                <TableRow className="border-t">
                  <TableCell className="font-semibold" style={{ paddingLeft: '1.5rem' }}>Total Output Tax</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(data!.outputTax.taxableAmount)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(data!.outputTax.taxAmount)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={3} className="h-2 p-0" /></TableRow>

                {/* Input Tax */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold" colSpan={3}>INPUT TAX (PURCHASES)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingLeft: '2.25rem' }}>Standard Rated (SR 6%)</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(data!.inputTax.taxableAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(data!.inputTax.taxAmount)}</TableCell>
                </TableRow>
                <TableRow className="border-t">
                  <TableCell className="font-semibold" style={{ paddingLeft: '1.5rem' }}>Total Input Tax</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(data!.inputTax.taxableAmount)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(data!.inputTax.taxAmount)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={3} className="h-2 p-0" /></TableRow>

                {/* Net Payable */}
                <TableRow className="bg-primary/10 border-t-2">
                  <TableCell className="font-bold text-base" colSpan={2}>
                    {data!.netPayable >= 0 ? 'NET SST PAYABLE' : 'NET SST (REFUNDABLE)'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-base tabular-nums">
                    {data!.netPayable < 0 && '('}
                    {fmt(Math.abs(data!.netPayable))}
                    {data!.netPayable < 0 && ')'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
