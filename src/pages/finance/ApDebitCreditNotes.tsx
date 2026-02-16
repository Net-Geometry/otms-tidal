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
import { useApInvoices } from '@/hooks/finance/useAccountsPayable';
import {
  useApDcnList,
  useApproveApDcn,
  useCreateApDcn,
  usePostApDcn,
  useSubmitApDcn,
  useUpdateApDcn,
} from '@/hooks/finance/useApDebitCreditNotes';
import {
  AP_DCN_STATUS_LABELS,
  AP_DCN_TYPE_LABELS,
  AP_TAX_CODES,
  type ApDcnStatus,
  type ApDcnType,
  type ApDebitCreditNote,
  type ApTaxCode,
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
  note_type: ApDcnType;
  supplier_id: string;
  ap_invoice_id: string;
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
    supplier_id: '',
    ap_invoice_id: '',
    note_date: today,
    currency: 'MYR',
    exchange_rate: '1',
    reason: '',
    lines: [makeLine()],
  };
}

function statusBadgeVariant(status: ApDcnStatus) {
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

export default function ApDebitCreditNotes() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
  const chart = useChartOfAccounts({ accountType: 'expense', activity: 'active', search: '' });
  const projects = useProjects();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApDcnStatus>('all');
  const [noteTypeFilter, setNoteTypeFilter] = useState<'all' | ApDcnType>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDcn, setEditingDcn] = useState<ApDebitCreditNote | null>(null);
  const [detailDcn, setDetailDcn] = useState<ApDebitCreditNote | null>(null);
  const [form, setForm] = useState<DcnFormState>(makeInitialForm(''));

  const dcnList = useApDcnList({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    noteType: noteTypeFilter,
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

  const createDcn = useCreateApDcn();
  const updateDcn = useUpdateApDcn();
  const submitDcn = useSubmitApDcn();
  const approveDcn = useApproveApDcn();
  const postDcn = usePostApDcn();

  const postingAccounts = useMemo(
    () => chart.accounts.filter((account) => account.is_active && account.is_postable),
    [chart.accounts],
  );

  const availableInvoices = useMemo(() => {
    return (supplierInvoices.data?.rows || [])
      .filter((invoice) => ['posted', 'partially_paid'].includes(invoice.status));
  }, [supplierInvoices.data]);

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

  const filteredSuppliers = useMemo(() => {
    if (!form.company_id) return suppliers.suppliers;
    return suppliers.suppliers.filter((supplier) => supplier.company_id === form.company_id);
  }, [suppliers.suppliers, form.company_id]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;
    setEditingDcn(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (dcn: ApDebitCreditNote) => {
    setEditingDcn(dcn);
    setForm({
      company_id: dcn.company_id,
      note_type: dcn.note_type,
      supplier_id: dcn.supplier_id,
      ap_invoice_id: dcn.ap_invoice_id || '',
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
          const code = value as ApTaxCode;
          const rate = AP_TAX_CODES[code] ?? 0;
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

    if (!form.supplier_id) {
      toast({ title: 'Supplier is required', variant: 'destructive' });
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
      supplier_id: form.supplier_id,
      ap_invoice_id: form.ap_invoice_id || null,
      note_date: form.note_date,
      currency: form.currency.trim().toUpperCase() || 'MYR',
      exchange_rate: Number(form.exchange_rate || 1),
      reason: form.reason.trim() || null,
      lines: preparedLines,
    };

    if (editingDcn) {
      await updateDcn.updateApDcn(payload);
    } else {
      await createDcn.createApDcn(payload);
    }

    setDialogOpen(false);
    setEditingDcn(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="AP Debit/Credit Notes"
        description="Issue debit and credit notes to adjust supplier balances and post to GL."
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
                  setStatusFilter(value as 'all' | ApDcnStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AP_DCN_STATUS_LABELS) as ApDcnStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AP_DCN_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={noteTypeFilter}
                onValueChange={(value) => {
                  setNoteTypeFilter(value as 'all' | ApDcnType);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Note Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {(Object.keys(AP_DCN_TYPE_LABELS) as ApDcnType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {AP_DCN_TYPE_LABELS[type]}
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
            <CardTitle className="text-base">AP Debit/Credit Notes Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !dcnList.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No AP debit/credit notes found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Supplier</TableHead>
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
                            {AP_DCN_TYPE_LABELS[dcn.note_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{dcn.supplier?.supplier_name || '-'}</TableCell>
                        <TableCell>{dcn.ap_invoice?.invoice_number || '-'}</TableCell>
                        <TableCell>{format(new Date(dcn.note_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right">{formatMoney(dcn.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(dcn.status)}>
                            {AP_DCN_STATUS_LABELS[dcn.status]}
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
                                onClick={() => submitDcn.submitApDcn({ dcnId: dcn.id })}
                                disabled={submitDcn.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {dcn.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveDcn.approveApDcn({ dcnId: dcn.id })}
                                disabled={approveDcn.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {dcn.status === 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => postDcn.postApDcn({ dcnId: dcn.id })}
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
              <DialogTitle>{editingDcn ? 'Edit AP Debit/Credit Note' : 'New AP Debit/Credit Note'}</DialogTitle>
              <DialogDescription>Capture note details and line items for supplier adjustments.</DialogDescription>
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
                    onValueChange={(value) => setForm((prev) => ({ ...prev, note_type: value as ApDcnType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AP_DCN_TYPE_LABELS) as ApDcnType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {AP_DCN_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={form.supplier_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value, ap_invoice_id: '' }))}
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
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>AP Invoice (optional)</Label>
                  <Select
                    value={form.ap_invoice_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, ap_invoice_id: value === 'none' ? '' : value }))}
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
              <DialogTitle>AP Debit/Credit Note Detail</DialogTitle>
              <DialogDescription>Review note details and line items.</DialogDescription>
            </DialogHeader>

            {!detailDcn ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">Note No:</span> {detailDcn.note_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Type:</span> {AP_DCN_TYPE_LABELS[detailDcn.note_type]}</p>
                  <p><span className="text-muted-foreground">Supplier:</span> {detailDcn.supplier?.supplier_name || '-'}</p>
                  <p><span className="text-muted-foreground">Invoice Ref:</span> {detailDcn.ap_invoice?.invoice_number || '-'}</p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(detailDcn.note_date), 'dd MMM yyyy')}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_DCN_STATUS_LABELS[detailDcn.status]}</p>
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
