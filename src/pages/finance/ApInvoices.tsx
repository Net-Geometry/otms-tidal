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
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useSuppliers } from '@/hooks/finance/useFinanceFoundation';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useProjects } from '@/hooks/finance/useProjects';
import {
  useApInvoices,
  useApproveApInvoice,
  useCreateApInvoice,
  usePostApInvoice,
  useSubmitApInvoice,
  useUpdateApInvoice,
  usePurchaseRequisitions,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_INVOICE_STATUS_LABELS,
  AP_TAX_CODES,
  type ApInvoice,
  type ApInvoiceStatus,
  type ApTaxCode,
} from '@/types/finance';

interface InvoiceLineFormState {
  id: string;
  description: string;
  gl_account_id: string;
  quantity: string;
  unit_price: string;
  tax_code: ApTaxCode;
  tax_rate: string;
  project_id: string;
}

interface InvoiceFormState {
  company_id: string;
  supplier_id: string;
  supplier_invoice_no: string;
  prf_id: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  withholding_tax: string;
  remarks: string;
  lines: InvoiceLineFormState[];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeLine(): InvoiceLineFormState {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: '',
    gl_account_id: '',
    quantity: '1',
    unit_price: '0',
    tax_code: 'os',
    tax_rate: String(AP_TAX_CODES.os),
    project_id: '',
  };
}

function makeInitialForm(companyId: string): InvoiceFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: companyId,
    supplier_id: '',
    supplier_invoice_no: '',
    prf_id: '',
    invoice_date: today,
    due_date: '',
    currency: 'MYR',
    withholding_tax: '0',
    remarks: '',
    lines: [makeLine()],
  };
}

