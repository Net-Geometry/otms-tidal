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
  useApproveOR,
  useArInvoices,
  useCreateOfficialReceipt,
  useOfficialReceipts,
  usePostOR,
  useSubmitOR,
  useUpdateOfficialReceipt,
} from '@/hooks/finance/useAccountsReceivable';
import {
  AR_PAYMENT_METHOD_LABELS,
  AR_RECEIPT_STATUS_LABELS,
  type ArPaymentMethod,
  type ArReceiptStatus,
  type OfficialReceipt,
} from '@/types/finance';

interface OfficialReceiptFormState {
  company_id: string;
  customer_id: string;
  bank_account_id: string;
  receipt_date: string;
  payment_method: ArPaymentMethod;
  reference_no: string;
  remarks: string;
  allocations: Record<string, string>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeInitialForm(companyId: string): OfficialReceiptFormState {
  return {
    company_id: companyId,
    customer_id: '',
    bank_account_id: '',
    receipt_date: new Date().toISOString().slice(0, 10),
    payment_method: 'online_transfer',
    reference_no: '',
    remarks: '',
    allocations: {},
  };
}

export default function OfficialReceipts() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const customers = useCustomers();
  const bankAccounts = useBankAccounts();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ArReceiptStatus>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<OfficialReceipt | null>(null);
  const [detailReceipt, setDetailReceipt] = useState<OfficialReceipt | null>(null);
  const [form, setForm] = useState<OfficialReceiptFormState>(makeInitialForm(''));

  const receipts = useOfficialReceipts({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    customerId: customerFilter === 'all' ? undefined : customerFilter,
    search,
    page,
    pageSize: 12,
  });

  const customerInvoices = useArInvoices({
    companyId: form.company_id || undefined,
    customerId: form.customer_id || undefined,
    status: 'all',
    page: 1,
    pageSize: 200,
  });

  const createReceipt = useCreateOfficialReceipt();
  const updateReceipt = useUpdateOfficialReceipt();
  const submitOR = useSubmitOR();
  const approveOR = useApproveOR();
  const postOR = usePostOR();

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows = receipts.data?.rows || [];
  const totalPages = receipts.data?.totalPages || 0;

  const outstandingInvoices = useMemo(() => {
    return (customerInvoices.data?.rows || [])
      .filter((invoice) => ['posted', 'partially_paid'].includes(invoice.status))
      .map((invoice) => {
        const outstanding = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
        return {
          ...invoice,
          outstanding,
        };
      })
      .filter((invoice) => invoice.outstanding > 0.0001);
  }, [customerInvoices.data]);

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

  const filteredCustomers = useMemo(() => {
    if (!form.company_id) return customers.customers;
    return customers.customers.filter((customer) => customer.company_id === form.company_id);
  }, [customers.customers, form.company_id]);

