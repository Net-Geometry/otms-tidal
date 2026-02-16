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
import { useArInvoices } from '@/hooks/finance/useAccountsReceivable';
import {
  useArDcnList,
  useApproveArDcn,
  useCreateArDcn,
  usePostArDcn,
  useSubmitArDcn,
  useUpdateArDcn,
} from '@/hooks/finance/useArDebitCreditNotes';
import {
  AR_DCN_STATUS_LABELS,
  AR_DCN_TYPE_LABELS,
  AR_TAX_CODES,
  type ArDcnStatus,
  type ArDcnType,
  type ArDebitCreditNote,
  type ArTaxCode,
} from '@/types/finance';

interface DcnLineFormState {
  id: string;
  description: string;
  gl_account_id: string;
  quantity: string;
  unit_price: string;
  tax_code: string;
  tax_rate: string;
  project_id: string;
}

interface DcnFormState {
  company_id: string;
  note_type: ArDcnType;
  customer_id: string;
  ar_invoice_id: string;
  note_date: string;
  currency: string;
  exchange_rate: string;
  reason: string;
  lines: DcnLineFormState[];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeLine(): DcnLineFormState {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: '',
    gl_account_id: '',
    quantity: '1',
    unit_price: '0',
    tax_code: 'zr',
    tax_rate: '0',
    project_id: '',
  };
}

function makeInitialForm(companyId: string): DcnFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    company_id: companyId,
    note_type: 'debit_note',
    customer_id: '',
    ar_invoice_id: '',
    note_date: today,
    currency: 'MYR',
    exchange_rate: '1',
    reason: '',
    lines: [makeLine()],
  };
}

function statusBadgeVariant(status: ArDcnStatus) {
  switch (status) {
    case 'draft': return 'secondary' as const;
    case 'pending': return 'outline' as const;
    case 'approved': return 'default' as const;
    case 'posted': return 'default' as const;
    case 'rejected': return 'destructive' as const;
    case 'cancelled': return 'secondary' as const;
    default: return 'secondary' as const;
  }
}