export default function ApInvoices() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
  const chart = useChartOfAccounts({ accountType: 'expense', activity: 'active', search: '' });
  const projects = useProjects();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApInvoiceStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ApInvoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ApInvoice | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(makeInitialForm(''));

  const invoices = useApInvoices({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    supplierId: supplierFilter === 'all' ? undefined : supplierFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search,
    page,
    pageSize: 12,
  });

  const prfs = usePurchaseRequisitions({
    companyId: form.company_id || undefined,
    status: 'approved',
    page: 1,
    pageSize: 200,
  });

  const createInvoice = useCreateApInvoice();
  const updateInvoice = useUpdateApInvoice();
  const submitInvoice = useSubmitApInvoice();
  const approveInvoice = useApproveApInvoice();
  const postInvoice = usePostApInvoice();

  const postingAccounts = useMemo(
    () => chart.accounts.filter((account) => account.is_active && account.is_postable),
    [chart.accounts],
  );

  const totals = useMemo(() => {
    const subtotal = form.lines.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0),
      0,
    );
    const taxTotal = form.lines.reduce((sum, line) => {
      const amount = Number(line.quantity || 0) * Number(line.unit_price || 0);
      return sum + (amount * Number(line.tax_rate || 0)) / 100;
    }, 0);
    const withholdingTax = Number(form.withholding_tax || 0);
    const grandTotal = subtotal + taxTotal - withholdingTax;

    return {
      subtotal,
      taxTotal,
      withholdingTax,
      grandTotal,
    };
  }, [form.lines, form.withholding_tax]);

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows = invoices.data?.rows || [];
  const totalPages = invoices.data?.totalPages || 0;

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;
    setEditingInvoice(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (invoice: ApInvoice) => {
    setEditingInvoice(invoice);
    setForm({
      company_id: invoice.company_id,
      supplier_id: invoice.supplier_id,
      supplier_invoice_no: invoice.supplier_invoice_no || '',
      prf_id: invoice.prf_id || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      currency: invoice.currency || 'MYR',
      withholding_tax: String(invoice.withholding_tax || 0),
      remarks: invoice.remarks || '',
      lines: (invoice.lines || []).map((line) => ({
        id: line.id,
        description: line.description,
        gl_account_id: line.gl_account_id,
        quantity: String(line.quantity || 0),
        unit_price: String(line.unit_price || 0),
        tax_code: line.tax_code,
        tax_rate: String(line.tax_rate || 0),
        project_id: line.project_id || '',
      })),
    });
    setDialogOpen(true);
  };

  const updateLine = (lineId: string, key: keyof InvoiceLineFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;

        if (key === 'tax_code') {
          const code = value as ApTaxCode;
          return {
            ...line,
            tax_code: code,
            tax_rate: String(AP_TAX_CODES[code]),
          };
        }

        return { ...line, [key]: value };
      }),
    }));
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, makeLine()] }));
  };

  const removeLine = (lineId: string) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((line) => line.id !== lineId),
      };
    });
  };

  const saveDraft = async () => {
    const preparedLines = form.lines
      .map((line) => ({
        description: line.description.trim(),
        gl_account_id: line.gl_account_id,
        quantity: Number(line.quantity || 0),
        unit_price: Number(line.unit_price || 0),
        tax_code: line.tax_code,
        tax_rate: Number(line.tax_rate || 0),
        project_id: line.project_id || null,
      }))
      .filter((line) => line.description && line.gl_account_id && line.quantity > 0);

    if (!form.company_id) {
      toast({ title: 'Company is required', variant: 'destructive' });
      return;
    }

    if (!form.supplier_id) {
      toast({ title: 'Supplier is required', variant: 'destructive' });
      return;
    }

    if (!form.invoice_date) {
      toast({ title: 'Invoice date is required', variant: 'destructive' });
      return;
    }

    if (!preparedLines.length) {
      toast({ title: 'Add at least one valid line item', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingInvoice?.id,
      company_id: form.company_id,
      supplier_id: form.supplier_id,
      supplier_invoice_no: form.supplier_invoice_no.trim() || null,
      prf_id: form.prf_id || null,
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      currency: form.currency.trim().toUpperCase() || 'MYR',
      withholding_tax: Number(form.withholding_tax || 0),
      remarks: form.remarks.trim() || null,
      lines: preparedLines,
    };

    if (editingInvoice) {
      await updateInvoice.updateApInvoice(payload);
    } else {
      await createInvoice.createApInvoice(payload);
    }

    setDialogOpen(false);
    setEditingInvoice(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AP Invoices"
        description="Capture supplier invoices, manage approvals, and post to the General Ledger."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-6">
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
                  setStatusFilter(value as 'all' | ApInvoiceStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AP_INVOICE_STATUS_LABELS) as ApInvoiceStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AP_INVOICE_STATUS_LABELS[status]}
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

              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />

              <Input
                placeholder="Search invoice no, supplier ref"
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
            <CardTitle className="text-base">Invoice Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !invoices.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No AP invoices found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number || 'Draft'}</TableCell>
                        <TableCell>{invoice.supplier?.supplier_name || '-'}</TableCell>
                        <TableCell>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(invoice.total_amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={['posted', 'partially_paid', 'paid'].includes(invoice.status) ? 'default' : 'secondary'}
                          >
                            {AP_INVOICE_STATUS_LABELS[invoice.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatMoney(invoice.paid_amount)} / {formatMoney(invoice.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {invoice.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(invoice)}>
                                Edit
                              </Button>
                            )}
                            {invoice.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitInvoice.submitApInvoice({ invoiceId: invoice.id })}
                                disabled={submitInvoice.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {invoice.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveInvoice.approveApInvoice({ invoiceId: invoice.id })}
                                disabled={approveInvoice.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {invoice.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postInvoice.postApInvoice({ invoiceId: invoice.id })}
                                disabled={postInvoice.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailInvoice(invoice)}>
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
            if (!open) setEditingInvoice(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingInvoice ? 'Edit AP Invoice' : 'New AP Invoice'}</DialogTitle>
              <DialogDescription>Capture invoice details, line taxes, and posting metadata.</DialogDescription>
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
                    onValueChange={(value) => setForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select supplier</SelectItem>
                      {suppliers.suppliers
                        .filter((supplier) => !form.company_id || supplier.company_id === form.company_id)
                        .map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.supplier_code} - {supplier.supplier_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Supplier Invoice Ref</Label>
                  <Input
                    value={form.supplier_invoice_no}
                    onChange={(event) => setForm((prev) => ({ ...prev, supplier_invoice_no: event.target.value }))}
                    placeholder="Vendor invoice reference"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={form.invoice_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, invoice_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    maxLength={3}
                    value={form.currency}
                    onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>PRF Link (optional)</Label>
                  <Select
                    value={form.prf_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, prf_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked PRF</SelectItem>
                      {(prfs.data?.rows || []).map((prf) => (
                        <SelectItem key={prf.id} value={prf.id}>
                          {prf.prf_number || prf.id} - {prf.purpose || 'No purpose'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="space-y-3">
                {form.lines.map((line, index) => {
                  const amount = Number(line.quantity || 0) * Number(line.unit_price || 0);
                  const taxAmount = (amount * Number(line.tax_rate || 0)) / 100;

                  return (
                    <Card key={line.id}>
                      <CardContent className="pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium">Line {index + 1}</p>
                          <Button variant="ghost" size="sm" onClick={() => removeLine(line.id)}>
                            Remove
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-12">
                          <div className="space-y-2 md:col-span-4">
                            <Label>Description</Label>
                            <Input value={line.description} onChange={(event) => updateLine(line.id, 'description', event.target.value)} />
                          </div>

                          <div className="space-y-2 md:col-span-4">
                            <Label>GL Account</Label>
                            <Select
                              value={line.gl_account_id || 'none'}
                              onValueChange={(value) => updateLine(line.id, 'gl_account_id', value === 'none' ? '' : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Select account</SelectItem>
                                {postingAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.account_code} - {account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Qty</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, 'quantity', event.target.value)}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_price}
                              onChange={(event) => updateLine(line.id, 'unit_price', event.target.value)}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Tax Code</Label>
                            <Select value={line.tax_code} onValueChange={(value) => updateLine(line.id, 'tax_code', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sr">SR</SelectItem>
                                <SelectItem value="zr">ZR</SelectItem>
                                <SelectItem value="es">ES</SelectItem>
                                <SelectItem value="os">OS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Tax Rate (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.tax_rate}
                              onChange={(event) => updateLine(line.id, 'tax_rate', event.target.value)}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-4">
                            <Label>Project</Label>
                            <Select
                              value={line.project_id || 'none'}
                              onValueChange={(value) => updateLine(line.id, 'project_id', value === 'none' ? '' : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Optional" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No project</SelectItem>
                                {projects.projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.project_code} - {project.project_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Amount</Label>
                            <Input value={formatMoney(amount)} readOnly />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Tax Amount</Label>
                            <Input value={formatMoney(taxAmount)} readOnly />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Button variant="outline" onClick={addLine}>Add Line</Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <Label>Subtotal</Label>
                      <Input value={formatMoney(totals.subtotal)} readOnly />
                    </div>
                    <div>
                      <Label>Tax Total</Label>
                      <Input value={formatMoney(totals.taxTotal)} readOnly />
                    </div>
                    <div>
                      <Label>Withholding Tax</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.withholding_tax}
                        onChange={(event) => setForm((prev) => ({ ...prev, withholding_tax: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Grand Total</Label>
                      <Input value={formatMoney(totals.grandTotal)} readOnly />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveDraft} disabled={createInvoice.isCreating || updateInvoice.isSaving}>
                {createInvoice.isCreating || updateInvoice.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detailInvoice} onOpenChange={(open) => !open && setDetailInvoice(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>AP Invoice Detail</DialogTitle>
              <DialogDescription>Review supplier invoice header, lines, and payment progress.</DialogDescription>
            </DialogHeader>

            {!detailInvoice ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">Invoice No:</span> {detailInvoice.invoice_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Supplier:</span> {detailInvoice.supplier?.supplier_name || '-'}</p>
                  <p><span className="text-muted-foreground">Invoice Date:</span> {format(new Date(detailInvoice.invoice_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Due Date:</span> {detailInvoice.due_date ? format(new Date(detailInvoice.due_date), 'dd MMM yyyy') : '-'}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_INVOICE_STATUS_LABELS[detailInvoice.status]}</p>
                  <p><span className="text-muted-foreground">Paid:</span> {formatMoney(detailInvoice.paid_amount)}</p>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>GL Account</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailInvoice.lines || []).map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell>{line.gl_account?.account_code} - {line.gl_account?.account_name}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(line.unit_price)}</TableCell>
                          <TableCell>{line.tax_code.toUpperCase()} ({line.tax_rate}%)</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(line.amount + line.tax_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <p>Subtotal: <span className="font-medium">{formatMoney(detailInvoice.subtotal)}</span></p>
                  <p>Tax Total: <span className="font-medium">{formatMoney(detailInvoice.tax_total)}</span></p>
                  <p>Withholding: <span className="font-medium">{formatMoney(detailInvoice.withholding_tax)}</span></p>
                  <p>Total: <span className="font-medium">{formatMoney(detailInvoice.total_amount)}</span></p>
                  <p>Paid Amount: <span className="font-medium">{formatMoney(detailInvoice.paid_amount)}</span></p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
