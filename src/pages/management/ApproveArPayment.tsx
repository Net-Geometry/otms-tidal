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
  useArPayments,
  useApproveArPayment,
} from '@/hooks/finance/useAccountsReceivable';
import {
  AR_PAYMENT_METHOD_LABELS,
  AR_PAYMENT_STATUS_LABELS,
  type ArPayment,
  type ArPaymentStatus,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

type Tab = 'pending' | 'history';

export default function ApproveArPayment() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [detailPayment, setDetailPayment] = useState<ArPayment | null>(null);

  const isAsstMgr = roles.includes('assistant_manager');
  const isDmd = roles.includes('dmd');

  const roleLabel = isAsstMgr ? 'Assistant Manager' : isDmd ? 'DMD' : '';

  // Both assistant_manager and dmd directly approve pending AR payments
  const pendingPayments = useArPayments({
    status: 'pending',
    page: 1,
  });

  const historyPayments = useArPayments({
    page: 1,
  });

  const { approveArPayment, isApproving } = useApproveArPayment();

  const pendingRows = useMemo(() => {
    return (pendingPayments.data?.data || []) as ArPayment[];
  }, [pendingPayments.data]);

  const historyRows = useMemo(() => {
    const rows = (historyPayments.data?.data || []) as ArPayment[];
    return rows.filter((r: ArPayment) => r.status !== 'draft');
  }, [historyPayments.data]);

  const rows: ArPayment[] = tab === 'pending' ? pendingRows : historyRows;

  const getStatusBadgeClass = (status: ArPaymentStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'posted': return 'bg-indigo-100 text-indigo-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return undefined;
    }
  };

  const handleAction = (payment: ArPayment) => {
    if (payment.status === 'pending') {
      approveArPayment(payment.id);
    }
  };

  return (
    <AppLayout>
      <PageLayout
        title={`Approve AR Payment${roleLabel ? ` (${roleLabel})` : ''}`}
        description="Review and approve AR Payments."
        onBack={() => navigate('/management/dashboard')}
      >
        <Card className="p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending Approval ({pendingRows.length})
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6">
              {rows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No AR payments to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer / Received From</TableHead>
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
                            {payment.customer?.customer_name || payment.received_from || '-'}
                          </TableCell>
                          <TableCell>
                            {payment.bank_account
                              ? `${payment.bank_account.account_name}${payment.bank_account.bank_name ? ` — ${payment.bank_account.bank_name}` : ''}`
                              : '-'}
                          </TableCell>
                          <TableCell>{AR_PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}</TableCell>
                          <TableCell>{payment.reference_no || '-'}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(payment.total_amount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeClass(payment.status)}>
                              {AR_PAYMENT_STATUS_LABELS[payment.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              {tab === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(payment)}
                                  disabled={isApproving}
                                >
                                  Approve
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailPayment(payment)}
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                View
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
              <DialogTitle>AR Payment — {detailPayment?.payment_number || 'Draft'}</DialogTitle>
            </DialogHeader>
            {detailPayment && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge className={getStatusBadgeClass(detailPayment.status)}>
                      {AR_PAYMENT_STATUS_LABELS[detailPayment.status]}
                    </Badge>
                  </p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailPayment.payment_date), 'dd MMM yyyy')}</p>
                  <p>
                    <span className="text-muted-foreground">Customer / Received From:</span>{' '}
                    {detailPayment.customer?.customer_name || detailPayment.received_from || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Bank Account:</span>{' '}
                    {detailPayment.bank_account
                      ? `${detailPayment.bank_account.account_name}${detailPayment.bank_account.bank_name ? ` — ${detailPayment.bank_account.bank_name}` : ''}`
                      : '-'}
                  </p>
                  <p><span className="text-muted-foreground">Method:</span> {AR_PAYMENT_METHOD_LABELS[detailPayment.payment_method] || detailPayment.payment_method}</p>
                  <p><span className="text-muted-foreground">Reference No:</span> {detailPayment.reference_no || '-'}</p>
                  <p><span className="text-muted-foreground">Total Amount:</span> {formatMoney(detailPayment.total_amount)}</p>
                </div>

                {detailPayment.remarks && (
                  <div>
                    <p className="text-muted-foreground">Remarks:</p>
                    <p>{detailPayment.remarks}</p>
                  </div>
                )}

                {/* AR Invoice Allocations */}
                {detailPayment.allocations && detailPayment.allocations.length > 0 && (
                  <>
                    <Separator />
                    <p className="font-semibold">AR Invoice Allocations</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Allocated Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPayment.allocations.map((alloc, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{alloc.ar_invoice?.invoice_number || '-'}</TableCell>
                            <TableCell className="text-right">{alloc.ar_invoice ? formatMoney(alloc.ar_invoice.total_amount) : '-'}</TableCell>
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
