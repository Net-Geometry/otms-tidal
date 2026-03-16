import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useBalanceSheet, type ReportSection } from '@/hooks/finance/useFinanceReports';
import { generateBalanceSheetPdf } from '@/lib/financeReportPdfGenerator';

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

export function ReportBalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const [showZero, setShowZero] = useState(false);
  const [detailLevel, setDetailLevel] = useState('all');
  const { data: companies = [] } = useCompanies();

  const report = useBalanceSheet({
    asOfDate,
    companyId: companyId === 'all' ? undefined : companyId,
    showZero,
    maxLevel: detailLevel === 'all' ? undefined : Number(detailLevel),
  });

  const data = report.data;

  const companyName = useMemo(() => {
    if (companyId === 'all') return undefined;
    return companies.find((c) => c.id === companyId)?.name;
  }, [companyId, companies]);

  const hasData = data && (data.assets.length > 0 || data.liabilities.length > 0 || data.equity.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Balance Sheet</CardTitle>
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

          <Select value={detailLevel} onValueChange={setDetailLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Detail Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="1">Level 1</SelectItem>
              <SelectItem value="2">Level 2</SelectItem>
              <SelectItem value="3">Level 3</SelectItem>
              <SelectItem value="4">Level 4</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch id="show-zero-bs" checked={showZero} onCheckedChange={setShowZero} />
            <Label htmlFor="show-zero-bs" className="text-sm whitespace-nowrap">Show zero</Label>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              if (!data) return;
              generateBalanceSheetPdf({
                asOfDate,
                companyName,
                assets: data.assets.map(sectionToPdfShape),
                liabilities: data.liabilities.map(sectionToPdfShape),
                equity: data.equity.map(sectionToPdfShape),
                totalAssets: data.totalAssets,
                totalLiabilities: data.totalLiabilities,
                totalEquity: data.totalEquity,
                retainedEarnings: data.retainedEarnings,
                isBalanced: data.isBalanced,
              });
            }}
            disabled={!hasData}
          >
            Export PDF
          </Button>
        </div>

        {data && !data.isBalanced && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Balance check failed: Total Assets ({fmt(data.totalAssets)}) does not equal
              Total Liabilities + Equity ({fmt(data.totalLiabilities + data.totalEquity)}).
            </AlertDescription>
          </Alert>
        )}

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
                {/* Assets */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">ASSETS</TableCell>
                  <TableCell />
                </TableRow>
                <SectionRows sections={data!.assets} depth={1} />
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">TOTAL ASSETS</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totalAssets)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Liabilities */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">LIABILITIES</TableCell>
                  <TableCell />
                </TableRow>
                <SectionRows sections={data!.liabilities} depth={1} />
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">TOTAL LIABILITIES</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totalLiabilities)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Equity */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">EQUITY</TableCell>
                  <TableCell />
                </TableRow>
                <SectionRows sections={data!.equity} depth={1} />
                {data!.retainedEarnings !== 0 && (
                  <TableRow>
                    <TableCell style={{ paddingLeft: '2.25rem' }} className="italic">
                      Retained Earnings
                    </TableCell>
                    <TableCell className="text-right tabular-nums italic">{fmt(data!.retainedEarnings)}</TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">TOTAL EQUITY</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(data!.totalEquity)}</TableCell>
                </TableRow>

                <TableRow><TableCell colSpan={2} className="h-2 p-0" /></TableRow>

                {/* Total L+E */}
                <TableRow className="bg-primary/10 border-t-2">
                  <TableCell className="font-bold text-base">TOTAL LIABILITIES + EQUITY</TableCell>
                  <TableCell className="text-right font-bold text-base tabular-nums">
                    {fmt(data!.totalLiabilities + data!.totalEquity)}
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
