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
import { useBankAccounts, useCustomers } from '@/hooks/finance/useFinanceFoundation';
import {
  useArInvoices,
  useArPayments,
  useCreateArPayment,
  useUpdateArPayment,
  useSubmitArPayment,
  useApproveArPayment,
  usePostArPayment,
  useDeleteArPayment,
} from '@/hooks/finance/useAccountsReceivable';
import {
  AR_PAYMENT_METHOD_LABELS,
  AR_PAYMENT_STATUS_LABELS,
  type ArPayment,
  type ArPaymentMethod,
  type ArPaymentStatus,
} from '@/types/finance';

interface ArPaymentFormState {
  company_id: string;
  customer_id: string;
  received_from: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: ArPaymentMethod;
  reference_no: string;
  remarks: string;
  allocations: Record<string, string>; // ar_invoice_id → amount string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeInitialForm(companyId: string): ArPaymentFormState {
  return {
    company_id: companyId,
    customer_id: '',
    received_from: '',
    bank_account_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'online_transfer',
    reference_no: '',
    remarks: '',
    allocations: {},
  };
}

export default function ArPayments() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const bankAccounts = useBankAccounts();
  const customersQuery = useCustomers();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ArPaymentStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ArPayment | null>(null);
  const [detailPayment, setDetailPayment] = useState<ArPayment | null>(null);
  const [form, setForm] = useState<ArPaymentFormState>(makeInitialForm(''));

  const payments = useArPayments({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search,
    page,
  });

  const companyInvoices = useArInvoices({
    companyId: form.company_id || undefined,
    status: 'all',
    page: 1,
    pageSize: 200,
  });

  const createPayment = useCreateArPayment();
  const updatePayment = useUpdateArPayment();
  const submitArPayment = useSubmitArPayment();
  const approveArPayment = useApproveArPayment();
  const postArPayment = usePostArPayment();
  const deleteArPayment = useDeleteArPayment();

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows: ArPayment[] = (payments.data?.data || []) as ArPayment[];
  const total = payments.data?.total || 0;
  const pageSize = payments.data?.pageSize || 20;
  const totalPages = Math.ceil(total / pageSize);

  const outstandingInvoices = useMemo(() => {
    return (companyInvoices.data?.rows || [])
      .filter((invoice) => ['posted', 'approved', 'partially_paid'].includes(invoice.status))
      .map((invoice) => {
        const outstanding = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
        return {
          ...invoice,
          outstanding,
        };
      })
      .filter((invoice) => invoice.outstanding > 0.0001);
  }, [companyInvoices.data]);

  const outstandingByInvoiceId = useMemo(() => {
    const map = new Map<string, number>();
    for (const invoice of outstandingInvoices) {
      map.set(invoice.id, invoice.outstanding);
    }
    return map;
  }, [outstandingInvoices]);

  const totalAllocated = useMemo(() => {
    return Object.values(form.allocations).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [form.allocations]);

  const filteredBankAccounts = useMemo(() => {
    if (!form.company_id) return bankAccounts.bankAccounts;
    return bankAccounts.bankAccounts.filter((account) => account.company_id === form.company_id);
  }, [bankAccounts.bankAccounts, form.company_id]);

  const filteredCustomers = useMemo(() => {
    if (!form.company_id) return customersQuery.customers || [];
    return (customersQuery.customers || []).filter((c) => c.company_id === form.company_id);
  }, [customersQuery.customers, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;

    setEditingPayment(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (payment: ArPayment) => {
    const allocations: Record<string, string> = {};
    for (const allocation of payment.allocations || []) {
      allocations[allocation.ar_invoice_id] = String(allocation.allocated_amount || 0);
    }

    setEditingPayment(payment);
    setForm({
      company_id: payment.company_id,
      customer_id: payment.customer_id || '',
      received_from: payment.received_from || payment.customer?.customer_name || '',
      bank_account_id: payment.bank_account_id,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      reference_no: payment.reference_no || '',
      remarks: payment.remarks || '',
      allocations,
    });
    setDialogOpen(true);
  };

  const toggleAllocation = (invoiceId: string, checked: boolean) => {
    setForm((prev) => {
      const next = { ...prev.allocations };
      if (checked) {
        const outstanding = outstandingByInvoiceId.get(invoiceId) || 0;
        next[invoiceId] = String(outstanding.toFixed(2));
      } else {
        delete next[invoiceId];
      }
      return { ...prev, allocations: next };
    });
  };

  const updateAllocationAmount = (invoiceId: string, amount: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [invoiceId]: amount,
      },
    }));
  };

  const saveDraft = async () => {
    if (!form.company_id) {
      toast({ title: 'Company is required', variant: 'destructive' });
      return;
    }

    if (!form.received_from.trim()) {
      toast({ title: 'Received From is required', variant: 'destructive' });
      return;
    }

    if (!form.bank_account_id) {
      toast({ title: 'Bank account is required', variant: 'destructive' });
      return;
    }

    const allocations: Record<string, string> = {};
    let hasAllocation = false;

    for (const [invoiceId, amountRaw] of Object.entries(form.allocations)) {
      const amount = Number(amountRaw || 0);
      if (amount > 0) {
        const outstanding = outstandingByInvoiceId.get(invoiceId);
        if (outstanding == null) {
          toast({ title: 'Selected invoice is not collectible', variant: 'destructive' });
          return;
        }
        if (amount > outstanding + 0.0001) {
          toast({ title: 'Allocated amount exceeds outstanding balance', variant: 'destructive' });
          return;
        }
        allocations[invoiceId] = amountRaw;
        hasAllocation = true;
      }
    }

    if (!hasAllocation) {
      toast({ title: 'Add at least one allocation', variant: 'destructive' });
      return;
    }

    const payload = {
      company_id: form.company_id,
      customer_id: form.customer_id || undefined,
      received_from: form.received_from.trim(),
      bank_account_id: form.bank_account_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      reference_no: form.reference_no.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
      allocations,
    };

    if (editingPayment) {
      await updatePayment.updateArPayment({ id: editingPayment.id, ...payload });
    } else {
      await createPayment.createArPayment(payload);
    }

    setDialogOpen(false);
    setEditingPayment(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AR Payments"
        description="Record and manage accounts receivable payments"
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New AR Payment
          </Button>
        }
      >
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
                  setStatusFilter(value as 'all' | ArPaymentStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AR_PAYMENT_STATUS_LABELS) as ArPaymentStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AR_PAYMENT_STATUS_LABELS[status]}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AR Payment Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !payments.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No AR payments found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment No</TableHead>
                      <TableHead>Customer / Received From</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Bank Account</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.payment_number || 'Draft'}</TableCell>
                        <TableCell>{payment.received_from || payment.customer?.customer_name || '-'}</TableCell>
                        <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {payment.bank_account
                            ? `${payment.bank_account.account_code} - ${payment.bank_account.account_name}`
                            : '-'}
                        </TableCell>
                        <TableCell>{AR_PAYMENT_METHOD_LABELS[payment.payment_method]}</TableCell>
                        <TableCell>{payment.reference_no || '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(payment.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'posted' ? 'default' : 'secondary'}>
                            {AR_PAYMENT_STATUS_LABELS[payment.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {payment.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(payment)}>
                                Edit
                              </Button>
                            )}
                            {payment.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitArPayment.submitArPayment(payment.id)}
                                disabled={submitArPayment.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {payment.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteArPayment.deleteArPayment(payment.id)}
                                disabled={deleteArPayment.isDeleting}
                              >
                                Delete
                              </Button>
                            )}
                            {payment.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveArPayment.approveArPayment(payment.id)}
                                disabled={approveArPayment.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {payment.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postArPayment.postArPayment(payment.id)}
                                disabled={postArPayment.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailPayment(payment)}>
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
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingPayment(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingPayment ? 'Edit AR Payment' : 'New AR Payment'}</DialogTitle>
              <DialogDescription>Select customer invoices and allocate payment amounts for knock-off.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={form.company_id || 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, company_id: value === 'none' ? '' : value, customer_id: '', received_from: '' }))
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
                  <Label>Customer</Label>
                  <Select
                    value={form.customer_id || 'none'}
                    onValueChange={(value) => {
                      const customerId = value === 'none' ? '' : value;
                      const customer = filteredCustomers.find((c) => c.id === customerId);
                      setForm((prev) => ({
                        ...prev,
                        customer_id: customerId,
                        received_from: customer ? customer.customer_name : prev.received_from,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select customer</SelectItem>
                      {filteredCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.customer_code} - {customer.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Received From *</Label>
                  <Input
                    value={form.received_from}
                    onChange={(event) => setForm((prev) => ({ ...prev, received_from: event.target.value }))}
                    placeholder="Name of payer"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select
                    value={form.bank_account_id || 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, bank_account_id: value === 'none' ? '' : value }))
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

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, payment_method: value as ArPaymentMethod }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AR_PAYMENT_METHOD_LABELS) as ArPaymentMethod[]).map((method) => (
                        <SelectItem key={method} value={method}>
                          {AR_PAYMENT_METHOD_LABELS[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reference No</Label>
                  <Input
                    value={form.reference_no}
                    onChange={(event) => setForm((prev) => ({ ...prev, reference_no: event.target.value }))}
                    placeholder="Cheque no / transfer ref"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Outstanding AR Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {!form.company_id ? (
                    <p className="text-sm text-muted-foreground">Select company to load outstanding invoices.</p>
                  ) : !outstandingInvoices.length ? (
                    <p className="text-sm text-muted-foreground">No outstanding invoices for this company.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Use</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                            <TableHead className="text-right">Allocate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outstandingInvoices.map((invoice) => {
                            const checked = form.allocations[invoice.id] != null;
                            const allocatedValue = form.allocations[invoice.id] || '';
                            const invalid = Number(allocatedValue || 0) > Number(invoice.outstanding || 0);

                            return (
                              <TableRow key={invoice.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleAllocation(invoice.id, value === true)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{invoice.invoice_number || invoice.id}</div>
                                </TableCell>
                                <TableCell>
                                  {invoice.invoice_date
                                    ? format(new Date(invoice.invoice_date), 'dd MMM yyyy')
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-right">{formatMoney(invoice.total_amount)}</TableCell>
                                <TableCell className="text-right">{formatMoney(invoice.paid_amount)}</TableCell>
                                <TableCell className="text-right">{formatMoney(invoice.outstanding)}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`w-36 ml-auto ${invalid ? 'border-destructive' : ''}`}
                                    disabled={!checked}
                                    value={allocatedValue}
                                    onChange={(event) => updateAllocationAmount(invoice.id, event.target.value)}
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

        {/* Detail View Dialog */}
        <Dialog open={!!detailPayment} onOpenChange={(open) => !open && setDetailPayment(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>AR Payment Detail</DialogTitle>
              <DialogDescription>Review payment details and invoice allocation breakdown.</DialogDescription>
            </DialogHeader>

            {!detailPayment ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Payment No:</span>{' '}
                    {detailPayment.payment_number || 'Draft'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Customer:</span>{' '}
                    {detailPayment.customer?.customer_name || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Received From:</span>{' '}
                    {detailPayment.received_from || detailPayment.customer?.customer_name || '-'}
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
                    {AR_PAYMENT_METHOD_LABELS[detailPayment.payment_method]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reference No:</span>{' '}
                    {detailPayment.reference_no || '-'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    {AR_PAYMENT_STATUS_LABELS[detailPayment.status]}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total Amount:</span>{' '}
                    {formatMoney(detailPayment.total_amount)}
                  </p>
                  {detailPayment.remarks && (
                    <p className="md:col-span-2">
                      <span className="text-muted-foreground">Remarks:</span>{' '}
                      {detailPayment.remarks}
                    </p>
                  )}
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Invoice Total</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailPayment.allocations || []).map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            {allocation.ar_invoice?.invoice_number || allocation.ar_invoice_id}
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(allocation.ar_invoice?.total_amount || 0)}
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