export default function ArDebitCreditNotes() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const customers = useCustomers();
  const chart = useChartOfAccounts({ accountType: 'revenue', activity: 'active', search: '' });
  const projects = useProjects();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ArDcnStatus>('all');
  const [noteTypeFilter, setNoteTypeFilter] = useState<'all' | ArDcnType>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDcn, setEditingDcn] = useState<ArDebitCreditNote | null>(null);
  const [detailDcn, setDetailDcn] = useState<ArDebitCreditNote | null>(null);
  const [form, setForm] = useState<DcnFormState>(makeInitialForm(''));

  const dcnList = useArDcnList({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    noteType: noteTypeFilter,
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

  const createDcn = useCreateArDcn();
  const updateDcn = useUpdateArDcn();
  const submitDcn = useSubmitArDcn();
  const approveDcn = useApproveArDcn();
  const postDcn = usePostArDcn();

  const postingAccounts = useMemo(
    () => chart.accounts.filter((account) => account.is_active && account.is_postable),
    [chart.accounts],
  );

  const availableInvoices = useMemo(() => {
    return (customerInvoices.data?.rows || [])
      .filter((invoice) => ['posted', 'partially_paid'].includes(invoice.status));
  }, [customerInvoices.data]);

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

    return { subtotal, taxTotal, grandTotal };
  }, [form.lines]);

  useEffect(() => {
    if (!companies.length) return;
    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows = dcnList.data?.rows || [];
  const totalPages = dcnList.data?.totalPages || 0;

  const filteredCustomers = useMemo(() => {
    if (!form.company_id) return customers.customers;
    return customers.customers.filter((customer) => customer.company_id === form.company_id);
  }, [customers.customers, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;
    setEditingDcn(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (dcn: ArDebitCreditNote) => {
    setEditingDcn(dcn);
    setForm({
      company_id: dcn.company_id,
      note_type: dcn.note_type,
      customer_id: dcn.customer_id,
      ar_invoice_id: dcn.ar_invoice_id || '',
      note_date: dcn.note_date,
      currency: dcn.currency || 'MYR',
      exchange_rate: String(dcn.exchange_rate || 1),
      reason: dcn.reason || '',
      lines: (dcn.lines || []).map((line) => ({
        id: line.id,
        description: line.description,
        gl_account_id: line.gl_account_id,
        quantity: String(line.quantity || 0),
        unit_price: String(line.unit_price || 0),
        tax_code: line.tax_code || 'zr',
        tax_rate: String(line.tax_rate || 0),
        project_id: line.project_id || '',
      })),
    });
    setDialogOpen(true);
  };

  const updateLine = (lineId: string, key: keyof DcnLineFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;

        if (key === 'tax_code') {
          const code = value as ArTaxCode;
          const rate = AR_TAX_CODES[code] ?? 0;
          return {
            ...line,
            tax_code: value,
            tax_rate: String(rate),
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

    if (!form.note_date) {
      toast({ title: 'Note date is required', variant: 'destructive' });
      return;
    }

    if (!preparedLines.length) {
      toast({ title: 'Add at least one valid line item', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingDcn?.id,
      company_id: form.company_id,
      note_type: form.note_type,
      customer_id: form.customer_id,
      ar_invoice_id: form.ar_invoice_id || null,
      note_date: form.note_date,
      currency: form.currency.trim().toUpperCase() || 'MYR',
      exchange_rate: Number(form.exchange_rate || 1),
      reason: form.reason.trim() || null,
      lines: preparedLines,
    };

    if (editingDcn) {
      await updateDcn.updateArDcn(payload);
    } else {
      await createDcn.createArDcn(payload);
    }

    setDialogOpen(false);
    setEditingDcn(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AR Debit/Credit Notes"
        description="Issue debit and credit notes to adjust customer balances and post to GL."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Note
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-5">
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
                  setStatusFilter(value as 'all' | ArDcnStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AR_DCN_STATUS_LABELS) as ArDcnStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AR_DCN_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={noteTypeFilter}
                onValueChange={(value) => {
                  setNoteTypeFilter(value as 'all' | ArDcnType);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Note Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {(Object.keys(AR_DCN_TYPE_LABELS) as ArDcnType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {AR_DCN_TYPE_LABELS[type]}
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
                placeholder="Search note no or reason"
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
            <CardTitle className="text-base">AR Debit/Credit Notes Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !dcnList.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No AR debit/credit notes found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((dcn) => (
                      <TableRow key={dcn.id}>
                        <TableCell className="font-medium">{dcn.note_number || 'Draft'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {AR_DCN_TYPE_LABELS[dcn.note_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{dcn.customer?.customer_name || '-'}</TableCell>
                        <TableCell>{dcn.ar_invoice?.invoice_number || '-'}</TableCell>
                        <TableCell>{format(new Date(dcn.note_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right">{formatMoney(dcn.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(dcn.status)}>
                            {AR_DCN_STATUS_LABELS[dcn.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {dcn.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(dcn)}>
                                Edit
                              </Button>
                            )}
                            {dcn.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitDcn.submitArDcn({ dcnId: dcn.id })}
                                disabled={submitDcn.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {dcn.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveDcn.approveArDcn({ dcnId: dcn.id })}
                                disabled={approveDcn.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {dcn.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postDcn.postArDcn({ dcnId: dcn.id })}
                                disabled={postDcn.isPosting}
                              >
                                Post to GL
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailDcn(dcn)}>
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

        {/* Create/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingDcn(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editingDcn ? 'Edit AR Debit/Credit Note' : 'New AR Debit/Credit Note'}</DialogTitle>
              <DialogDescription>Capture note details and line items for customer adjustments.</DialogDescription>
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
                  <Label>Note Type</Label>
                  <Select
                    value={form.note_type}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, note_type: value as ArDcnType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AR_DCN_TYPE_LABELS) as ArDcnType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {AR_DCN_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={form.customer_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value === 'none' ? '' : value, ar_invoice_id: '' }))}
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
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>AR Invoice (optional)</Label>
                  <Select
                    value={form.ar_invoice_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, ar_invoice_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked invoice</SelectItem>
                      {availableInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number || invoice.id} - {formatMoney(invoice.total_amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note Date</Label>
                  <Input
                    type="date"
                    value={form.note_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, note_date: event.target.value }))}
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
                  <Label>Exchange Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={form.exchange_rate}
                    onChange={(event) => setForm((prev) => ({ ...prev, exchange_rate: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  rows={2}
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Reason for this debit/credit note"
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
              <Button type="button" onClick={saveDraft} disabled={createDcn.isCreating || updateDcn.isSaving}>
                {createDcn.isCreating || updateDcn.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailDcn} onOpenChange={(open) => !open && setDetailDcn(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>AR Debit/Credit Note Detail</DialogTitle>
              <DialogDescription>Review note details and line items.</DialogDescription>
            </DialogHeader>

            {!detailDcn ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">Note No:</span> {detailDcn.note_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Type:</span> {AR_DCN_TYPE_LABELS[detailDcn.note_type]}</p>
                  <p><span className="text-muted-foreground">Customer:</span> {detailDcn.customer?.customer_name || '-'}</p>
                  <p><span className="text-muted-foreground">Invoice Ref:</span> {detailDcn.ar_invoice?.invoice_number || '-'}</p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailDcn.note_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AR_DCN_STATUS_LABELS[detailDcn.status]}</p>
                  <p><span className="text-muted-foreground">Currency:</span> {detailDcn.currency}</p>
                  <p><span className="text-muted-foreground">Amount:</span> {formatMoney(detailDcn.total_amount)}</p>
                  {detailDcn.reason && (
                    <p className="md:col-span-2"><span className="text-muted-foreground">Reason:</span> {detailDcn.reason}</p>
                  )}
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
                      {(detailDcn.lines || []).map((line) => (
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
                  <p>Subtotal: <span className="font-medium">{formatMoney(detailDcn.subtotal)}</span></p>
                  <p>Tax Total: <span className="font-medium">{formatMoney(detailDcn.tax_total)}</span></p>
                  <p>Total: <span className="font-medium">{formatMoney(detailDcn.total_amount)}</span></p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
