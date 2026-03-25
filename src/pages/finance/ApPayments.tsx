import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies } from '@/hooks/hr/useCompanies';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  type ApPaymentMethod,
  type ApPvStatus,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

interface ApPaymentPV {
  id: string;
  pv_number: string | null;
  pay_to: string | null;
  pay_for: string | null;
  payment_date: string;
  payment_method: ApPaymentMethod;
  reference_no: string | null;
  total_amount: number;
  status: ApPvStatus;
  remarks: string | null;
  posted_at: string | null;
  paid_at: string | null;
  supplier: { supplier_name: string; supplier_code: string } | null;
  bank_account: { account_code: string; account_name: string; bank_name: string } | null;
  journal_entry: { entry_number: string; entry_date: string } | null;
  lines: Array<{
    id: string;
    line_date: string;
    description: string;
    cheque_no: string | null;
    amount: number;
  }>;
  allocations: Array<{
    id: string;
    allocated_amount: number;
    ap_invoice: { id: string; invoice_number: string; total_amount: number } | null;
  }>;
}

function useApPaymentPVs(filters: {
  companyId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const db = supabase as any;
  const companyId = filters.companyId; // undefined = all companies

  return useQuery({
    queryKey: [
      'ap-payment-pvs',
      companyId || 'all',
      filters.startDate || '',
      filters.endDate || '',
      filters.search || '',
    ],
    queryFn: async () => {
      let q = db
        .from('payment_vouchers')
        .select(`
          *,
          company:companies!payment_vouchers_company_id_fkey(id, name, code),
          supplier:suppliers!payment_vouchers_supplier_id_fkey(supplier_code, supplier_name),
          bank_account:bank_accounts!payment_vouchers_bank_account_id_fkey(account_code, account_name, bank_name),
          journal_entry:journal_entries!payment_vouchers_journal_entry_id_fkey(entry_number, entry_date),
          lines:payment_voucher_lines(*),
          allocations:payment_voucher_allocations(
            id,
            allocated_amount,
            ap_invoice:ap_invoices(id, invoice_number, total_amount)
          )
        `)
        .eq('post_to_type', 'ap_payment')
        .in('status', ['paid', 'posted'])
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (companyId) q = q.eq('company_id', companyId);

      if (filters.startDate) q = q.gte('payment_date', filters.startDate);
      if (filters.endDate) q = q.lte('payment_date', filters.endDate);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `pv_number.ilike.%${search}%,reference_no.ilike.%${search}%,pay_to.ilike.%${search}%`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        ...row,
        total_amount: toNumber(row.total_amount),
        lines: (row.lines || []).map((l: any) => ({ ...l, amount: toNumber(l.amount) })),
        allocations: (row.allocations || []).map((a: any) => ({
          ...a,
          allocated_amount: toNumber(a.allocated_amount),
        })),
      })) as ApPaymentPV[];
    },
    enabled: true,
    staleTime: 20 * 1000,
  });
}

