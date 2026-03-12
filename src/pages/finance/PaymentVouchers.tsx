import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, PlusCircle, Plus, Trash2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useBankAccounts, useSuppliers } from '@/hooks/finance/useFinanceFoundation';
import {
  useApInvoices,
  useApprovePV,
  useCreatePaymentVoucher,
  useMarkPVPaid,
  usePaymentVouchers,
  usePostPV,
  usePurchaseRequisitions,
  useSubmitPV,
  useUpdatePaymentVoucher,
} from '@/hooks/finance/useAccountsPayable';
import { FileUpload } from '@/components/ot/FileUpload';
import { useActiveRole } from '@/hooks/useActiveRole';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  type ApPaymentMethod,
  type ApPvStatus,
  type PaymentVoucher,
  type PvPostToType,
} from '@/types/finance';

interface PvLineRow {
  line_date: string;
  description: string;
  cheque_no: string;
  amount: string;
}

interface PvFormState {
  company_id: string;
  supplier_id: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: ApPaymentMethod;
  payment_method_other: string;
  reference_no: string;
  pay_to: string;
  pay_for: string;
  is_recurring: boolean;
  remarks: string;
  lines: PvLineRow[];
  allocations: Record<string, string>;
  prf_id: string;
  attachment_urls: string[];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeEmptyLine(date: string): PvLineRow {
  return { line_date: date, description: '', cheque_no: '', amount: '' };
}

function makeInitialForm(companyId: string): PvFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: companyId,
    supplier_id: '',
    bank_account_id: '',
    payment_date: today,
    payment_method: 'online_transfer',
    payment_method_other: '',
    reference_no: '',
    pay_to: '',
    pay_for: '',
    is_recurring: false,
    remarks: '',
    lines: [makeEmptyLine(today)],
    allocations: {},
    prf_id: '',
    attachment_urls: [],
  };
}

