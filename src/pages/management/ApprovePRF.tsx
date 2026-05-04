import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, Eye } from 'lucide-react';
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
  useApprovePRF,
  useCheckPRF,
  usePurchaseRequisitions,
  useRejectPRF,
  useVerifyPRF,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PRF_STATUS_LABELS,
  PRF_TYPE_LABELS,
  type ApPrfStatus,
  type PurchaseRequisition,
} from '@/types/finance';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

type Tab = 'pending' | 'history';

export default function ApprovePRF() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [detailPrf, setDetailPrf] = useState<PurchaseRequisition | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPrfId, setRejectingPrfId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const isManagement = roles.some((r) => ['management', 'sgm', 'director', 'gm'].includes(r));
  const isAsstMgr = roles.some((r) => ['assistant_manager', 'manager'].includes(r));
  const isDmd = roles.includes('dmd');

  // Determine which status this user should see as "pending"
  const pendingStatus: ApPrfStatus | undefined = useMemo(() => {
    if (isManagement) return 'prepared';
    if (isAsstMgr) return 'verified';
    if (isDmd) return 'checked';
    return undefined;
  }, [isManagement, isAsstMgr, isDmd]);

  const pendingPrfs = usePurchaseRequisitions({
    status: pendingStatus || 'prepared',
    page: 1,
    pageSize: 50,
  });

  const historyPrfs = usePurchaseRequisitions({
    status: 'all',
    page: 1,
    pageSize: 50,
  });

  const verifyPRF = useVerifyPRF();
  const checkPRF = useCheckPRF();
  const approvePRF = useApprovePRF();
  const rejectPRF = useRejectPRF();

  const openRejectDialog = (prfId: string) => {
    setRejectingPrfId(prfId);
    setRejectRemarks('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectingPrfId) return;
    await rejectPRF.rejectPRF({ prfId: rejectingPrfId, remarks: rejectRemarks });
    setRejectDialogOpen(false);
    setRejectingPrfId(null);
    setRejectRemarks('');
  };

  const pendingRows = useMemo(() => {
    return pendingPrfs.data?.rows || [];
  }, [pendingPrfs.data]);

  const historyRows = useMemo(() => {
    const rows = historyPrfs.data?.rows || [];
    // Show approved, rejected, and past statuses
    return rows.filter((r) => r.status !== 'draft');
  }, [historyPrfs.data]);

  const rows = tab === 'pending' ? pendingRows : historyRows;

  const getStatusBadgeClass = (status: ApPrfStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'prepared': return 'bg-yellow-100 text-yellow-800';
      case 'verified': return 'bg-blue-100 text-blue-800';
      case 'checked': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return undefined;
    }
  };

  const roleLabel = isManagement ? 'Management' : isAsstMgr ? 'Assistant Manager' : isDmd ? 'DMD' : '';
  const actionLabel = isManagement ? 'Verify' : isAsstMgr ? 'Check' : isDmd ? 'Approve' : '';

  const handleAction = (prf: PurchaseRequisition) => {
    if (isManagement && prf.status === 'prepared') {
      verifyPRF.verifyPRF({ prfId: prf.id });
    } else if (isAsstMgr && prf.status === 'verified') {
      checkPRF.checkPRF({ prfId: prf.id });
    } else if (isDmd && prf.status === 'checked') {
      approvePRF.approvePRF({ prfId: prf.id });
    }
  };

  const isActionPending = verifyPRF.isVerifying || checkPRF.isChecking || approvePRF.isApproving;

  return (
    <AppLayout>
      <PageLayout
        title={`Approve PRF (${roleLabel})`}
        description="Review and approve Purchase Requisition Forms."
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
                <p className="text-center text-muted-foreground py-8">No PRFs to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PRF No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payable To</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((prf) => (
                        <TableRow key={prf.id} className={prf.priority === 'urgent' ? 'bg-amber-50/40 dark:bg-amber-950/20' : undefined}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {prf.priority === 'urgent' && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                                  aria-label="Urgent"
                                />
                              )}
                              <span>{prf.prf_number || 'Draft'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(prf.prf_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{PRF_TYPE_LABELS[prf.prf_type]}</TableCell>
                          <TableCell>{prf.payable_to}</TableCell>
                          <TableCell className="text-right">{formatMoney(prf.total_amount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeClass(prf.status)}>
                              {AP_PRF_STATUS_LABELS[prf.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {tab === 'pending' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAction(prf)}
                                    disabled={isActionPending}
                                  >
                                    {actionLabel}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openRejectDialog(prf.id)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetailPrf(prf)}
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
        <Dialog open={!!detailPrf} onOpenChange={(open) => { if (!open) setDetailPrf(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>PRF Details — {detailPrf?.prf_number || 'Draft'}</DialogTitle>
            </DialogHeader>
            {detailPrf && (
              <div className="space-y-4 text-sm">
                {detailPrf.priority === 'urgent' && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">URGENT</span>
                    <span className="text-muted-foreground">— flagged for urgent processing.</span>
                  </div>
                )}
                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="text-muted-foreground">Status:</span> <Badge className={getStatusBadgeClass(detailPrf.status)}>{AP_PRF_STATUS_LABELS[detailPrf.status]}</Badge></p>
                  <p><span className="text-muted-foreground">Type:</span> {PRF_TYPE_LABELS[detailPrf.prf_type]}{detailPrf.prf_type === 'others' && detailPrf.prf_type_others ? ` (${detailPrf.prf_type_others})` : ''}</p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailPrf.prf_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Payable To:</span> {detailPrf.payable_to}</p>
                  <p><span className="text-muted-foreground">Payment Via:</span> {detailPrf.payment_via || '-'}</p>
                  <p><span className="text-muted-foreground">Total Amount:</span> {formatMoney(detailPrf.total_amount)}</p>
                </div>

                <Separator />
                <p className="font-semibold">Line Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>GL Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailPrf.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.gl_account_id || '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {detailPrf.management_remarks && (
                  <div>
                    <p className="text-muted-foreground">Management Remarks:</p>
                    <p>{detailPrf.management_remarks}</p>
                  </div>
                )}

                {detailPrf.accounts_dept_remarks && (
                  <div>
                    <p className="text-muted-foreground">Accounts Department Remarks:</p>
                    <p>{detailPrf.accounts_dept_remarks}</p>
                  </div>
                )}

                {/* Approval Trail */}
                <Separator />
                <div className="space-y-2">
                  <p className="font-semibold">Approval Trail</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {detailPrf.submitted_at && (
                      <p><span className="text-muted-foreground">Submitted:</span> {format(new Date(detailPrf.submitted_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPrf.verified_at && (
                      <p><span className="text-muted-foreground">Verified by:</span> {detailPrf.verified_by_profile?.full_name || '-'} on {format(new Date(detailPrf.verified_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPrf.checked_at && (
                      <p><span className="text-muted-foreground">Checked by:</span> {detailPrf.checked_by_profile?.full_name || '-'} on {format(new Date(detailPrf.checked_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                    {detailPrf.approved_at && (
                      <p><span className="text-muted-foreground">Approved:</span> {format(new Date(detailPrf.approved_at), 'dd MMM yyyy HH:mm')}</p>
                    )}
                  </div>
                </div>

                {/* Rejection Info */}
                {detailPrf.status === 'rejected' && detailPrf.rejection_remarks && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="font-semibold text-destructive">Rejected</p>
                    <p><span className="text-muted-foreground">Rejected by:</span> {detailPrf.rejected_by_profile?.full_name || '-'}{detailPrf.rejected_at ? ` on ${format(new Date(detailPrf.rejected_at), 'dd MMM yyyy HH:mm')}` : ''}</p>
                    <p><span className="text-muted-foreground">Stage:</span> {detailPrf.rejection_stage || '-'}</p>
                    <p><span className="text-muted-foreground">Remarks:</span> {detailPrf.rejection_remarks}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectingPrfId(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reject PRF</DialogTitle>
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
              <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectingPrfId(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={rejectPRF.isRejecting || !rejectRemarks.trim()}
              >
                {rejectPRF.isRejecting ? 'Rejecting...' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
