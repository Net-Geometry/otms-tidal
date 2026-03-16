import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, PlusCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useBankAccounts } from '@/hooks/finance/useFinanceFoundation';
import { useActiveRole } from '@/hooks/useActiveRole';
import {
  useApPayments,
  useCreateApPayment,
  useUpdateApPayment,
  useSubmitApPayment,
  useApproveApPayment,
  usePostApPayment,
  useDeleteApPayment,
  usePaymentVouchers,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PAYMENT_STATUS_LABELS,
  type ApPaymentMethod,
  type ApPaymentStatus,
  type ApPayment,
} from '@/types/finance';

interface ApPaymentFormState {
  company_id: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: ApPaymentMethod;
  reference_no: string;
  remarks: string;
  allocations: Record<string, string>; // pv_id → amount string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeInitialForm(companyId: string): ApPaymentFormState {
  return {
    company_id: companyId,
    bank_account_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'online_transfer',
    reference_no: '',
    remarks: '',
    allocations: {},
  };
}

export default function ApPayments() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const bankAccounts = useBankAccounts();
  const { activeRole } = useActiveRole();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApPaymentStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ApPayment | null>(null);
  const [detailPayment, setDetailPayment] = useState<ApPayment | null>(null);
  const [form, setForm] = useState<ApPaymentFormState>(makeInitialForm(''));

  const paymentsQuery = useApPayments({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search,
    page,
  });

  const approvedPvs = usePaymentVouchers({
    companyId: form.company_id || undefined,
    status: 'approved',
    page: 1,
    pageSize: 200,
  });

  const createPayment = useCreateApPayment();
  const updatePayment = useUpdateApPayment();
  const submitApPayment = useSubmitApPayment();
  const approveApPayment = useApproveApPayment();
  const postApPayment = usePostApPayment();
  const deleteApPayment = useDeleteApPayment();

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows: ApPayment[] = (paymentsQuery.data?.data || []) as ApPayment[];
  const total = paymentsQuery.data?.total || 0;
  const pageSize = paymentsQuery.data?.pageSize || 20;
  const totalPages = Math.ceil(total / pageSize);

  const pvList = useMemo(() => {
    return (approvedPvs.data?.rows || []).map((pv) => ({
      ...pv,
      total_amount: Number(pv.total_amount || 0),
    }));
  }, [approvedPvs.data]);

  const pvById = useMemo(() => {
    const map = new Map<string, (typeof pvList)[number]>();
    for (const pv of pvList) {
      map.set(pv.id, pv);
    }
    return map;
  }, [pvList]);

  const totalAllocated = useMemo(() => {
    return Object.values(form.allocations).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [form.allocations]);

  const filteredBankAccounts = useMemo(() => {
    if (!form.company_id) return bankAccounts.bankAccounts;
    return bankAccounts.bankAccounts.filter((account) => account.company_id === form.company_id);
  }, [bankAccounts.bankAccounts, form.company_id]);

  // Summary counts
  const counts = useMemo(() => {
    const result = { draft: 0, pending: 0, approved: 0, posted: 0 };
    for (const row of rows) {
      if (row.status in result) {
        result[row.status as keyof typeof result]++;
      }
    }
    return result;
  }, [rows]);

  const pageTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  }, [rows]);

  const canApprove = ['dmd', 'assistant_manager', 'director', 'gm'].includes(activeRole || '');
  const canSubmitPost = ['finance', 'finance_admin', 'account_assistant', 'account_exec', 'head_finance', 'admin'].includes(activeRole || '');

  const openNewDialog = () => {
    const defaultCompanyId =
      companyFilter === 'all' ? companies[0]?.id || '' : companyFilter;

    setEditingPayment(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (payment: ApPayment) => {
    const allocations: Record<string, string> = {};
    for (const allocation of payment.allocations || []) {
      allocations[allocation.pv_id] = String(allocation.allocated_amount || 0);
    }

    setEditingPayment(payment);
    setForm({
      company_id: payment.company_id,
      bank_account_id: payment.bank_account_id,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      reference_no: payment.reference_no || '',
      remarks: payment.remarks || '',
      allocations,
    });
    setDialogOpen(true);
  };

  const toggleAllocation = (pvId: string, checked: boolean) => {
    setForm((prev) => {
      const next = { ...prev.allocations };
      if (checked) {
        const pv = pvById.get(pvId);
        next[pvId] = String((pv?.total_amount || 0).toFixed(2));
      } else {
        delete next[pvId];
      }
      return { ...prev, allocations: next };
    });
  };

  const updateAllocationAmount = (pvId: string, amount: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [pvId]: amount,
      },
    }));
  };

  const saveDraft = async () => {
    if (!form.company_id) {
      toast({ title: 'Company is required', variant: 'destructive' });
      return;
    }

    if (!form.bank_account_id) {
      toast({ title: 'Bank account is required', variant: 'destructive' });
      return;
    }

    const allocations = Object.fromEntries(
      Object.entries(form.allocations).filter(([, v]) => Number(v || 0) > 0),
    );

    if (!Object.keys(allocations).length) {
      toast({ title: 'Add at least one allocation', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingPayment?.id,
      company_id: form.company_id,
      bank_account_id: form.bank_account_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      reference_no: form.reference_no.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
      allocations,
    };

    if (editingPayment) {
      await updatePayment.updateApPayment({ ...payload, id: editingPayment.id });
    } else {
      await createPayment.createApPayment(payload);
    }

    setDialogOpen(false);
    setEditingPayment(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AP Payments"
        description="Record and manage accounts payable payments"
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New AP Payment
          </Button>
        }
      >
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.draft}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Posted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.posted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Page Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(pageTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                value={companyFilter}
                onValueChange={(value) => {
                  setCompanyFilter(value);
                  setPage(1);
                }}
              >
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

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as 'all' | ApPaymentStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AP_PAYMENT_STATUS_LABELS) as ApPaymentStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AP_PAYMENT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search payment number or reference"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
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
            {!rows.length && !paymentsQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No AP payments found.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Payment Date</TableHead>
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
                        <TableCell className="font-medium">
                          {payment.payment_number || 'Draft'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          {payment.bank_account
                            ? `${payment.bank_account.account_code} - ${payment.bank_account.account_name}`
                            : '-'}
                        </TableCell>
                        <TableCell>{AP_PAYMENT_METHOD_LABELS[payment.payment_method]}</TableCell>
                        <TableCell>{payment.reference_no || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(payment.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'posted' ? 'default' : 'secondary'}>
                            {AP_PAYMENT_STATUS_LABELS[payment.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {payment.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(payment)}
                              >
                                Edit
                              </Button>
                            )}
                            {payment.status === 'draft' && canSubmitPost && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitApPayment.submitApPayment(payment.id)}
                                disabled={submitApPayment.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {payment.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteApPayment.deleteApPayment(payment.id)}
                                disabled={deleteApPayment.isDeleting}
                              >
                                Delete
                              </Button>
                            )}
                            {payment.status === 'pending' && canApprove && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveApPayment.approveApPayment(payment.id)}
                                disabled={approveApPayment.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {payment.status === 'approved' && canSubmitPost && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postApPayment.postApPayment(payment.id)}
                                disabled={postApPayment.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailPayment(payment)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
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

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* New / Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingPayment(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                {editingPayment ? 'Edit AP Payment' : 'New AP Payment'}
              </DialogTitle>
              <DialogDescription>
                Select approved payment vouchers and allocate payment amounts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={form.company_id || 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        company_id: value === 'none' ? '' : value,
                        allocations: {},
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, payment_date: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select
                    value={form.bank_account_id || 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        bank_account_id: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select bank account</SelectItem>
                      {filteredBankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_code} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, payment_method: value as ApPaymentMethod }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AP_PAYMENT_METHOD_LABELS) as ApPaymentMethod[]).map(
                        (method) => (
                          <SelectItem key={method} value={method}>
                            {AP_PAYMENT_METHOD_LABELS[method]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reference No</Label>
                  <Input
                    value={form.reference_no}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, reference_no: event.target.value }))
                    }
                    placeholder="Cheque no / transfer ref"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, remarks: event.target.value }))
                  }
                  placeholder="Optional notes"
                />
              </div>

              {/* PV Allocation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Approved Payment Vouchers</CardTitle>
                </CardHeader>
                <CardContent>
                  {!form.company_id ? (
                    <p className="text-sm text-muted-foreground">
                      Select company to load approved payment vouchers.
                    </p>
                  ) : !pvList.length ? (
                    <p className="text-sm text-muted-foreground">
                      No approved payment vouchers for this company.
                    </p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Use</TableHead>
                            <TableHead>PV Number</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-right">PV Total</TableHead>
                            <TableHead className="text-right">Allocate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pvList.map((pv) => {
                            const checked = form.allocations[pv.id] != null;
                            const allocatedValue = form.allocations[pv.id] || '';

                            return (
                              <TableRow key={pv.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      toggleAllocation(pv.id, value === true)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  {pv.pv_number || pv.id}
                                </TableCell>
                                <TableCell>
                                  {(pv as any).supplier?.supplier_name ||
                                    (pv as any).supplier?.supplier_code ||
                                    '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(pv.total_amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="ml-auto w-36"
                                    disabled={!checked}
                                    value={allocatedValue}
                                    onChange={(event) =>
                                      updateAllocationAmount(pv.id, event.target.value)
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="text-right text-sm font-medium">
                Total Allocated: {formatMoney(totalAllocated)}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveDraft}
                disabled={createPayment.isCreating || updatePayment.isSaving}
              >
                {createPayment.isCreating || updatePayment.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailPayment} onOpenChange={(open) => !open && setDetailPayment(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>AP Payment Detail</DialogTitle>
              <DialogDescription>Review payment details and PV allocation breakdown.</DialogDescription>
            </DialogHeader>

            {!detailPayment ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Payment No:</span>{' '}
                    {detailPayment.payment_number || 'Draft'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Payment Date:</span>{' '}
                    {format(new Date(detailPayment.payment_date), 'dd MMM yyyy')}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Bank Account:</span>{' '}
                    {detailPayment.bank_account
                      ? `${detailPayment.bank_account.account_code} - ${detailPayment.bank_account.account_name}`
                      : '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    {AP_PAYMENT_METHOD_LABELS[detailPayment.payment_method]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reference:</span>{' '}
                    {detailPayment.reference_no || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    {AP_PAYMENT_STATUS_LABELS[detailPayment.status]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total Amount:</span>{' '}
                    {formatMoney(detailPayment.total_amount)}
                  </p>
                  {detailPayment.remarks && (
                    <p>
                      <span className="text-muted-foreground">Remarks:</span>{' '}
                      {detailPayment.remarks}
                    </p>
                  )}
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PV Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailPayment.allocations || []).map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {allocation.payment_voucher?.pv_number || allocation.pv_id}
                          </TableCell>
                          <TableCell>
                            {allocation.payment_voucher?.supplier?.supplier_name ||
                              allocation.payment_voucher?.supplier?.supplier_code ||
                              '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(allocation.allocated_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
