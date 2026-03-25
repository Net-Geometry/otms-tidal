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
import { useCustomers } from '@/hooks/finance/useFinanceFoundation';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useProjects } from '@/hooks/finance/useProjects';
import {
  useApproveArInvoice,
  useArInvoices,
  useCreateArInvoice,
  usePostArInvoice,
  useSubmitArInvoice,
  useUpdateArInvoice,
} from '@/hooks/finance/useAccountsReceivable';
import {
  AR_INVOICE_STATUS_LABELS,
  AR_TAX_CODES,
  type ArInvoice,
  type ArInvoiceStatus,
  type ArTaxCode,
} from '@/types/finance';

interface InvoiceLineFormState {
  id: string;
  description: string;
  gl_account_id: string;
  quantity: string;
  unit_price: string;
  tax_code: ArTaxCode;
  tax_rate: string;
  project_id: string;
}

interface InvoiceFormState {
  company_id: string;
  customer_id: string;
  sales_order_ref: string;
  invoice_date: string;
  due_date: string;
  currency: string;
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
    tax_rate: String(AR_TAX_CODES.os),
    project_id: '',
  };
}

function makeInitialForm(companyId: string): InvoiceFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: companyId,
    customer_id: '',
    sales_order_ref: '',
    invoice_date: today,
    due_date: today,
    currency: 'MYR',
    remarks: '',
    lines: [makeLine()],
  };
}

export default function ArInvoices() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const customers = useCustomers();
  const chart = useChartOfAccounts({ accountType: 'revenue', activity: 'active', search: '' });
  const projects = useProjects();

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c: any) => map.set(c.id, c.code || c.name));
    return map;
  }, [companies]);

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ArInvoiceStatus>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ArInvoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<ArInvoice | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(makeInitialForm(''));

  const invoices = useArInvoices({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    customerId: customerFilter === 'all' ? undefined : customerFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search,
    page,
    pageSize: 12,
  });

  const createInvoice = useCreateArInvoice();
  const updateInvoice = useUpdateArInvoice();
  const submitInvoice = useSubmitArInvoice();
  const approveInvoice = useApproveArInvoice();
  const postInvoice = usePostArInvoice();

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
    const grandTotal = subtotal + taxTotal;

    return {
      subtotal,
      taxTotal,
      grandTotal,
    };
  }, [form.lines]);

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

  const openEditDialog = (invoice: ArInvoice) => {
    setEditingInvoice(invoice);
    setForm({
      company_id: invoice.company_id,
      customer_id: invoice.customer_id,
      sales_order_ref: invoice.sales_order_ref || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      currency: invoice.currency || 'MYR',
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
          const code = value as ArTaxCode;
          return {
            ...line,
            tax_code: code,
            tax_rate: String(AR_TAX_CODES[code]),
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

    if (!form.customer_id) {
      toast({ title: 'Customer is required', variant: 'destructive' });
      return;
    }

    if (!form.invoice_date || !form.due_date) {
      toast({ title: 'Invoice and due date are required', variant: 'destructive' });
      return;
    }

    if (!preparedLines.length) {
      toast({ title: 'Add at least one valid line item', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingInvoice?.id,
      company_id: form.company_id,
      customer_id: form.customer_id,
      sales_order_ref: form.sales_order_ref.trim() || null,
      invoice_date: form.invoice_date,
      due_date: form.due_date,
      currency: form.currency.trim().toUpperCase() || 'MYR',
      remarks: form.remarks.trim() || null,
      lines: preparedLines,
    };

    if (editingInvoice) {
      await updateInvoice.updateArInvoice(payload);
    } else {
      await createInvoice.createArInvoice(payload);
    }

    setDialogOpen(false);
    setEditingInvoice(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AR Invoices"
        description="Capture customer invoices, manage approvals, and post receivables to the General Ledger."
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
                  setStatusFilter(value as 'all' | ArInvoiceStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AR_INVOICE_STATUS_LABELS) as ArInvoiceStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AR_INVOICE_STATUS_LABELS[status]}
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

              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />

              <Input
                placeholder="Search invoice no or sales order"
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
              <div className="py-10 text-center text-sm text-muted-foreground">No AR invoices found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      {companyFilter === 'all' && <TableHead>Company</TableHead>}
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Collection</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number || 'Draft'}</TableCell>
                        {companyFilter === 'all' && (
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{companyMap.get(invoice.company_id) || '-'}</span>
                          </TableCell>
                        )}
                        <TableCell>{invoice.customer?.customer_name || '-'}</TableCell>
                        <TableCell>{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{format(new Date(invoice.due_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right">{formatMoney(invoice.total_amount)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={['posted', 'partially_paid', 'paid'].includes(invoice.status) ? 'default' : 'secondary'}
                          >
                            {AR_INVOICE_STATUS_LABELS[invoice.status]}
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
                                onClick={() => submitInvoice.submitArInvoice({ invoiceId: invoice.id })}
                                disabled={submitInvoice.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {invoice.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveInvoice.approveArInvoice({ invoiceId: invoice.id })}
                                disabled={approveInvoice.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {invoice.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postInvoice.postArInvoice({ invoiceId: invoice.id })}
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
              <DialogTitle>{editingInvoice ? 'Edit AR Invoice' : 'New AR Invoice'}</DialogTitle>
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
                  <Label>Customer</Label>
                  <Select
                    value={form.customer_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select customer</SelectItem>
                      {customers.customers
                        .filter((customer) => !form.company_id || customer.company_id === form.company_id)
                        .map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.customer_code} - {customer.customer_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sales Order Ref</Label>
                  <Input
                    value={form.sales_order_ref}
                    onChange={(event) => setForm((prev) => ({ ...prev, sales_order_ref: event.target.value }))}
                    placeholder="Customer PO / SO reference"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={form.invoice_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, invoice_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
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
                            <Label>Revenue GL Account</Label>
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
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Subtotal</Label>
                      <Input value={formatMoney(totals.subtotal)} readOnly />
                    </div>
                    <div>
                      <Label>Tax Total</Label>
                      <Input value={formatMoney(totals.taxTotal)} readOnly />
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
              <DialogTitle>AR Invoice Detail</DialogTitle>
              <DialogDescription>Review customer invoice header, lines, and collection progress.</DialogDescription>
            </DialogHeader>

            {!detailInvoice ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">Invoice No:</span> {detailInvoice.invoice_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Customer:</span> {detailInvoice.customer?.customer_name || '-'}</p>
                  <p><span className="text-muted-foreground">Invoice Date:</span> {format(new Date(detailInvoice.invoice_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Due Date:</span> {format(new Date(detailInvoice.due_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Sales Order Ref:</span> {detailInvoice.sales_order_ref || '-'}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AR_INVOICE_STATUS_LABELS[detailInvoice.status]}</p>
                  <p><span className="text-muted-foreground">Collected:</span> {formatMoney(detailInvoice.paid_amount)}</p>
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
                  <p>Total: <span className="font-medium">{formatMoney(detailInvoice.total_amount)}</span></p>
                  <p>Collected: <span className="font-medium">{formatMoney(detailInvoice.paid_amount)}</span></p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
