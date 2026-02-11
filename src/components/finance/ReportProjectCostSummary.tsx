import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useProjectCostSummaryReport } from '@/hooks/finance/useFinanceReports';
import { generateProjectCostSummaryPdf } from '@/lib/financeReportPdfGenerator';

function currentMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

export function ReportProjectCostSummary() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const { data: companies = [] } = useCompanies();

  const report = useProjectCostSummaryReport({
    startDate,
    endDate,
    companyId: companyId === 'all' ? undefined : companyId,
  });

  const rows = report.data || [];

  const companyName = useMemo(() => {
    if (companyId === 'all') return undefined;
    return companies.find((company) => company.id === companyId)?.name;
  }, [companyId, companies]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project Cost Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />

          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() =>
              generateProjectCostSummaryPdf({
                startDate,
                endDate,
                companyName,
                rows,
              })
            }
            disabled={!rows.length}
          >
            Export PDF
          </Button>
        </div>

        {report.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading report...</div>
        ) : !rows.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No cost allocations in selected period.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="text-right">Subcontractor</TableHead>
                  <TableHead className="text-right">Equipment</TableHead>
                  <TableHead className="text-right">Overhead</TableHead>
                  <TableHead className="text-right">Travel</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.project_id}>
                    <TableCell className="font-medium">
                      {row.project_code} - {row.project_name}
                    </TableCell>
                    <TableCell>{row.company_name}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.labor || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.materials || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.subcontractor || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.equipment || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.overhead || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.travel || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right">{Number(row.categories.other || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(row.total || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
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