export default function PaymentVouchers() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
  const bankAccounts = useBankAccounts();
  const { data: prfData } = usePurchaseRequisitions({ status: 'approved' });
  const approvedPrfs = useMemo(() => prfData?.rows || [], [prfData]);

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApPvStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedPvIds, setSelectedPvIds] = useState<string[]>([]);
  const { activeRole } = useActiveRole();

  const isFinanceAdmin = activeRole === 'finance_admin' || activeRole === 'admin';
  const isAccountExec = activeRole === 'account_exec';

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
  const { markPaid, isMarkingPaid } = useMarkPVPaid();

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

    const existingLines: PvLineRow[] = (voucher.lines || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line) => ({
        line_date: line.line_date,
        description: line.description || '',
        cheque_no: line.cheque_no || '',
        amount: String(line.amount || 0),
      }));

    setEditingVoucher(voucher);
    setForm({
      company_id: voucher.company_id,
      supplier_id: voucher.supplier_id || '',
      bank_account_id: voucher.bank_account_id,
      payment_date: voucher.payment_date,
      payment_method: voucher.payment_method,
      payment_method_other: voucher.payment_method_other || '',
      reference_no: voucher.reference_no || '',
      pay_to: voucher.pay_to || '',
      pay_for: voucher.pay_for || '',
      is_recurring: voucher.is_recurring ?? false,
      remarks: voucher.remarks || '',
      lines: existingLines.length ? existingLines : [makeEmptyLine(voucher.payment_date)],
      allocations,
      prf_id: voucher.prf_id || '',
      attachment_urls: voucher.attachment_urls || [],
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

  const linesTotal = useMemo(() => {
    return form.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  }, [form.lines]);

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, makeEmptyLine(prev.payment_date)],
    }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, field: keyof PvLineRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
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

    const allocations = Object.entries(form.allocations)
      .map(([invoiceId, amountRaw]) => ({
        ap_invoice_id: invoiceId,
        allocated_amount: Number(amountRaw || 0),
      }))
      .filter((item) => item.allocated_amount > 0);

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

    const lines = form.lines
      .filter((line) => line.description.trim() || Number(line.amount || 0) > 0)
      .map((line) => ({
        line_date: line.line_date,
        description: line.description,
        cheque_no: line.cheque_no || null,
        amount: Number(line.amount || 0),
      }));

    if (!allocations.length && !lines.length) {
      toast({ title: 'Add at least one line item or invoice allocation', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingVoucher?.id,
      company_id: form.company_id,
      supplier_id: form.supplier_id || null,
      bank_account_id: form.bank_account_id,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      payment_method_other: form.payment_method === 'others' ? form.payment_method_other.trim() || null : null,
      reference_no: form.reference_no.trim() || null,
      pay_to: form.pay_to.trim() || null,
      pay_for: form.pay_for.trim() || null,
      is_recurring: form.is_recurring,
      remarks: form.remarks.trim() || null,
      prf_id: form.prf_id || null,
      attachment_urls: form.attachment_urls,
      allocations,
      lines,
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
                  setSelectedPvIds([]);
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
            {isFinanceAdmin && selectedPvIds.length > 0 && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-muted rounded-lg">
                <span className="text-sm font-medium">{selectedPvIds.length} selected</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    await markPaid({ pvIds: selectedPvIds });
                    setSelectedPvIds([]);
                  }}
                  disabled={isMarkingPaid}
                >
                  {isMarkingPaid ? 'Processing...' : 'Mark as Paid'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedPvIds([])}>
                  Clear
                </Button>
              </div>
            )}
            {!rows.length && !vouchers.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No payment vouchers found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isFinanceAdmin && (
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={
                              rows.filter((r) => r.status === 'approved').length > 0 &&
                              rows.filter((r) => r.status === 'approved').every((r) => selectedPvIds.includes(r.id))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const approvedIds = rows.filter((r) => r.status === 'approved').map((r) => r.id);
                                setSelectedPvIds((prev) => [...new Set([...prev, ...approvedIds])]);
                              } else {
                                const approvedIds = new Set(rows.filter((r) => r.status === 'approved').map((r) => r.id));
                                setSelectedPvIds((prev) => prev.filter((id) => !approvedIds.has(id)));
                              }
                            }}
                          />
                        </TableHead>
                      )}
                      <TableHead>PV No</TableHead>
                      <TableHead>Pay To</TableHead>
                      <TableHead>Pay For</TableHead>
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
                        {isFinanceAdmin && (
                          <TableCell>
                            {voucher.status === 'approved' ? (
                              <Checkbox
                                checked={selectedPvIds.includes(voucher.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedPvIds((prev) => [...prev, voucher.id]);
                                  } else {
                                    setSelectedPvIds((prev) => prev.filter((id) => id !== voucher.id));
                                  }
                                }}
                              />
                            ) : null}
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{voucher.pv_number || 'Draft'}</TableCell>
                        <TableCell>{voucher.pay_to || voucher.supplier?.supplier_name || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{voucher.pay_for || '-'}</TableCell>
                        <TableCell>{format(new Date(voucher.payment_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{voucher.payment_method === 'others' ? (voucher.payment_method_other || 'Others') : AP_PAYMENT_METHOD_LABELS[voucher.payment_method]}</TableCell>
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
                            {voucher.status === 'approved' && isFinanceAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await markPaid({ pvIds: [voucher.id] });
                                }}
                                disabled={isMarkingPaid}
                              >
                                Mark Paid
                              </Button>
                            )}
                            {voucher.status === 'paid' && isAccountExec && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={postPV.isPosting}>
                                    Post to...
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'cashbook' })}>
                                    Cashbook
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'ap_payment' })}>
                                    AP Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'ap_credit_note' })}>
                                    AP Credit Note
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
              {/* Row 1: Company & Ref No / Date */}
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
                  <Label>Ref No.</Label>
                  <Input
                    value={form.reference_no}
                    readOnly
                    disabled
                    placeholder="Auto-generated"
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))}
                  />
                </div>
              </div>

              {/* Row 2: Pay To & Pay For */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pay To</Label>
                  <Input
                    value={form.pay_to}
                    onChange={(event) => setForm((prev) => ({ ...prev, pay_to: event.target.value }))}
                    placeholder="Payee name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pay For</Label>
                  <Input
                    value={form.pay_for}
                    onChange={(event) => setForm((prev) => ({ ...prev, pay_for: event.target.value }))}
                    placeholder="Payment purpose / description"
                  />
                </div>
              </div>

              {/* Row 3: Payment Method (bank account + method type + recurring) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payment Method (Bank Account)</Label>
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
                          {account.bank_name ? `${account.bank_name} - ` : ''}{account.account_code} {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Type</Label>
                  <RadioGroup
                    value={form.payment_method}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value as ApPaymentMethod }))}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2"
                  >
                    {(['cheque', 'online_transfer', 'cash', 'others'] as ApPaymentMethod[]).map((method) => (
                      <div key={method} className="flex items-center gap-1.5">
                        <RadioGroupItem value={method} id={`method-${method}`} />
                        <Label htmlFor={`method-${method}`} className="font-normal cursor-pointer text-sm">
                          {AP_PAYMENT_METHOD_LABELS[method]}
                        </Label>
                      </div>
                    ))}
                    {form.payment_method === 'others' && (
                      <Input
                        className="w-40"
                        value={form.payment_method_other}
                        onChange={(event) => setForm((prev) => ({ ...prev, payment_method_other: event.target.value }))}
                        placeholder="Specify..."
                      />
                    )}
                  </RadioGroup>
                </div>
              </div>

              {/* Recurring / Non-Recurring */}
              <div className="space-y-2">
                <Label>Recurring</Label>
                <RadioGroup
                  value={form.is_recurring ? 'recurring' : 'non_recurring'}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, is_recurring: value === 'recurring' }))}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="recurring" id="recurring" />
                    <Label htmlFor="recurring" className="font-normal cursor-pointer">Recurring</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="non_recurring" id="non_recurring" />
                    <Label htmlFor="non_recurring" className="font-normal cursor-pointer">Non-Recurring</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Optional supplier (for AP invoice allocation) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier <span className="text-muted-foreground text-xs">(optional, for invoice allocation)</span></Label>
                  <Select
                    value={form.supplier_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value, allocations: {} }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {filteredSuppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_code} - {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line Items Table (Date, Description, Cheque No., Amount) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Line
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[140px]">Cheque No.</TableHead>
                          <TableHead className="w-[150px] text-right">Amount (RM)</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.lines.map((line, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input
                                type="date"
                                value={line.line_date}
                                onChange={(e) => updateLine(index, 'line_date', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={line.description}
                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                placeholder="Description"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={line.cheque_no}
                                onChange={(e) => updateLine(index, 'cheque_no', e.target.value)}
                                placeholder="Cheque no."
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="text-right"
                                value={line.amount}
                                onChange={(e) => updateLine(index, 'amount', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              {form.lines.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(index)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-2 text-right text-sm font-medium">
                    Line Total: {formatMoney(linesTotal)}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Allocation (shown only when supplier is selected) */}
              {form.supplier_id && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Invoice Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!outstandingInvoices.length ? (
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
              )}

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks (Account Dept.)</Label>
                <Textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
                  placeholder="Optional notes"
                />
              </div>

              {/* PRF No & Attachments */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>PRF No.</Label>
                  <Select
                    value={form.prf_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, prf_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link to PRF (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {approvedPrfs.map((prf: any) => (
                        <SelectItem key={prf.id} value={prf.id}>
                          {prf.prf_number} - {prf.description || prf.requester?.full_name || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <FileUpload
                    bucket="pv-attachments"
                    onUploadComplete={(urls) => setForm((prev) => ({ ...prev, attachment_urls: urls }))}
                    onRemove={(idx) => setForm((prev) => ({
                      ...prev,
                      attachment_urls: prev.attachment_urls.filter((_, i) => i !== idx),
                    }))}
                    currentFiles={form.attachment_urls}
                    maxFiles={5}
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="text-right text-sm font-medium space-y-1">
                {totalAllocated > 0 && <div>Invoice Allocation: {formatMoney(totalAllocated)}</div>}
                {linesTotal > 0 && totalAllocated > 0 && <div>Line Items: {formatMoney(linesTotal)}</div>}
                <div className="text-base">Total: {formatMoney(linesTotal + totalAllocated)}</div>
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
                  <p><span className="text-muted-foreground">Ref No:</span> {detailVoucher.reference_no || '-'}</p>
                  <p><span className="text-muted-foreground">Pay To:</span> {detailVoucher.pay_to || detailVoucher.supplier?.supplier_name || '-'}</p>
                  <p><span className="text-muted-foreground">Pay For:</span> {detailVoucher.pay_for || '-'}</p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailVoucher.payment_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Method:</span> {detailVoucher.payment_method === 'others' ? (detailVoucher.payment_method_other || 'Others') : AP_PAYMENT_METHOD_LABELS[detailVoucher.payment_method]}</p>
                  <p><span className="text-muted-foreground">Recurring:</span> {detailVoucher.is_recurring ? 'Yes' : 'No'}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_PV_STATUS_LABELS[detailVoucher.status]}</p>
                  <p><span className="text-muted-foreground">Amount:</span> {formatMoney(detailVoucher.total_amount)}</p>
                  {detailVoucher.remarks && (
                    <p className="md:col-span-2"><span className="text-muted-foreground">Remarks:</span> {detailVoucher.remarks}</p>
                  )}
                </div>

                {/* Line Items */}
                {(detailVoucher.lines || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Line Items</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Cheque No.</TableHead>
                            <TableHead className="text-right">Amount (RM)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detailVoucher.lines || [])
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{format(new Date(line.line_date), 'dd-MM-yyyy')}</TableCell>
                                <TableCell>{line.description}</TableCell>
                                <TableCell>{line.cheque_no || '-'}</TableCell>
                                <TableCell className="text-right">{formatMoney(line.amount)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Invoice Allocations */}
                {(detailVoucher.allocations || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Invoice Allocations</h4>
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