  const filteredBankAccounts = useMemo(() => {
    if (!form.company_id) return bankAccounts.bankAccounts;
    return bankAccounts.bankAccounts.filter((account) => account.company_id === form.company_id);
  }, [bankAccounts.bankAccounts, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;

    setEditingReceipt(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (receipt: OfficialReceipt) => {
    const allocations: Record<string, string> = {};
    for (const allocation of receipt.allocations || []) {
      allocations[allocation.ar_invoice_id] = String(allocation.allocated_amount || 0);
    }

    setEditingReceipt(receipt);
    setForm({
      company_id: receipt.company_id,
      customer_id: receipt.customer_id,
      bank_account_id: receipt.bank_account_id,
      receipt_date: receipt.receipt_date,
      payment_method: receipt.payment_method,
      reference_no: receipt.reference_no || '',
      remarks: receipt.remarks || '',
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

    if (!form.customer_id) {
      toast({ title: 'Customer is required', variant: 'destructive' });
      return;
    }

    if (!form.bank_account_id) {
      toast({ title: 'Bank account is required', variant: 'destructive' });
      return;
    }

    const allocations = Object.entries(form.allocations)
      .map(([invoiceId, amountRaw]) => ({
        ar_invoice_id: invoiceId,
        allocated_amount: Number(amountRaw || 0),
      }))
      .filter((item) => item.allocated_amount > 0);

    if (!allocations.length) {
      toast({ title: 'Add at least one allocation', variant: 'destructive' });
      return;
    }

    for (const allocation of allocations) {
      const outstanding = outstandingByInvoiceId.get(allocation.ar_invoice_id);
      if (outstanding == null) {
        toast({ title: 'Selected invoice is not collectible', variant: 'destructive' });
        return;
      }
      if (allocation.allocated_amount > outstanding + 0.0001) {
        toast({ title: 'Allocated amount exceeds outstanding balance', variant: 'destructive' });
        return;
      }
    }

    const payload = {
      id: editingReceipt?.id,
      company_id: form.company_id,
      customer_id: form.customer_id,
      bank_account_id: form.bank_account_id,
      receipt_date: form.receipt_date,
      payment_method: form.payment_method,
      reference_no: form.reference_no.trim() || null,
      remarks: form.remarks.trim() || null,
      allocations,
    };

    if (editingReceipt) {
      await updateReceipt.updateOfficialReceipt(payload);
    } else {
      await createReceipt.createOfficialReceipt(payload);
    }

    setDialogOpen(false);
    setEditingReceipt(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Official Receipts"
        description="Prepare customer receipts, allocate invoices, and post collections to GL."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Official Receipt
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
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
                  setStatusFilter(value as 'all' | ArReceiptStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AR_RECEIPT_STATUS_LABELS) as ArReceiptStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AR_RECEIPT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={customerFilter}
                onValueChange={(value) => {
                  setCustomerFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.customer_code} - {customer.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search receipt number or reference"
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
            <CardTitle className="text-base">Official Receipt Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !receipts.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No official receipts found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">{receipt.receipt_number || 'Draft'}</TableCell>
                        <TableCell>{receipt.customer?.customer_name || '-'}</TableCell>
                        <TableCell>{format(new Date(receipt.receipt_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{AR_PAYMENT_METHOD_LABELS[receipt.payment_method]}</TableCell>
                        <TableCell className="text-right">{formatMoney(receipt.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={receipt.status === 'posted' ? 'default' : 'secondary'}>
                            {AR_RECEIPT_STATUS_LABELS[receipt.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {receipt.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(receipt)}>
                                Edit
                              </Button>
                            )}
                            {receipt.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitOR.submitOR({ orId: receipt.id })}
                                disabled={submitOR.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {receipt.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveOR.approveOR({ orId: receipt.id })}
                                disabled={approveOR.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {receipt.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postOR.postOR({ orId: receipt.id })}
                                disabled={postOR.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailReceipt(receipt)}>
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

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingReceipt(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingReceipt ? 'Edit Official Receipt' : 'New Official Receipt'}</DialogTitle>
              <DialogDescription>Select customer invoices and allocate collection amounts for knock-off.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={form.company_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, company_id: value === 'none' ? '' : value }))}
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
                    onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value === 'none' ? '' : value, allocations: {} }))}
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
                  <Label>Receipt Date</Label>
                  <Input
                    type="date"
                    value={form.receipt_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, receipt_date: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select
                    value={form.bank_account_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, bank_account_id: value === 'none' ? '' : value }))}
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
                    onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value as ArPaymentMethod }))}
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

                <div className="space-y-2">
                  <Label>Reference No</Label>
                  <Input
                    value={form.reference_no}
                    onChange={(event) => setForm((prev) => ({ ...prev, reference_no: event.target.value }))}
                    placeholder="Cheque no / transfer ref"
                  />
                </div>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Outstanding AR Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {!form.customer_id ? (
                    <p className="text-sm text-muted-foreground">Select customer to load outstanding invoices.</p>
                  ) : !outstandingInvoices.length ? (
                    <p className="text-sm text-muted-foreground">No outstanding invoices for this customer.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Use</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Collected</TableHead>
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
                                  <Checkbox checked={checked} onCheckedChange={(value) => toggleAllocation(invoice.id, value === true)} />
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="font-medium">{invoice.invoice_number || invoice.id}</div>
                                    <div className="text-xs text-muted-foreground">Due {format(new Date(invoice.due_date), 'dd MMM yyyy')}</div>
                                  </div>
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
              <Button type="button" onClick={saveDraft} disabled={createReceipt.isCreating || updateReceipt.isSaving}>
                {createReceipt.isCreating || updateReceipt.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailReceipt} onOpenChange={(open) => !open && setDetailReceipt(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Official Receipt Detail</DialogTitle>
              <DialogDescription>Review receipt details and invoice allocation breakdown.</DialogDescription>
            </DialogHeader>

            {!detailReceipt ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">Receipt No:</span> {detailReceipt.receipt_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Customer:</span> {detailReceipt.customer?.customer_name || '-'}</p>
                  <p><span className="text-muted-foreground">Receipt Date:</span> {format(new Date(detailReceipt.receipt_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Method:</span> {AR_PAYMENT_METHOD_LABELS[detailReceipt.payment_method]}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AR_RECEIPT_STATUS_LABELS[detailReceipt.status]}</p>
                  <p><span className="text-muted-foreground">Amount:</span> {formatMoney(detailReceipt.total_amount)}</p>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Invoice Total</TableHead>
                        <TableHead className="text-right">Collected</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailReceipt.allocations || []).map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>{allocation.ar_invoice?.invoice_number || allocation.ar_invoice_id}</TableCell>
                          <TableCell className="text-right">{formatMoney(allocation.ar_invoice?.total_amount || 0)}</TableCell>
                          <TableCell className="text-right">{formatMoney(allocation.ar_invoice?.paid_amount || 0)}</TableCell>
                          <TableCell className="text-right">{formatMoney(allocation.allocated_amount)}</TableCell>
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
