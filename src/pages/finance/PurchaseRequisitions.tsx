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
  useApprovePRF,
  useCancelPRF,
  useCreatePRF,
  usePurchaseRequisitions,
  useSubmitPRF,
  useUpdatePRF,
} from '@/hooks/finance/useAccountsPayable';
import { AP_PRF_STATUS_LABELS, AP_UNIT_OF_MEASURE_LABELS, type ApPrfStatus, type ApUnitOfMeasure, type PurchaseRequisition } from '@/types/finance';

interface PrfItemFormState {
  id: string;
  description: string;
  gl_account_id: string;
  quantity: string;
  unit: ApUnitOfMeasure;
  unit_price: string;
  project_id: string;
}

interface PrfFormState {
  company_id: string;
  department: string;
  purpose: string;
  justification: string;
  priority: 'normal' | 'urgent';
  required_by_date: string;
  suggested_supplier_id: string;
  quotation_ref: string;
  items: PrfItemFormState[];
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
    description: '',
    gl_account_id: '',
    quantity: '1',
    unit: 'unit',
    unit_price: '0',
    project_id: '',
  };
}

function makeInitialForm(companyId: string): PrfFormState {
  return {
    company_id: companyId,
    department: '',
    purpose: '',
    justification: '',
    priority: 'normal',
    required_by_date: '',
    suggested_supplier_id: '',
    quotation_ref: '',
    items: [makeItemRow()],
  };
}

export default function PurchaseRequisitions() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
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
    () => form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
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
      department: prf.department || '',
      purpose: prf.purpose || '',
      justification: prf.justification || '',
      priority: prf.priority,
      required_by_date: prf.required_by_date || '',
      suggested_supplier_id: prf.suggested_supplier_id || '',
      quotation_ref: prf.quotation_ref || '',
      items: (prf.items || []).map((item) => ({
        id: item.id,
        description: item.description,
        gl_account_id: item.gl_account_id,
        quantity: String(item.quantity || 0),
        unit: item.unit,
        unit_price: String(item.unit_price || 0),
        project_id: item.project_id || '',
      })),
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
        description: item.description.trim(),
        gl_account_id: item.gl_account_id,
        quantity: Number(item.quantity || 0),
        unit: item.unit,
        unit_price: Number(item.unit_price || 0),
        project_id: item.project_id || null,
      }))
      .filter((item) => item.description && item.gl_account_id && item.quantity > 0);

    if (!form.company_id) {
      toast({ title: 'Company is required', variant: 'destructive' });
      return;
    }

    if (!preparedItems.length) {
      toast({ title: 'Add at least one valid item', variant: 'destructive' });
      return;
    }

    const payload = {
      id: editingPrf?.id,
      company_id: form.company_id,
      department: form.department.trim() || null,
      purpose: form.purpose.trim() || null,
      justification: form.justification.trim() || null,
      priority: form.priority,
      required_by_date: form.required_by_date || null,
      suggested_supplier_id: form.suggested_supplier_id || null,
      quotation_ref: form.quotation_ref.trim() || null,
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
        title="Purchase Requisitions"
        description="Raise, review, and approve PRFs before supplier invoicing."
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
                placeholder="Search PRF number, purpose, remarks"
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
              <div className="py-10 text-center text-sm text-muted-foreground">No purchase requisitions found.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PRF No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((prf) => (
                      <TableRow key={prf.id}>
                        <TableCell className="font-medium">{prf.prf_number || 'Draft'}</TableCell>
                        <TableCell>{prf.created_at ? format(new Date(prf.created_at), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell>{prf.requester?.full_name || '-'}</TableCell>
                        <TableCell>{prf.purpose || '-'}</TableCell>
                        <TableCell className="text-right">{formatMoney(prf.total_amount)}</TableCell>
                        <TableCell className="capitalize">{prf.priority}</TableCell>
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

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingPrf(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{editingPrf ? 'Edit PRF' : 'New Purchase Requisition'}</DialogTitle>
              <DialogDescription>Capture the request purpose and detailed item breakdown for approval.</DialogDescription>
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
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as 'normal' | 'urgent' }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Required By Date</Label>
                  <Input
                    type="date"
                    value={form.required_by_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, required_by_date: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={form.department}
                    onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suggested Supplier</Label>
                  <Select
                    value={form.suggested_supplier_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, suggested_supplier_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {suppliers.suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_code} - {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={form.purpose}
                  onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                  placeholder="What is this requisition for?"
                />
              </div>

              <div className="space-y-2">
                <Label>Justification</Label>
                <Textarea
                  rows={3}
                  value={form.justification}
                  onChange={(event) => setForm((prev) => ({ ...prev, justification: event.target.value }))}
                  placeholder="Business justification or notes"
                />
              </div>

              <div className="space-y-2">
                <Label>Quotation Reference</Label>
                <Input
                  value={form.quotation_ref}
                  onChange={(event) => setForm((prev) => ({ ...prev, quotation_ref: event.target.value }))}
                  placeholder="Optional reference"
                />
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">Item {index + 1}</p>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="space-y-2 md:col-span-4">
                          <Label>Description</Label>
                          <Input
                            value={item.description}
                            onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-4">
                          <Label>GL Account</Label>
                          <Select
                            value={item.gl_account_id || 'none'}
                            onValueChange={(value) => updateItem(item.id, 'gl_account_id', value === 'none' ? '' : value)}
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
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.id, 'quantity', event.target.value)}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>Unit</Label>
                          <Select
                            value={item.unit}
                            onValueChange={(value) => updateItem(item.id, 'unit', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(AP_UNIT_OF_MEASURE_LABELS) as ApUnitOfMeasure[]).map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {AP_UNIT_OF_MEASURE_LABELS[unit]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 md:col-span-3">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(event) => updateItem(item.id, 'unit_price', event.target.value)}
                          />
                        </div>

                        <div className="space-y-2 md:col-span-5">
                          <Label>Project</Label>
                          <Select
                            value={item.project_id || 'none'}
                            onValueChange={(value) => updateItem(item.id, 'project_id', value === 'none' ? '' : value)}
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

                        <div className="space-y-2 md:col-span-4">
                          <Label>Line Amount</Label>
                          <Input
                            value={formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                            readOnly
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button type="button" variant="outline" onClick={addItem}>
                  Add Item
                </Button>

                <div className="text-sm font-medium">
                  Running Total: {formatMoney(totals)}
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

        <Dialog open={!!detailPrf} onOpenChange={(open) => !open && setDetailPrf(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>PRF Detail</DialogTitle>
              <DialogDescription>Review requisition header and line item details.</DialogDescription>
            </DialogHeader>

            {!detailPrf ? null : (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p><span className="text-muted-foreground">PRF No:</span> {detailPrf.prf_number || 'Draft'}</p>
                  <p><span className="text-muted-foreground">Status:</span> {AP_PRF_STATUS_LABELS[detailPrf.status]}</p>
                  <p><span className="text-muted-foreground">Requester:</span> {detailPrf.requester?.full_name || '-'}</p>
                  <p><span className="text-muted-foreground">Priority:</span> {detailPrf.priority}</p>
                  <p><span className="text-muted-foreground">Purpose:</span> {detailPrf.purpose || '-'}</p>
                  <p><span className="text-muted-foreground">Required By:</span> {detailPrf.required_by_date || '-'}</p>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>GL Account</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailPrf.items || []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.gl_account?.account_code} - {item.gl_account?.account_name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{AP_UNIT_OF_MEASURE_LABELS[item.unit]}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-right text-sm font-medium">
                  Total: {formatMoney(detailPrf.total_amount)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
