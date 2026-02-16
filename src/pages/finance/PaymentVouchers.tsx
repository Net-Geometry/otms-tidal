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
import { useBankAccounts, useSuppliers } from '@/hooks/finance/useFinanceFoundation';
import {
  useApInvoices,
  useApprovePV,
  useCreatePaymentVoucher,
  usePaymentVouchers,
  usePostPV,
  useSubmitPV,
  useUpdatePaymentVoucher,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  type ApPaymentMethod,
  type ApPvStatus,
  type PaymentVoucher,
} from '@/types/finance';

interface PvFormState {
  company_id: string;
  supplier_id: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: ApPaymentMethod;
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

function makeInitialForm(companyId: string): PvFormState {
  return {
    company_id: companyId,
    supplier_id: '',
    bank_account_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'online_transfer',
    reference_no: '',
    remarks: '',
    allocations: {},
  };
}

export default function PaymentVouchers() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
  const bankAccounts = useBankAccounts();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApPvStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucher | null>(null);
  const [detailVoucher, setDetailVoucher] = useState<PaymentVoucher | null>(null);
  const [form, setForm] = useState<PvFormState>(makeInitialForm(''));

  const vouchers = usePaymentVouchers({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    supplierId: supplierFilter === 'all' ? undefined : supplierFilter,
    search,
    page,
    pageSize: 12,
  });

  const supplierInvoices = useApInvoices({
    companyId: form.company_id || undefined,
    supplierId: form.supplier_id || undefined,
    status: 'all',
    page: 1,
    pageSize: 200,
  });

  const createVoucher = useCreatePaymentVoucher();
  const updateVoucher = useUpdatePaymentVoucher();
  const submitPV = useSubmitPV();
  const approvePV = useApprovePV();
  const postPV = usePostPV();

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows = vouchers.data?.rows || [];
  const totalPages = vouchers.data?.totalPages || 0;

