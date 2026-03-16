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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  useApprovePV,
  useCheckPV,
  usePaymentVouchers,
  useRejectPV,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  type ApPvStatus,
  type PaymentVoucher,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

type Tab = 'pending' | 'history';

export default function ApprovePV() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [detailPv, setDetailPv] = useState<PaymentVoucher | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPvId, setRejectingPvId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const isAsstMgr = roles.includes('assistant_manager');
  const isDmd = roles.includes('dmd');

  // Determine which status this user should see as "pending"
  // assistant_manager checks (pending -> checked), dmd approves (checked -> approved)
  const pendingStatus: ApPvStatus | undefined = useMemo(() => {
    if (isAsstMgr) return 'pending';
    if (isDmd) return 'checked';
    return undefined;
  }, [isAsstMgr, isDmd]);

  const pendingPvs = usePaymentVouchers({
    status: pendingStatus || 'pending',
    page: 1,
    pageSize: 50,
  });

  const historyPvs = usePaymentVouchers({
    status: 'all',
    page: 1,
    pageSize: 50,
  });

  const checkPV = useCheckPV();
  const approvePV = useApprovePV();
  const rejectPV = useRejectPV();

  const openRejectDialog = (pvId: string) => {
    setRejectingPvId(pvId);
    setRejectRemarks('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectingPvId) return;
    await rejectPV.rejectPV({ pvId: rejectingPvId, remarks: rejectRemarks });
    setRejectDialogOpen(false);
    setRejectingPvId(null);
    setRejectRemarks('');
  };

  const pendingRows = useMemo(() => {
    return pendingPvs.data?.rows || [];
  }, [pendingPvs.data]);

  const historyRows = useMemo(() => {
    const rows = historyPvs.data?.rows || [];
    return rows.filter((r) => r.status !== 'draft');
  }, [historyPvs.data]);

  const rows = tab === 'pending' ? pendingRows : historyRows;

  const getStatusBadgeClass = (status: ApPvStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'checked': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'posted': return 'bg-indigo-100 text-indigo-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return undefined;
    }
  };

  const roleLabel = isAsstMgr ? 'Assistant Manager' : isDmd ? 'DMD' : '';
  const actionLabel = isAsstMgr ? 'Check' : isDmd ? 'Approve' : '';

  const handleAction = (pv: PaymentVoucher) => {
    if (isAsstMgr && pv.status === 'pending') {
      checkPV.checkPV({ pvId: pv.id });
    } else if (isDmd && pv.status === 'checked') {
      approvePV.approvePV({ pvId: pv.id });
    }
  };

  const isActionPending = checkPV.isChecking || approvePV.isApproving;

  return (
    <AppLayout>
      <PageLayout
        title={`Approve Payment Voucher (${roleLabel})`}
        description="Review and approve Payment Vouchers."
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
                <p className="text-center text-muted-foreground py-8">No payment vouchers to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PV No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Pay To</TableHead>
                        <TableHead>Pay For</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((pv) => (
                        <TableRow key={pv.id}>
                          <TableCell className="font-medium">{pv.pv_number || 'Draft'}</TableCell>
                          <TableCell>{format(new Date(pv.payment_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{pv.pay_to || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{pv.pay_for || '-'}</TableCell>
                          <TableCell>{AP_PAYMENT_METHOD_LABELS[pv.payment_method] || pv.payment_method}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(pv.total_amount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeClass(pv.status)}>
                              {AP_PV_STATUS_LABELS[pv.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {tab === 'pending' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAction(pv)}
                                    disabled={isActionPending}
                                  >
                                    {actionLabel}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openRejectDialog(pv.id)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetailPv(pv)}
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
        <Dialog open={!!detailPv} onOpenChange={(open) => { if (!open) setDetailPv(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Voucher — {detailPv?.pv_number || 'Draft'}</DialogTitle>
            </DialogHeader>
            {detailPv && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="text-muted-foreground">Status:</span> <Badge className={getStatusBadgeClass(detailPv.status)}>{AP_PV_STATUS_LABELS[detailPv.status]}</Badge></p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailPv.payment_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Pay To:</span> {detailPv.pay_to}</p>
                  <p><span className="text-muted-foreground">Pay For:</span> {detailPv.pay_for || '-'}</p>
                  <p><span className="text-muted-foreground">Payment Method:</span> {AP_PAYMENT_METHOD_LABELS[detailPv.payment_method] || detailPv.payment_method}</p>
                  <p><span className="text-muted-foreground">Reference No:</span> {detailPv.reference_no || '-'}</p>
                </div>

                {detailPv.remarks && (
                  <div>
                    <p className="text-muted-foreground">Remarks:</p>
                    <p>{detailPv.remarks}</p>
                  </div>
                )}

                {/* Lines */}
                {detailPv.lines && detailPv.lines.length > 0 && (
                  <>
                    <Separator />
                    <p className="font-semibold">Line Items</p>
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
                        {detailPv.lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{line.line_date ? format(new Date(line.line_date), 'dd MMM yyyy') : '-'}</TableCell>
                            <TableCell>{line.description}</TableCell>
                            <TableCell>{line.cheque_no || '-'}</TableCell>
                            <TableCell className="text-right">{formatMoney(line.amount)}</TableCell>
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
                    {detailPv.submitted_at && (
                      <p><span className="text-muted-foreground">Submitted:</span> {format(new Date(detailPv.submitted_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPv.checked_at && (
                      <p><span className="text-muted-foreground">Checked:</span> {format(new Date(detailPv.checked_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPv.approved_at && (
                      <p><span className="text-muted-foreground">Approved:</span> {format(new Date(detailPv.approved_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPv.paid_at && (
                      <p><span className="text-muted-foreground">Paid:</span> {format(new Date(detailPv.paid_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                  </div>
                </div>

                {/* Rejection Info */}
                {detailPv.status === 'rejected' && (detailPv as any).rejection_remarks && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="font-semibold text-destructive">Rejected</p>
                    <p><span className="text-muted-foreground">Stage:</span> {(detailPv as any).rejection_stage || '-'}</p>
                    <p><span className="text-muted-foreground">Remarks:</span> {(detailPv as any).rejection_remarks}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectingPvId(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reject Payment Voucher</DialogTitle>
              <DialogDescription>Provide remarks for rejection.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Rejection Remarks</Label>
              <Textarea
                rows={4}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Enter reason for rejection"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectingPvId(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={rejectPV.isRejecting || !rejectRemarks.trim()}
              >
                {rejectPV.isRejecting ? 'Rejecting...' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
