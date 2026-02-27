import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, PlusCircle, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Separator } from '@/components/ui/separator';
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
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { useProjects } from '@/hooks/finance/useProjects';
import {
  useApprovePRF,
  useCancelPRF,
  useCreatePRF,
  usePurchaseRequisitions,
  useSubmitPRF,
  useUpdatePRF,
} from '@/hooks/finance/useAccountsPayable';
import {
  AP_PRF_STATUS_LABELS,
  PRF_TYPE_LABELS,
  type ApPrfStatus,
  type PrfType,
  type PurchaseRequisition,
} from '@/types/finance';

interface PrfItemFormState {
  id: string;
  doc_date: string;
  description: string;
  gl_account_id: string;
  project_site: string;
  amount: string;
}

interface PrfFormState {
  company_id: string;
  prf_type: PrfType;
  prf_type_others: string;
  payable_to: string;
  payment_via: string;
  prf_date: string;
  items: PrfItemFormState[];
  advance_date_received: string;
  advance_form_no: string;
  advance_amount: string;
  refund_reimburse_amount: string;
  management_remarks: string;
  chk_invoice: boolean;
  chk_purchase_order: boolean;
  chk_delivery_order: boolean;
  chk_purchase_req_form: boolean;
  chk_quotation: boolean;
  chk_work_order: boolean;
  chk_letter: boolean;
  chk_memo: boolean;
  chk_others: boolean;
  chk_others_text: string;
  accounts_dept_remarks: string;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function makeItemRow(): PrfItemFormState {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    doc_date: '',
    description: '',
    gl_account_id: '',
    project_site: '',
    amount: '0',
  };
}

function makeInitialForm(companyId: string): PrfFormState {
  return {
    company_id: companyId,
    prf_type: 'payment_request',
    prf_type_others: '',
    payable_to: '',
    payment_via: '',
    prf_date: new Date().toISOString().slice(0, 10),
    items: [makeItemRow()],
    advance_date_received: '',
    advance_form_no: '',
    advance_amount: '0',
    refund_reimburse_amount: '0',
    management_remarks: '',
    chk_invoice: false,
    chk_purchase_order: false,
    chk_delivery_order: false,
    chk_purchase_req_form: false,
    chk_quotation: false,
    chk_work_order: false,
    chk_letter: false,
    chk_memo: false,
    chk_others: false,
    chk_others_text: '',
    accounts_dept_remarks: '',
  };
}