export default function ApPayments() {
  const [companyFilter, setCompanyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [detailPV, setDetailPV] = useState<ApPaymentPV | null>(null);

  const { data: companies = [] } = useCompanies();

  const { data: rows = [], isLoading } = useApPaymentPVs({
    companyId: companyFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
  });

  const totals = useMemo(() => {
    const posted = rows.filter((r) => r.status === 'posted');
    const paid = rows.filter((r) => r.status === 'paid');
    return {
      postedCount: posted.length,
      paidCount: paid.length,
      postedTotal: posted.reduce((sum, r) => sum + r.total_amount, 0),
      paidTotal: paid.reduce((sum, r) => sum + r.total_amount, 0),
      grandTotal: rows.reduce((sum, r) => sum + r.total_amount, 0),
    };
  }, [rows]);

  return (
    <AppLayout>
      <PageLayout
        title="AP Payments"
        description="Payment vouchers posted as AP Payments with GL entries."
      >
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Posted to GL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.postedCount}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(totals.postedTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid (Pending Post)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.paidCount}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(totals.paidTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Grand Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totals.grandTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                value={companyFilter || 'default'}
                onValueChange={(value) => setCompanyFilter(value === 'default' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />

              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />

              <Input
                placeholder="Search PV number, reference, or payee"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AP Payment Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No AP payment entries found. PVs posted as &quot;AP Payment&quot; will appear here.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PV No</TableHead>
                      {!companyFilter && <TableHead>Company</TableHead>}
                      <TableHead>Pay To</TableHead>
                      <TableHead>Pay For</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>GL Entry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((pv) => (
                      <TableRow key={pv.id}>
                        <TableCell className="font-medium">
                          {pv.pv_number || 'Draft'}
                        </TableCell>
                        {!companyFilter && (
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{(pv as any).company?.code || (pv as any).company?.name || '-'}</span>
                          </TableCell>
                        )}
                        <TableCell>
                          {pv.pay_to || pv.supplier?.supplier_name || '-'}
                        </TableCell>
                        <TableCell>{pv.pay_for || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(pv.payment_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          {AP_PAYMENT_METHOD_LABELS[pv.payment_method] || pv.payment_method}
                        </TableCell>
                        <TableCell>{pv.reference_no || '-'}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(pv.total_amount)}
                        </TableCell>
                        <TableCell>
                          {pv.journal_entry ? (
                            <span className="text-xs font-mono">{pv.journal_entry.entry_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={pv.status === 'posted' ? 'default' : 'secondary'}
                          >
                            {AP_PV_STATUS_LABELS[pv.status] || pv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetailPV(pv)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={companyFilter ? 6 : 7} className="font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatMoney(totals.grandTotal)}
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailPV} onOpenChange={(open) => { if (!open) setDetailPV(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AP Payment — {detailPV?.pv_number || 'Draft'}</DialogTitle>
            </DialogHeader>
            {detailPV && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Pay To:</span>{' '}
                    {detailPV.pay_to || detailPV.supplier?.supplier_name || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Pay For:</span>{' '}
                    {detailPV.pay_for || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Payment Date:</span>{' '}
                    {format(new Date(detailPV.payment_date), 'dd MMM yyyy')}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    {AP_PAYMENT_METHOD_LABELS[detailPV.payment_method] || detailPV.payment_method}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reference:</span>{' '}
                    {detailPV.reference_no || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Bank Account:</span>{' '}
                    {detailPV.bank_account
                      ? `${detailPV.bank_account.account_code} - ${detailPV.bank_account.account_name}`
                      : '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total Amount:</span>{' '}
                    <span className="font-medium">{formatMoney(detailPV.total_amount)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={detailPV.status === 'posted' ? 'default' : 'secondary'}>
                      {AP_PV_STATUS_LABELS[detailPV.status] || detailPV.status}
                    </Badge>
                  </p>
                  {detailPV.journal_entry && (
                    <p>
                      <span className="text-muted-foreground">GL Entry:</span>{' '}
                      <span className="font-mono text-xs">{detailPV.journal_entry.entry_number}</span>
                    </p>
                  )}
                </div>

                {detailPV.remarks && (
                  <div>
                    <p className="text-muted-foreground">Remarks:</p>
                    <p>{detailPV.remarks}</p>
                  </div>
                )}

                {/* Invoice Allocations */}
                {detailPV.allocations.length > 0 && (
                  <>
                    <Separator />
                    <p className="font-semibold">Invoice Allocations</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead className="text-right">Allocated Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPV.allocations.map((alloc) => (
                          <TableRow key={alloc.id}>
                            <TableCell>
                              {alloc.ap_invoice?.invoice_number || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(alloc.allocated_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* PV Lines */}
                {detailPV.lines.length > 0 && (
                  <>
                    <Separator />
                    <p className="font-semibold">Payment Lines</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Cheque No</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPV.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>
                              {format(new Date(line.line_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>{line.description}</TableCell>
                            <TableCell>{line.cheque_no || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(line.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* Trail */}
                <Separator />
                <div className="grid gap-2 md:grid-cols-2">
                  {detailPV.paid_at && (
                    <p>
                      <span className="text-muted-foreground">Paid:</span>{' '}
                      {format(new Date(detailPV.paid_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  )}
                  {detailPV.posted_at && (
                    <p>
                      <span className="text-muted-foreground">Posted:</span>{' '}
                      {format(new Date(detailPV.posted_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
