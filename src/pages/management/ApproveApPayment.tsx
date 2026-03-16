import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import {
  useApPayments,
  useCheckApPayment,
  useApproveApPayment,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PAYMENT_STATUS_LABELS,
  type ApPayment,
  type ApPaymentStatus,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

type Tab = 'pending' | 'history';

export default function ApproveApPayment() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [detailPayment, setDetailPayment] = useState<ApPayment | null>(null);

  const isAsstMgr = roles.includes('assistant_manager');
  const isDmd = roles.includes('dmd');

  const roleLabel = isAsstMgr ? 'Assistant Manager' : isDmd ? 'DMD' : '';
  const actionLabel = isAsstMgr ? 'Check' : isDmd ? 'Approve' : '';

  // assistant_manager sees 'pending', dmd sees 'checked'
  const pendingStatus = isAsstMgr ? 'pending' : isDmd ? 'checked' : 'pending';

  const pendingPayments = useApPayments({
    status: pendingStatus,
    page: 1,
  });

  const historyPayments = useApPayments({
    page: 1,
  });

  const checkApPayment = useCheckApPayment();
  const { approveApPayment, isApproving } = useApproveApPayment();

  const pendingRows = useMemo(() => {
    return pendingPayments.data?.data || [];
  }, [pendingPayments.data]);

  const historyRows = useMemo(() => {
    const rows = historyPayments.data?.data || [];
    return rows.filter((r: ApPayment) => r.status !== 'draft');
  }, [historyPayments.data]);

  const rows: ApPayment[] = tab === 'pending' ? pendingRows : historyRows;

  const isActionPending = checkApPayment.isChecking || isApproving;

  const getStatusBadgeClass = (status: ApPaymentStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'checked': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'posted': return 'bg-indigo-100 text-indigo-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return undefined;
    }
  };

  const handleAction = (payment: ApPayment) => {
    if (isAsstMgr && payment.status === 'pending') {
      checkApPayment.checkApPayment(payment.id);
    } else if (isDmd && payment.status === 'checked') {
      approveApPayment(payment.id);
    }
  };

  return (
    <AppLayout>
      <PageLayout
        title={`Approve AP Payment${roleLabel ? ` (${roleLabel})` : ''}`}
        description="Review and approve AP Payments."
        onBack={() => navigate('/management/dashboard')}
      >
        <Card className="p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending {actionLabel} ({pendingRows.length})
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6">
              {rows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No AP payments to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Bank Account</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.payment_number || 'Draft'}</TableCell>
                          <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            {payment.bank_account
                              ? `${payment.bank_account.account_name}${payment.bank_account.bank_name ? ` — ${payment.bank_account.bank_name}` : ''}`
                              : '-'}
                          </TableCell>
                          <TableCell>{AP_PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}</TableCell>
                          <TableCell>{payment.reference_no || '-'}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(payment.total_amount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeClass(payment.status)}>
                              {AP_PAYMENT_STATUS_LABELS[payment.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {tab === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(payment)}
                                  disabled={isActionPending}
                                >
                                  {actionLabel}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetailPayment(payment)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailPayment} onOpenChange={(open) => { if (!open) setDetailPayment(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AP Payment — {detailPayment?.payment_number || 'Draft'}</DialogTitle>
            </DialogHeader>
            {detailPayment && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge className={getStatusBadgeClass(detailPayment.status)}>
                      {AP_PAYMENT_STATUS_LABELS[detailPayment.status]}
                    </Badge>
                  </p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailPayment.payment_date), 'dd MMM yyyy')}</p>
                  <p>
                    <span className="text-muted-foreground">Bank Account:</span>{' '}
                    {detailPayment.bank_account
                      ? `${detailPayment.bank_account.account_name}${detailPayment.bank_account.bank_name ? ` — ${detailPayment.bank_account.bank_name}` : ''}`
                      : '-'}
                  </p>
                  <p><span className="text-muted-foreground">Method:</span> {AP_PAYMENT_METHOD_LABELS[detailPayment.payment_method] || detailPayment.payment_method}</p>
                  <p><span className="text-muted-foreground">Reference No:</span> {detailPayment.reference_no || '-'}</p>
                  <p><span className="text-muted-foreground">Total Amount:</span> {formatMoney(detailPayment.total_amount)}</p>
                </div>

                {detailPayment.remarks && (
                  <div>
                    <p className="text-muted-foreground">Remarks:</p>
                    <p>{detailPayment.remarks}</p>
                  </div>
                )}

                {/* PV Allocations */}
                {detailPayment.allocations && detailPayment.allocations.length > 0 && (
                  <>
                    <Separator />
                    <p className="font-semibold">PV Allocations</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PV #</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPayment.allocations.map((alloc, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{alloc.payment_voucher?.pv_number || '-'}</TableCell>
                            <TableCell>
                              {(alloc.payment_voucher as any)?.supplier?.supplier_name || '-'}
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(alloc.allocated_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* Approval Trail */}
                <Separator />
                <div className="space-y-2">
                  <p className="font-semibold">Approval Trail</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {detailPayment.submitted_at && (
                      <p><span className="text-muted-foreground">Submitted:</span> {format(new Date(detailPayment.submitted_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPayment.approved_at && (
                      <p><span className="text-muted-foreground">Approved:</span> {format(new Date(detailPayment.approved_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPayment.posted_at && (
                      <p><span className="text-muted-foreground">Posted:</span> {format(new Date(detailPayment.posted_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
