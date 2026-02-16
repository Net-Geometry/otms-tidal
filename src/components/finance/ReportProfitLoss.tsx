import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useProfitAndLoss, type ReportSection } from '@/hooks/finance/useFinanceReports';
import { generateProfitLossPdf } from '@/lib/financeReportPdfGenerator';

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

function sectionToPdfShape(s: ReportSection): {
  account_code: string;
  account_name: string;
  level: number;
  amount: number;
  children: ReturnType<typeof sectionToPdfShape>[];
} {
  return {
    account_code: s.account.account_code,
    account_name: s.account.account_name,
    level: s.account.level,
    amount: s.amount,
    children: s.children.map(sectionToPdfShape),
  };
}

function SectionRows({ sections, depth }: { sections: ReportSection[]; depth: number }) {
  return (
    <>
      {sections.map((section) => {
        const hasChildren = section.children.length > 0;
        return hasChildren ? (
          <GroupRows key={section.account.id} section={section} depth={depth} />
        ) : (
          <TableRow key={section.account.id}>
            <TableCell style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}>
              {section.account.account_code} {section.account.account_name}
            </TableCell>
            <TableCell className="text-right tabular-nums">{fmt(section.amount)}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function GroupRows({ section, depth }: { section: ReportSection; depth: number }) {
  return (
    <>
      <TableRow className="bg-muted/30">
        <TableCell style={{ paddingLeft: `${depth * 1.5}rem` }} className="font-semibold">
          {section.account.account_name}
        </TableCell>
        <TableCell />
      </TableRow>
      <SectionRows sections={section.children} depth={depth + 1} />
      <TableRow className="border-t">
        <TableCell style={{ paddingLeft: `${depth * 1.5}rem` }} className="font-semibold">
          Total {section.account.account_name}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{fmt(section.amount)}</TableCell>
      </TableRow>
    </>
  );
}

export function ReportProfitLoss() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const [showZero, setShowZero] = useState(false);
  const { data: companies = [] } = useCompanies();

  const report = useProfitAndLoss({
    startDate,
    endDate,
    companyId: companyId === 'all' ? undefined : companyId,
    showZero,
  });

  const data = report.data;

  const companyName = useMemo(() => {
    if (companyId === 'all') return undefined;
    return companies.find((c) => c.id === companyId)?.name;
  }, [companyId, companies]);

  const hasData = data && (data.revenue.length > 0 || data.expenses.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profit & Loss Statement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

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

          <div className="flex items-center gap-2">
            <Switch id="show-zero-pl" checked={showZero} onCheckedChange={setShowZero} />
            <Label htmlFor="show-zero-pl" className="text-sm whitespace-nowrap">Show zero</Label>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              if (!data) return;
              generateProfitLossPdf({
                startDate,
                endDate,
                companyName,
                revenue: data.revenue.map(sectionToPdfShape),
                expenses: data.expenses.map(sectionToPdfShape),
                totalRevenue: data.totalRevenue,
                totalExpenses: data.totalExpenses,
                netProfit: data.netProfit,
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
                {/* Revenue */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">REVENUE</TableCell>
                  <TableCell />
                </TableRow>
                <SectionRows sections={data!.revenue} depth={1} />
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">TOTAL REVENUE</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totalRevenue)}</TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Expenses */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">EXPENSES</TableCell>
                  <TableCell />
                </TableRow>
                <SectionRows sections={data!.expenses} depth={1} />
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">TOTAL EXPENSES</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totalExpenses)}</TableCell>
                </TableRow>

                {/* Spacer */}
                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Net Profit */}
                <TableRow className="bg-primary/10 border-t-2">
                  <TableCell className="font-bold text-base">
                    {data!.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-base tabular-nums">
                    {data!.netProfit < 0 && '('}
                    {fmt(Math.abs(data!.netProfit))}
                    {data!.netProfit < 0 && ')'}
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