export default function PurchaseRequisitions() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const chart = useChartOfAccounts({ accountType: 'expense', activity: 'active', search: '' });
  const projects = useProjects();

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApPrfStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrf, setEditingPrf] = useState<PurchaseRequisition | null>(null);
  const [detailPrf, setDetailPrf] = useState<PurchaseRequisition | null>(null);
  const [form, setForm] = useState<PrfFormState>(makeInitialForm(''));

  const prfs = usePurchaseRequisitions({
    companyId: companyFilter === 'all' ? undefined : companyFilter,
    status: statusFilter,
    search,
    page,
    pageSize: 12,
  });

  const createPRF = useCreatePRF();
  const updatePRF = useUpdatePRF();
  const submitPRF = useSubmitPRF();
  const approvePRF = useApprovePRF();
  const cancelPRF = useCancelPRF();

  const postingAccounts = useMemo(
    () => chart.accounts.filter((account) => account.is_active && account.is_postable),
    [chart.accounts],
  );

  const totals = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [form.items],
  );

  useEffect(() => {
    if (!companies.length) return;

    if (!form.company_id) {
      setForm((prev) => ({ ...prev, company_id: companies[0].id }));
    }
  }, [companies, form.company_id]);

  const rows = prfs.data?.rows || [];
  const totalPages = prfs.data?.totalPages || 0;

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all'
      ? companies[0]?.id || ''
      : companyFilter;

    setEditingPrf(null);
    setForm(makeInitialForm(defaultCompanyId));
    setDialogOpen(true);
  };

  const openEditDialog = (prf: PurchaseRequisition) => {
    setEditingPrf(prf);
    setForm({
      company_id: prf.company_id,
      prf_type: prf.prf_type || 'payment_request',
      prf_type_others: prf.prf_type_others || '',
      payable_to: prf.payable_to || '',
      payment_via: prf.payment_via || '',
      prf_date: prf.prf_date || '',
      items: (prf.items || []).map((item) => ({
        id: item.id,
        doc_date: item.doc_date || '',
        description: item.description,
        gl_account_id: item.gl_account_id,
        project_site: item.project_site || '',
        amount: String(item.amount || 0),
      })),
      advance_date_received: prf.advance_date_received || '',
      advance_form_no: prf.advance_form_no || '',
      advance_amount: String(prf.advance_amount || 0),
      refund_reimburse_amount: String(prf.refund_reimburse_amount || 0),
      management_remarks: prf.management_remarks || '',
      chk_invoice: prf.chk_invoice ?? false,
      chk_purchase_order: prf.chk_purchase_order ?? false,
      chk_delivery_order: prf.chk_delivery_order ?? false,
      chk_purchase_req_form: prf.chk_purchase_req_form ?? false,
      chk_quotation: prf.chk_quotation ?? false,
      chk_work_order: prf.chk_work_order ?? false,
      chk_letter: prf.chk_letter ?? false,
      chk_memo: prf.chk_memo ?? false,
      chk_others: prf.chk_others ?? false,
      chk_others_text: prf.chk_others_text || '',
      accounts_dept_remarks: prf.accounts_dept_remarks || '',
    });
    setDialogOpen(true);
  };

  const updateItem = (itemId: string, key: keyof PrfItemFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, makeItemRow()] }));
  };

  const removeItem = (itemId: string) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
    });
  };

  const saveDraft = async () => {
    const preparedItems = form.items
      .map((item) => ({
        doc_date: item.doc_date || null,
        description: item.description.trim(),
        gl_account_id: item.gl_account_id,
        quantity: 1,
        unit: 'unit' as const,
        unit_price: Number(item.amount || 0),
        project_id: null as string | null,
        project_site: item.project_site.trim() || null,
      }))
      .filter((item) => item.description && item.gl_account_id && item.unit_price > 0);

    if (!form.company_id) {
      toast({ title: 'Company is required', variant: 'destructive' });
      return;
    }

    if (!preparedItems.length) {
      toast({ title: 'Add at least one valid item with description, account, and amount', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingPrf?.id,
      company_id: form.company_id,
      prf_type: form.prf_type,
      prf_type_others: form.prf_type === 'others' ? form.prf_type_others.trim() || null : null,
      payable_to: form.payable_to.trim() || null,
      payment_via: form.payment_via.trim() || null,
      prf_date: form.prf_date || null,
      advance_date_received: form.advance_date_received || null,
      advance_form_no: form.advance_form_no.trim() || null,
      advance_amount: Number(form.advance_amount || 0),
      refund_reimburse_amount: Number(form.refund_reimburse_amount || 0),
      management_remarks: form.management_remarks.trim() || null,
      chk_invoice: form.chk_invoice,
      chk_purchase_order: form.chk_purchase_order,
      chk_delivery_order: form.chk_delivery_order,
      chk_purchase_req_form: form.chk_purchase_req_form,
      chk_quotation: form.chk_quotation,
      chk_work_order: form.chk_work_order,
      chk_letter: form.chk_letter,
      chk_memo: form.chk_memo,
      chk_others: form.chk_others,
      chk_others_text: form.chk_others ? form.chk_others_text.trim() || null : null,
      accounts_dept_remarks: form.accounts_dept_remarks.trim() || null,
      items: preparedItems,
    };

    if (editingPrf) {
      await updatePRF.updatePRF(payload);
    } else {
      await createPRF.createPRF(payload);
    }

    setDialogOpen(false);
    setEditingPrf(null);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Payment Requisitions"
        description="Raise, review, and approve Payment Requisition Forms (PRF)."
        actions={
          <Button onClick={openNewDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New PRF
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
                  setStatusFilter(value as 'all' | ApPrfStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(AP_PRF_STATUS_LABELS) as ApPrfStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {AP_PRF_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                className="md:col-span-2"
                placeholder="Search PRF number, payable to, remarks"
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
            <CardTitle className="text-base">PRF Register</CardTitle>
          </CardHeader>
          <CardContent>
            {!rows.length && !prfs.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No payment requisitions found.</div>
            ) : (
              <div className="rounded-md border">
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
                      <TableRow key={prf.id}>
                        <TableCell className="font-medium">{prf.prf_number || 'Draft'}</TableCell>
                        <TableCell>{prf.prf_date ? format(new Date(prf.prf_date), 'dd MMM yyyy') : prf.created_at ? format(new Date(prf.created_at), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell>{PRF_TYPE_LABELS[prf.prf_type] || 'Payment Request'}</TableCell>
                        <TableCell>{prf.payable_to || '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(prf.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={prf.status === 'approved' ? 'default' : 'secondary'}>
                            {AP_PRF_STATUS_LABELS[prf.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {prf.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(prf)}>
                                Edit
                              </Button>
                            )}
                            {prf.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => submitPRF.submitPRF({ prfId: prf.id })}
                                disabled={submitPRF.isSubmitting}
                              >
                                Submit
                              </Button>
                            )}
                            {prf.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approvePRF.approvePRF({ prfId: prf.id })}
                                disabled={approvePRF.isApproving}
                              >
                                Approve
                              </Button>
                            )}
                            {(prf.status === 'draft' || prf.status === 'pending') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelPRF.cancelPRF({ prfId: prf.id })}
                                disabled={cancelPRF.isCancelling}
                              >
                                Cancel
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDetailPrf(prf)}>
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

        {/* ── Create/Edit Dialog ── */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingPrf(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{editingPrf ? 'Edit PRF' : 'New Payment Requisition'}</DialogTitle>
              <DialogDescription>Payment Requisition Form</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Header: Company, PRF No, Date */}
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
                  <Label>PRF No</Label>
                  <Input
                    value={editingPrf?.prf_number || 'Auto-generated on submit'}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.prf_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, prf_date: event.target.value }))}
                  />
                </div>
              </div>

              {/* Type: Payment Request / Claim / Others */}
              <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup
                  value={form.prf_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, prf_type: value as PrfType }))}
                  className="flex flex-wrap items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="payment_request" id="type_payment" />
                    <Label htmlFor="type_payment" className="cursor-pointer font-normal">Payment Request</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="claim" id="type_claim" />
                    <Label htmlFor="type_claim" className="cursor-pointer font-normal">Claim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="others" id="type_others" />
                    <Label htmlFor="type_others" className="cursor-pointer font-normal">Others:</Label>
                    <Input
                      className="h-8 w-48"
                      placeholder="Specify"
                      value={form.prf_type_others}
                      onChange={(event) => setForm((prev) => ({ ...prev, prf_type_others: event.target.value }))}
                      disabled={form.prf_type !== 'others'}
                    />
                  </div>
                </RadioGroup>
              </div>

              {/* Payable To / Payment Via */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payable To</Label>
                  <Input
                    value={form.payable_to}
                    onChange={(event) => setForm((prev) => ({ ...prev, payable_to: event.target.value }))}
                    placeholder="Name of payee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Via</Label>
                  <Input
                    value={form.payment_via}
                    onChange={(event) => setForm((prev) => ({ ...prev, payment_via: event.target.value }))}
                    placeholder="e.g. Bank Transfer, Cash, Cheque"
                  />
                </div>
              </div>

              <Separator />

              {/* Line Items Table */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Line Items</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">Doc. Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[200px]">GL Account</TableHead>
                        <TableHead className="w-[160px]">Project/Site</TableHead>
                        <TableHead className="w-[140px] text-right">Amount (RM)</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8"
                              value={item.doc_date}
                              onChange={(e) => updateItem(item.id, 'doc_date', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Description"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.gl_account_id || 'none'}
                              onValueChange={(value) => updateItem(item.id, 'gl_account_id', value === 'none' ? '' : value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Account" />
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
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={item.project_site}
                              onChange={(e) => updateItem(item.id, 'project_site', e.target.value)}
                              placeholder="Project/Site"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-right"
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount}
                              onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeItem(item.id)}
                              disabled={form.items.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    Add Row
                  </Button>
                  <p className="text-sm font-semibold">
                    TOTAL (RM): {formatMoney(totals)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Advance Section */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Date Advanced Received</Label>
                  <Input
                    type="date"
                    value={form.advance_date_received}
                    onChange={(e) => setForm((prev) => ({ ...prev, advance_date_received: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advance Form No</Label>
                  <Input
                    value={form.advance_form_no}
                    onChange={(e) => setForm((prev) => ({ ...prev, advance_form_no: e.target.value }))}
                    placeholder="Advance form number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advance Amount (RM)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.advance_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, advance_amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Refund To or Reimburse By Petty Cash (RM)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="max-w-xs"
                  value={form.refund_reimburse_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, refund_reimburse_amount: e.target.value }))}
                />
              </div>

              <Separator />

              {/* Management Remarks */}
              <div className="space-y-2">
                <Label>Management Remarks (if any)</Label>
                <Textarea
                  rows={2}
                  value={form.management_remarks}
                  onChange={(e) => setForm((prev) => ({ ...prev, management_remarks: e.target.value }))}
                  placeholder="Optional management remarks"
                />
              </div>

              <Separator />

              {/* Checklist & Accounts Dept */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Checklist</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_invoice"
                        checked={form.chk_invoice}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_invoice: !!checked }))}
                      />
                      <Label htmlFor="chk_invoice" className="cursor-pointer font-normal">Invoice</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_work_order"
                        checked={form.chk_work_order}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_work_order: !!checked }))}
                      />
                      <Label htmlFor="chk_work_order" className="cursor-pointer font-normal">Work Order</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_purchase_order"
                        checked={form.chk_purchase_order}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_purchase_order: !!checked }))}
                      />
                      <Label htmlFor="chk_purchase_order" className="cursor-pointer font-normal">Purchase Order</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_letter"
                        checked={form.chk_letter}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_letter: !!checked }))}
                      />
                      <Label htmlFor="chk_letter" className="cursor-pointer font-normal">Letter</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_delivery_order"
                        checked={form.chk_delivery_order}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_delivery_order: !!checked }))}
                      />
                      <Label htmlFor="chk_delivery_order" className="cursor-pointer font-normal">Delivery Order</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_memo"
                        checked={form.chk_memo}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_memo: !!checked }))}
                      />
                      <Label htmlFor="chk_memo" className="cursor-pointer font-normal">Memo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_purchase_req_form"
                        checked={form.chk_purchase_req_form}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_purchase_req_form: !!checked }))}
                      />
                      <Label htmlFor="chk_purchase_req_form" className="cursor-pointer font-normal">Purchase Req. Form</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="chk_others"
                        checked={form.chk_others}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_others: !!checked }))}
                      />
                      <Label htmlFor="chk_others" className="cursor-pointer font-normal">Others</Label>
                      <Input
                        className="h-7 w-28"
                        value={form.chk_others_text}
                        onChange={(e) => setForm((prev) => ({ ...prev, chk_others_text: e.target.value }))}
                        disabled={!form.chk_others}
                        placeholder="Specify"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chk_quotation"
                        checked={form.chk_quotation}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, chk_quotation: !!checked }))}
                      />
                      <Label htmlFor="chk_quotation" className="cursor-pointer font-normal">Quotation</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Accounts Department</Label>
                  <div className="space-y-2">
                    <Label className="font-normal">Remarks</Label>
                    <Textarea
                      rows={4}
                      value={form.accounts_dept_remarks}
                      onChange={(e) => setForm((prev) => ({ ...prev, accounts_dept_remarks: e.target.value }))}
                      placeholder="Accounts department remarks"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveDraft} disabled={createPRF.isCreating || updatePRF.isSaving}>
                {createPRF.isCreating || updatePRF.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailPrf} onOpenChange={(open) => !open && setDetailPrf(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Payment Requisition Detail</DialogTitle>
              <DialogDescription>Review PRF details.</DialogDescription>
            </DialogHeader>

            {!detailPrf ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">PRF No:</span> {detailPrf.prf_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_PRF_STATUS_LABELS[detailPrf.status]}</p>
                  <p><span className="text-muted-foreground">Date:</span> {detailPrf.prf_date ? format(new Date(detailPrf.prf_date), 'dd MMM yyyy') : '-'}</p>
                  <p><span className="text-muted-foreground">Type:</span> {PRF_TYPE_LABELS[detailPrf.prf_type]}{detailPrf.prf_type === 'others' && detailPrf.prf_type_others ? ` - ${detailPrf.prf_type_others}` : ''}</p>
                  <p><span className="text-muted-foreground">Payable To:</span> {detailPrf.payable_to || '-'}</p>
                  <p><span className="text-muted-foreground">Payment Via:</span> {detailPrf.payment_via || '-'}</p>
                  <p><span className="text-muted-foreground">Prepared By:</span> {detailPrf.requester?.full_name || '-'}</p>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doc. Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Project/Site</TableHead>
                        <TableHead className="text-right">Amount (RM)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailPrf.items || []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.doc_date ? format(new Date(item.doc_date), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.project_site || '-'}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-right text-sm font-semibold">
                  TOTAL (RM): {formatMoney(detailPrf.total_amount)}
                </div>

                {(detailPrf.advance_amount > 0 || detailPrf.advance_form_no) && (
                  <div className="grid gap-2 text-sm md:grid-cols-3">
                    <p><span className="text-muted-foreground">Advance Date Received:</span> {detailPrf.advance_date_received ? format(new Date(detailPrf.advance_date_received), 'dd/MM/yyyy') : '-'}</p>
                    <p><span className="text-muted-foreground">Advance Form No:</span> {detailPrf.advance_form_no || '-'}</p>
                    <p><span className="text-muted-foreground">Advance Amount:</span> {formatMoney(detailPrf.advance_amount)}</p>
                  </div>
                )}

                {detailPrf.refund_reimburse_amount > 0 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Refund To / Reimburse By Petty Cash:</span> {formatMoney(detailPrf.refund_reimburse_amount)}
                  </p>
                )}

                {detailPrf.management_remarks && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Management Remarks:</p>
                    <p>{detailPrf.management_remarks}</p>
                  </div>
                )}

                {/* Checklist display */}
                {(() => {
                  const checks = [
                    detailPrf.chk_invoice && 'Invoice',
                    detailPrf.chk_purchase_order && 'Purchase Order',
                    detailPrf.chk_delivery_order && 'Delivery Order',
                    detailPrf.chk_purchase_req_form && 'Purchase Req. Form',
                    detailPrf.chk_quotation && 'Quotation',
                    detailPrf.chk_work_order && 'Work Order',
                    detailPrf.chk_letter && 'Letter',
                    detailPrf.chk_memo && 'Memo',
                    detailPrf.chk_others && `Others${detailPrf.chk_others_text ? `: ${detailPrf.chk_others_text}` : ''}`,
                  ].filter(Boolean);

                  return checks.length > 0 ? (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Checklist:</p>
                      <p>{checks.join(', ')}</p>
                    </div>
                  ) : null;
                })()}

                {detailPrf.accounts_dept_remarks && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Accounts Department Remarks:</p>
                    <p>{detailPrf.accounts_dept_remarks}</p>
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
