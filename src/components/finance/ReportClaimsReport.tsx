import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { useClaimsReport } from '@/hooks/finance/useFinanceReports';
import { generateClaimsReportPdf } from '@/lib/financeReportPdfGenerator';
import { formatCurrency } from '@/lib/otCalculations';

function currentMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function statusVariant(status: string) {
  if (status === 'finance_approved' || status === 'hr_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export function ReportClaimsReport() {
  const [startDate, setStartDate] = useState(currentMonthStart());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState('all');
  const [status, setStatus] = useState('all');

  const { data: companies = [] } = useCompanies();
  const report = useClaimsReport({
    startDate,
    endDate,
    status: status === 'all' ? undefined : status,
    companyId: companyId === 'all' ? undefined : companyId,
  });

  const rows = report.data?.rows || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claims Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_finance">Pending Finance</SelectItem>
              <SelectItem value="finance_approved">Finance Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

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
              generateClaimsReportPdf({
                startDate,
                endDate,
                rows: rows.map((row: any) => ({
                  ticket_number: row.ticket_number,
                  claim_date: row.claim_date,
                  employee_name: row.profiles?.full_name || '-',
                  claim_type: row.claim_type?.name || '-',
                  status: row.status,
                  amount: Number(row.amount || 0),
                })),
                totalsByType: report.data?.totalsByType || [],
                grandTotal: Number(report.data?.grandTotal || 0),
              })
            }
            disabled={!rows.length}
          >
            Export PDF
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {(report.data?.totalsByType || []).slice(0, 3).map((row) => (
            <div key={row.type} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{row.type}</div>
              <div className="text-lg font-semibold">{formatCurrency(Number(row.amount || 0))}</div>
            </div>
          ))}
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Grand Total</div>
            <div className="text-lg font-semibold">{formatCurrency(Number(report.data?.grandTotal || 0))}</div>
          </div>
        </div>

        {report.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading report...</div>
        ) : !rows.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No claims found for selected filters.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.ticket_number}</TableCell>
                    <TableCell>{row.claim_date}</TableCell>
                    <TableCell>{row.profiles?.full_name || '-'}</TableCell>
                    <TableCell>{row.claim_type?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status) as any}>{String(row.status).replace(/_/g, ' ')}</Badge>
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
