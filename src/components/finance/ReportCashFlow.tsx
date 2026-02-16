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
import { useCashFlowReport } from '@/hooks/finance/useFinanceReports';
import { generateCashFlowPdf } from '@/lib/financeReportPdfGenerator';

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

function fmtSigned(amount: number) {
  if (amount < 0) return `(${fmt(Math.abs(amount))})`;
  return fmt(amount);
}

export function ReportCashFlow() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const { data: companies = [] } = useCompanies();

  const report = useCashFlowReport({
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
        <CardTitle className="text-base">Cash Flow Summary</CardTitle>
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
              generateCashFlowPdf({
                startDate,
                endDate,
                companyName,
                openingCash: data.openingCash,
                operating: data.operating,
                financing: data.financing,
                netChange: data.netChange,
                closingCash: data.closingCash,
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
                  <TableHead className="text-right w-44">Amount (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening Cash */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">OPENING CASH BALANCE</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.openingCash)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Operating Activities */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">OPERATING ACTIVITIES</TableCell>
                  <TableCell />
                </TableRow>
                {data!.operating.items.map((item) => (
                  <TableRow key={item.reference_type}>
                    <TableCell style={{ paddingLeft: '2.25rem' }}>{item.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtSigned(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {data!.operating.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground" style={{ paddingLeft: '2.25rem' }}>
                      No operating activities
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t">
                  <TableCell className="font-semibold" style={{ paddingLeft: '1.5rem' }}>
                    Net Cash from Operating Activities
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtSigned(data!.operating.amount)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Financing Activities */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">FINANCING ACTIVITIES</TableCell>
                  <TableCell />
                </TableRow>
                {data!.financing.items.map((item) => (
                  <TableRow key={item.reference_type}>
                    <TableCell style={{ paddingLeft: '2.25rem' }}>{item.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtSigned(item.amount)}</TableCell>
                  </TableRow>
                ))}
                {data!.financing.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground" style={{ paddingLeft: '2.25rem' }}>
                      No financing activities
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t">
                  <TableCell className="font-semibold" style={{ paddingLeft: '1.5rem' }}>
                    Net Cash from Financing Activities
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtSigned(data!.financing.amount)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Net Change */}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">NET CHANGE IN CASH</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmtSigned(data!.netChange)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Closing Cash */}
                <TableRow className="bg-primary/10 border-t-2">
                  <TableCell className="font-bold text-base">CLOSING CASH BALANCE</TableCell>
                  <TableCell className="text-right font-bold text-base tabular-nums">{fmt(data!.closingCash)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