  const outstandingInvoices = useMemo(() => {
    return (supplierInvoices.data?.rows || [])
      .filter((invoice) => ['posted', 'partially_paid'].includes(invoice.status))
      .map((invoice) => {
        const outstanding = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);
        return {
          ...invoice,
          outstanding,
        };
      })
      .filter((invoice) => invoice.outstanding > 0.0001);
  }, [supplierInvoices.data]);

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

  const filteredSuppliers = useMemo(() => {
    if (!form.company_id) return suppliers.suppliers;
    return suppliers.suppliers.filter((supplier) => supplier.company_id === form.company_id);
  }, [suppliers.suppliers, form.company_id]);

  const filteredBankAccounts = useMemo(() => {
    if (!form.company_id) return bankAccounts.bankAccounts;
    return bankAccounts.bankAccounts.filter((account) => account.company_id === form.company_id);
  }, [bankAccounts.bankAccounts, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;

    setEditingVoucher(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (voucher: PaymentVoucher) => {
    const allocations: Record<string, string> = {};
    for (const allocation of voucher.allocations || []) {
      allocations[allocation.ap_invoice_id] = String(allocation.allocated_amount || 0);
    }

    setEditingVoucher(voucher);
    setForm({
      company_id: voucher.company_id,
      supplier_id: voucher.supplier_id,
      bank_account_id: voucher.bank_account_id,
      payment_date: voucher.payment_date,
      payment_method: voucher.payment_method,
      reference_no: voucher.reference_no || '',
      remarks: voucher.remarks || '',
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

    if (!form.supplier_id) {
      toast({ title: 'Supplier is required', variant: 'destructive' });
      return;
    }

    if (!form.bank_account_id) {
      toast({ title: 'Bank account is required', variant: 'destructive' });
      return;
    }

    const allocations = Object.entries(form.allocations)
      .map(([invoiceId, amountRaw]) => ({
        ap_invoice_id: invoiceId,
        allocated_amount: Number(amountRaw || 0),
      }))
      .filter((item) => item.allocated_amount > 0);

    if (!allocations.length) {
      toast({ title: 'Add at least one allocation', variant: 'destructive' });
      return;
    }

    for (const allocation of allocations) {
      const outstanding = outstandingByInvoiceId.get(allocation.ap_invoice_id);
      if (outstanding == null) {
        toast({ title: 'Selected invoice is not payable', variant: 'destructive' });
        return;
      }
      if (allocation.allocated_amount > outstanding + 0.0001) {
        toast({ title: 'Allocated amount exceeds outstanding balance', variant: 'destructive' });
        return;
      }
    }

    const payload = {
      id: editingVoucher?.id,
      company_id: form.company_id,
      supplier_id: form.supplier_id,
      bank_account_id: form.bank_account_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      reference_no: form.reference_no.trim() || null,
      remarks: form.remarks.trim() || null,
      allocations,
    };

    if (editingVoucher) {
      await updateVoucher.updatePaymentVoucher(payload);
    } else {
      await createVoucher.createPaymentVoucher(payload);
    }

    setDialogOpen(false);
    setEditingVoucher(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Payment Vouchers"
        description="Prepare AP payments, allocate invoices, and post disbursements to GL."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Payment Voucher
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
                  setStatusFilter(value as 'all' | ApPvStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AP_PV_STATUS_LABELS) as ApPvStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AP_PV_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={supplierFilter}
                onValueChange={(value) => {
                  setSupplierFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} - {supplier.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search PV number or reference"
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
            <CardTitle className="text-base">Payment Voucher Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !vouchers.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No payment vouchers found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PV No</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((voucher) => (
                      <TableRow key={voucher.id}>
                        <TableCell className="font-medium">{voucher.pv_number || 'Draft'}</TableCell>
                        <TableCell>{voucher.supplier?.supplier_name || '-'}</TableCell>
                        <TableCell>{format(new Date(voucher.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{AP_PAYMENT_METHOD_LABELS[voucher.payment_method]}</TableCell>
                        <TableCell className="text-right">{formatMoney(voucher.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={voucher.status === 'posted' ? 'default' : 'secondary'}>
                            {AP_PV_STATUS_LABELS[voucher.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {voucher.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(voucher)}>
                                Edit
                              </Button>
                            )}
                            {voucher.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitPV.submitPV({ pvId: voucher.id })}
                                disabled={submitPV.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {voucher.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approvePV.approvePV({ pvId: voucher.id })}
                                disabled={approvePV.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {voucher.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postPV.postPV({ pvId: voucher.id })}
                                disabled={postPV.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailVoucher(voucher)}>
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
            if (!open) setEditingVoucher(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingVoucher ? 'Edit Payment Voucher' : 'New Payment Voucher'}</DialogTitle>
              <DialogDescription>Select supplier invoices and allocate payment amounts for knock-off.</DialogDescription>
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
                  <Label>Supplier</Label>
                  <Select
                    value={form.supplier_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value, allocations: {} }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select supplier</SelectItem>
                      {filteredSuppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_code} - {supplier.supplier_name}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))}
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
                    onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value as ApPaymentMethod }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AP_PAYMENT_METHOD_LABELS) as ApPaymentMethod[]).map((method) => (
                        <SelectItem key={method} value={method}>
                          {AP_PAYMENT_METHOD_LABELS[method]}
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
                  <CardTitle className="text-sm">Outstanding Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {!form.supplier_id ? (
                    <p className="text-sm text-muted-foreground">Select supplier to load outstanding invoices.</p>
                  ) : !outstandingInvoices.length ? (
                    <p className="text-sm text-muted-foreground">No outstanding invoices for this supplier.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Use</TableHead>
                            <TableHead>Invoice</TableHead>
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
              <Button type="button" onClick={saveDraft} disabled={createVoucher.isCreating || updateVoucher.isSaving}>
                {createVoucher.isCreating || updateVoucher.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailVoucher} onOpenChange={(open) => !open && setDetailVoucher(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Payment Voucher Detail</DialogTitle>
              <DialogDescription>Review payment details and invoice allocation breakdown.</DialogDescription>
            </DialogHeader>

            {!detailVoucher ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">PV No:</span> {detailVoucher.pv_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Supplier:</span> {detailVoucher.supplier?.supplier_name || '-'}</p>
                  <p><span className="text-muted-foreground">Payment Date:</span> {format(new Date(detailVoucher.payment_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Method:</span> {AP_PAYMENT_METHOD_LABELS[detailVoucher.payment_method]}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_PV_STATUS_LABELS[detailVoucher.status]}</p>
                  <p><span className="text-muted-foreground">Amount:</span> {formatMoney(detailVoucher.total_amount)}</p>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Invoice Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailVoucher.allocations || []).map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>{allocation.ap_invoice?.invoice_number || allocation.ap_invoice_id}</TableCell>
                          <TableCell className="text-right">{formatMoney(allocation.ap_invoice?.total_amount || 0)}</TableCell>
                          <TableCell className="text-right">{formatMoney(allocation.ap_invoice?.paid_amount || 0)}</TableCell>
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
