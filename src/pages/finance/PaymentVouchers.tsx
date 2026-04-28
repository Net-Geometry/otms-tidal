import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Eye,
  PlusCircle,
  Plus,
  Trash2,
  Search,
  Send,
  CheckCircle2,
  ShieldCheck,
  Banknote,
  BookOpen,
  FileText,
  ArrowRightLeft,
  AlertTriangle,
  Download,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useBankAccounts, useSuppliers } from '@/hooks/finance/useFinanceFoundation';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';
import { usePrfOutstandingBalances } from '@/hooks/finance/usePrfOutstandingBalances';
import { GLAccountCombobox } from '@/components/finance/GLAccountCombobox';
import {
  useApInvoices,
  useApprovePV,
  useChangePostType,
  useCheckPV,
  useCreatePaymentVoucher,
  useMarkPVPaid,
  usePaymentVouchers,
  usePostPV,
  usePostTypeAudit,
  usePurchaseRequisitions,
  useSubmitPV,
  useUpdatePaymentVoucher,
} from '@/hooks/finance/useAccountsPayable';
import { FileUpload } from '@/components/ot/FileUpload';
import { useActiveRole } from '@/hooks/useActiveRole';
import { generatePvPdf, generatePvBulkPdf } from '@/lib/pvPdfGenerator';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  PV_POST_TO_LABELS,
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
  gl_account_id: string;
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
  priority: 'normal' | 'urgent';
  target_approval_level: 'fa' | 'asst_mgr' | 'dmd';
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
  return { line_date: date, description: '', cheque_no: '', amount: '', gl_account_id: '' };
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
    priority: 'normal',
    target_approval_level: 'dmd',
  };
}

const STATUS_VARIANT: Record<ApPvStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending: 'secondary',
  checked: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  paid: 'default',
  posted: 'default',
  cancelled: 'destructive',
};

function PostTypeAuditSection({ pvId, currentPostType }: { pvId: string; currentPostType: PvPostToType }) {
  const { data: auditLog = [] } = usePostTypeAudit(pvId);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Posted To</h4>
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="default">{PV_POST_TO_LABELS[currentPostType]}</Badge>
        </div>
        {auditLog.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Change History</p>
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRightLeft className="h-3 w-3 shrink-0" />
                <span>
                  {PV_POST_TO_LABELS[entry.old_post_type as PvPostToType] || entry.old_post_type}
                  {' → '}
                  {PV_POST_TO_LABELS[entry.new_post_type as PvPostToType] || entry.new_post_type}
                </span>
                <span className="text-muted-foreground/60">
                  {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
                </span>
                {entry.reason && <span className="italic">— {entry.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentVouchers() {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const suppliers = useSuppliers();
  const bankAccounts = useBankAccounts();
  const chart = useChartOfAccounts({ accountType: 'all', activity: 'active', search: '' });
  const postableAccounts = useMemo(
    () => (chart.accounts || []).filter((a) => a.is_postable && a.is_active),
    [chart.accounts],
  );
  const { data: prfData } = usePurchaseRequisitions({ status: 'approved' });
  const allApprovedPrfs = useMemo(() => prfData?.rows || [], [prfData]);
  const { data: prfBalances = [] } = usePrfOutstandingBalances();
  const companyMap = useMemo(() => {
    const map = new Map<string, { name: string; code: string | null }>();
    for (const c of companies) map.set(c.id, { name: c.name, code: c.code });
    return map;
  }, [companies]);

  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApPvStatus>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { activeRole } = useActiveRole();

  const isFinanceAdmin = activeRole === 'finance_admin' || activeRole === 'admin';
  const isAsstMgr = activeRole === 'assistant_manager';
  const isDmd = activeRole === 'dmd';
  const isAccountExec = activeRole === 'account_exec';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PaymentVoucher | null>(null);
  const [detailVoucher, setDetailVoucher] = useState<PaymentVoucher | null>(null);
  const [form, setForm] = useState<PvFormState>(makeInitialForm(''));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // PRFs available for the PRF picker: only those with outstanding > 0,
  // filtered by selected company. Editing a PV that's linked to a now-zero
  // PRF: keep that PRF visible too so the link still resolves.
  const outstandingPrfsForPicker = useMemo(() => {
    const filtered = form.company_id
      ? prfBalances.filter((p) => p.company_id === form.company_id)
      : prfBalances;

    if (!form.prf_id) return filtered;
    if (filtered.some((p) => p.prf_id === form.prf_id)) return filtered;

    // Already-linked PRF not in outstanding list — synthesize a stub so it stays selected
    const linked = allApprovedPrfs.find((p: any) => p.id === form.prf_id);
    if (!linked) return filtered;
    return [
      ...filtered,
      {
        prf_id: linked.id,
        prf_number: linked.prf_number,
        company_id: linked.company_id,
        payable_to: linked.payable_to,
        priority: linked.priority || 'normal',
        prf_date: linked.prf_date,
        total_amount: Number(linked.total_amount || 0),
        allocated_amount: Number(linked.total_amount || 0),
        outstanding_amount: 0,
      },
    ];
  }, [prfBalances, form.company_id, form.prf_id, allApprovedPrfs]);

  const handlePrfSelect = (prfId: string) => {
    if (!prfId) {
      setForm((prev) => ({ ...prev, prf_id: '', pay_to: '', pay_for: '', lines: [makeEmptyLine(prev.payment_date)] }));
      return;
    }

    const balance = prfBalances.find((p) => p.prf_id === prfId);
    const fullPrf = allApprovedPrfs.find((p: any) => p.id === prfId);

    setForm((prev) => {
      const next = { ...prev, prf_id: prfId };

      if (fullPrf?.payable_to) {
        next.pay_to = fullPrf.payable_to;
      }

      if (fullPrf?.items?.length) {
        next.pay_for = fullPrf.items.map((it: any) => it.description).join('; ');

        next.lines = fullPrf.items.map((item: any) => ({
          line_date: item.doc_date || prev.payment_date,
          description: item.description || '',
          cheque_no: '',
          amount: String(Number(item.amount || 0).toFixed(2)),
          gl_account_id: item.gl_account_id || '',
        }));
      } else if (balance && balance.outstanding_amount > 0) {
        next.lines = [{
          line_date: prev.payment_date,
          description: `From ${balance.prf_number}`,
          cheque_no: '',
          amount: String(balance.outstanding_amount.toFixed(2)),
          gl_account_id: '',
        }];
      }

      return next;
    });
  };

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
  const checkPV = useCheckPV();
  const approvePV = useApprovePV();
  const postPV = usePostPV();
  const { markPaid, isMarkingPaid } = useMarkPVPaid();
  const { changePostType, isChanging: isChangingPostType } = useChangePostType();

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
        return { ...invoice, outstanding };
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

  const pettyCashGlIds = useMemo(() => {
    return new Set(
      (chart.accounts || [])
        .filter((a) => a.system_tag === 'petty_cash' || a.special_type === 'CH')
        .map((a) => a.id),
    );
  }, [chart.accounts]);

  const filteredBankAccounts = useMemo(() => {
    let list = bankAccounts.bankAccounts;
    if (form.company_id) {
      list = list.filter((account) => account.company_id === form.company_id);
    }
    // When Cash payment method is selected, restrict to bank accounts mapped to petty cash GL
    if (form.payment_method === 'cash') {
      list = list.filter((account) => account.gl_account_id && pettyCashGlIds.has(account.gl_account_id));
    }
    return list;
  }, [bankAccounts.bankAccounts, form.company_id, form.payment_method, pettyCashGlIds]);

  const openNewDialog = () => {
    const defaultCompanyId = companyFilter === 'all' ? companies[0]?.id || '' : companyFilter;
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
        gl_account_id: line.gl_account_id || '',
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
      priority: (voucher.priority as 'normal' | 'urgent') || 'normal',
      target_approval_level: (voucher.target_approval_level as 'fa' | 'asst_mgr' | 'dmd') || 'dmd',
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
      allocations: { ...prev.allocations, [invoiceId]: amount },
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
        gl_account_id: line.gl_account_id || null,
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
      priority: form.priority,
      target_approval_level: form.target_approval_level,
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

  // ── Summary stats ──
  const stats = useMemo(() => {
    const all = vouchers.data?.rows || [];
    const draftCount = all.filter((r) => r.status === 'draft').length;
    const pendingCount = all.filter((r) => ['pending', 'checked'].includes(r.status)).length;
    const approvedCount = all.filter((r) => r.status === 'approved').length;
    const totalAmount = all.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    return { draftCount, pendingCount, approvedCount, totalAmount };
  }, [vouchers.data]);

  // ── Bulk selection ──
  const visibleSelectableIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleSelectableIds.some((id) => selectedIds.has(id));

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of visibleSelectableIds) next.add(id);
      } else {
        for (const id of visibleSelectableIds) next.delete(id);
      }
      return next;
    });
  };

  const downloadSinglePvPdf = async (pv: PaymentVoucher) => {
    try {
      setIsDownloadingPdf(true);
      await generatePvPdf(pv);
    } catch (err) {
      console.error('PV PDF generation failed', err);
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const downloadBulkPvPdf = async () => {
    const selected = rows.filter((r) => selectedIds.has(r.id));
    if (!selected.length) {
      toast({ title: 'Select at least one PV to download', variant: 'destructive' });
      return;
    }
    try {
      setIsDownloadingPdf(true);
      await generatePvBulkPdf(selected);
    } catch (err) {
      console.error('Bulk PV PDF generation failed', err);
      toast({ title: 'Failed to generate bulk PDF', variant: 'destructive' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  function getRowActions(voucher: PaymentVoucher) {
    const actions: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: string }[] = [];

    if (voucher.status === 'draft' && isFinanceAdmin) {
      actions.push({
        label: 'Edit',
        icon: <FileText className="h-4 w-4" />,
        onClick: () => openEditDialog(voucher),
      });
      actions.push({
        label: 'Submit',
        icon: <Send className="h-4 w-4" />,
        onClick: () => submitPV.submitPV({ pvId: voucher.id }),
        disabled: submitPV.isSubmitting,
      });
    }
    if (voucher.status === 'pending' && isAsstMgr) {
      actions.push({
        label: 'Check',
        icon: <CheckCircle2 className="h-4 w-4" />,
        onClick: () => checkPV.checkPV({ pvId: voucher.id }),
        disabled: checkPV.isChecking,
      });
    }
    if (voucher.status === 'checked' && isDmd) {
      actions.push({
        label: 'Approve',
        icon: <ShieldCheck className="h-4 w-4" />,
        onClick: () => approvePV.approvePV({ pvId: voucher.id }),
        disabled: approvePV.isApproving,
      });
    }
    if (voucher.status === 'approved' && isFinanceAdmin) {
      actions.push({
        label: 'Mark Paid',
        icon: <Banknote className="h-4 w-4" />,
        onClick: async () => { await markPaid({ pvIds: [voucher.id] }); },
        disabled: isMarkingPaid,
      });
    }

    return actions;
  }

  return (
    <AppLayout>
      <PageLayout
        title="Payment Vouchers"
        description="Prepare AP payments, allocate invoices, and post disbursements to GL."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={downloadBulkPvPdf}
              disabled={selectedIds.size === 0 || isDownloadingPdf}
              title={
                selectedIds.size === 0
                  ? 'Select PVs from the list to enable bulk download'
                  : `Download ${selectedIds.size} PV${selectedIds.size === 1 ? '' : 's'} as a single PDF`
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {selectedIds.size > 0
                ? `Download ${selectedIds.size} PV${selectedIds.size === 1 ? '' : 's'} as PDF`
                : 'Download Selected PDF'}
            </Button>
            <Button onClick={openNewDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Payment Voucher
            </Button>
          </div>
        }
      >
        {/* ── Summary Cards ── */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drafts</p>
              <p className="text-2xl font-bold mt-1">{stats.draftCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-bold mt-1">{stats.pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-bold mt-1">{stats.approvedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page Total</p>
              <p className="text-2xl font-bold mt-1">{formatMoney(stats.totalAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ── */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                value={companyFilter}
                onValueChange={(value) => { setCompanyFilter(value); setPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.code || company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => { setStatusFilter(value as 'all' | ApPvStatus); setPage(1); }}
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
                onValueChange={(value) => { setSupplierFilter(value); setPage(1); }}
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

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search PV number or reference"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Register Table ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payment Voucher Register</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!rows.length && !vouchers.isLoading ? (
              <div className="py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No payment vouchers found.</p>
                <p className="text-xs text-muted-foreground mt-1">Create a new PV or adjust your filters.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[36px]">
                        <Checkbox
                          aria-label="Select all visible PVs"
                          checked={
                            allVisibleSelected
                              ? true
                              : someVisibleSelected
                              ? 'indeterminate'
                              : false
                          }
                          onCheckedChange={(value) => toggleSelectAllVisible(value === true)}
                        />
                      </TableHead>
                      <TableHead>PV No</TableHead>
                      <TableHead>Company</TableHead>
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
                    {rows.map((voucher) => {
                      const actions = getRowActions(voucher);
                      const postActions = voucher.status === 'paid' && isAccountExec;
                      const canChangePostType = voucher.status === 'posted' && isAccountExec && !!voucher.post_to_type;

                      return (
                        <TableRow
                          key={voucher.id}
                          className={`group cursor-pointer ${voucher.priority === 'urgent' ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''} ${selectedIds.has(voucher.id) ? 'bg-primary/5' : ''}`}
                          onClick={() => setDetailVoucher(voucher)}
                        >
                          <TableCell
                            className="w-[36px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              aria-label={`Select PV ${voucher.pv_number || voucher.id}`}
                              checked={selectedIds.has(voucher.id)}
                              onCheckedChange={(value) => toggleSelected(voucher.id, value === true)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {voucher.priority === 'urgent' && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                                  aria-label="Urgent"
                                />
                              )}
                              <span className="font-mono text-xs font-medium">
                                {voucher.pv_number || 'Draft'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{companyMap.get(voucher.company_id)?.code || companyMap.get(voucher.company_id)?.name || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{voucher.pay_to || voucher.supplier?.supplier_name || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                              {voucher.pay_for || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums whitespace-nowrap">
                              {format(new Date(voucher.payment_date), 'dd/MM/yy')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {voucher.payment_method === 'others'
                                ? (voucher.payment_method_other || 'Others')
                                : AP_PAYMENT_METHOD_LABELS[voucher.payment_method]}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm tabular-nums font-medium">
                              {formatMoney(voucher.total_amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[voucher.status]}>
                              {AP_PV_STATUS_LABELS[voucher.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              {actions.map((action) => (
                                <Button
                                  key={action.label}
                                  variant="outline"
                                  size="sm"
                                  onClick={action.onClick}
                                  disabled={action.disabled}
                                >
                                  {action.label}
                                </Button>
                              ))}

                              {postActions && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Post
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                      onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'cashbook' })}
                                      disabled={postPV.isPosting}
                                    >
                                      <BookOpen className="mr-2 h-4 w-4" />
                                      Post to Cashbook
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'ap_payment' })}
                                      disabled={postPV.isPosting}
                                    >
                                      <Banknote className="mr-2 h-4 w-4" />
                                      Post to AP Payment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => postPV.postPV({ pvId: voucher.id, postToType: 'ap_credit_note' })}
                                      disabled={postPV.isPosting}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      Post to AP Credit Note
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}

                              {canChangePostType && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Change Type
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {voucher.post_to_type !== 'cashbook' && (
                                      <DropdownMenuItem
                                        onClick={() => changePostType({ pvId: voucher.id, newPostType: 'cashbook' })}
                                        disabled={isChangingPostType}
                                      >
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        Change to Cashbook
                                      </DropdownMenuItem>
                                    )}
                                    {voucher.post_to_type !== 'ap_payment' && (
                                      <DropdownMenuItem
                                        onClick={() => changePostType({ pvId: voucher.id, newPostType: 'ap_payment' })}
                                        disabled={isChangingPostType}
                                      >
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        Change to AP Payment
                                      </DropdownMenuItem>
                                    )}
                                    {voucher.post_to_type !== 'ap_credit_note' && (
                                      <DropdownMenuItem
                                        onClick={() => changePostType({ pvId: voucher.id, newPostType: 'ap_credit_note' })}
                                        disabled={isChangingPostType}
                                      >
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        Change to AP Credit Note
                                      </DropdownMenuItem>
                                    )}
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
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Create/Edit Dialog ── */}
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

            <div className="space-y-5">
              {/* Row 1: Company, Ref No, Date */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={form.company_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, company_id: value === 'none' ? '' : value, prf_id: '' }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ref No.</Label>
                  <Input value={form.reference_no} readOnly disabled placeholder="Auto-generated" className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.payment_date} onChange={(e) => setForm((prev) => ({ ...prev, payment_date: e.target.value }))} />
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-3 rounded-md border bg-amber-50/50 p-3 dark:bg-amber-950/20">
                <Checkbox
                  id="pv_urgent"
                  checked={form.priority === 'urgent'}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, priority: checked ? 'urgent' : 'normal' }))
                  }
                />
                <AlertTriangle className={`h-4 w-4 ${form.priority === 'urgent' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <Label htmlFor="pv_urgent" className="cursor-pointer font-medium">
                  Mark as Urgent
                </Label>
                <span className="text-xs text-muted-foreground">
                  Approvers will see an urgent label and be notified accordingly.
                </span>
              </div>

              {/* Approval Routing — FA picks how high this PV needs to escalate */}
              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-sm font-medium">Approval Routing</Label>
                <RadioGroup
                  value={form.target_approval_level}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, target_approval_level: value as 'fa' | 'asst_mgr' | 'dmd' }))
                  }
                  className="grid gap-2 md:grid-cols-3"
                >
                  <Label
                    htmlFor="target_fa"
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm font-normal ${form.target_approval_level === 'fa' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <RadioGroupItem value="fa" id="target_fa" />
                    <span>
                      <span className="block font-medium">FA only</span>
                      <span className="block text-xs text-muted-foreground">Self-approve, skip AM and DMD</span>
                    </span>
                  </Label>
                  <Label
                    htmlFor="target_asst_mgr"
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm font-normal ${form.target_approval_level === 'asst_mgr' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <RadioGroupItem value="asst_mgr" id="target_asst_mgr" />
                    <span>
                      <span className="block font-medium">FA → AM</span>
                      <span className="block text-xs text-muted-foreground">Asst. Manager approves, skip DMD</span>
                    </span>
                  </Label>
                  <Label
                    htmlFor="target_dmd"
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm font-normal ${form.target_approval_level === 'dmd' ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <RadioGroupItem value="dmd" id="target_dmd" />
                    <span>
                      <span className="block font-medium">FA → AM → DMD</span>
                      <span className="block text-xs text-muted-foreground">Full chain (default)</span>
                    </span>
                  </Label>
                </RadioGroup>
              </div>

              {/* Row 2: Pay To, Pay For */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pay To</Label>
                  <Input value={form.pay_to} onChange={(e) => setForm((prev) => ({ ...prev, pay_to: e.target.value }))} placeholder="Payee name" />
                </div>
                <div className="space-y-2">
                  <Label>Pay For</Label>
                  <Input value={form.pay_for} onChange={(e) => setForm((prev) => ({ ...prev, pay_for: e.target.value }))} placeholder="Payment purpose / description" />
                </div>
              </div>

              {/* Row 3: Bank Account & Payment Method */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select
                    value={form.bank_account_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, bank_account_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
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
                  <Label>Payment Method</Label>
                  <RadioGroup
                    value={form.payment_method}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value as ApPaymentMethod, bank_account_id: '' }))}
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
                      <Input className="w-40" value={form.payment_method_other} onChange={(e) => setForm((prev) => ({ ...prev, payment_method_other: e.target.value }))} placeholder="Specify..." />
                    )}
                  </RadioGroup>
                </div>
              </div>

              {/* Recurring */}
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

              {/* Supplier */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier <span className="text-muted-foreground text-xs">(optional, for invoice allocation)</span></Label>
                  <Select
                    value={form.supplier_id || 'none'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, supplier_id: value === 'none' ? '' : value, allocations: {} }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {filteredSuppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_code} - {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* PRF No. — above line items since PRF is the parent document */}
              <div className="space-y-2">
                <Label>PRF No.</Label>
                <Select
                  value={form.prf_id || 'none'}
                  onValueChange={(value) => handlePrfSelect(value === 'none' ? '' : value)}
                >
                  <SelectTrigger><SelectValue placeholder="Link to PRF (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {outstandingPrfsForPicker.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No approved PRFs with outstanding balance.
                      </div>
                    )}
                    {outstandingPrfsForPicker.map((prf) => (
                      <SelectItem key={prf.prf_id} value={prf.prf_id}>
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{prf.prf_number}</span>
                          {prf.payable_to && <span className="text-xs text-muted-foreground">— {prf.payable_to}</span>}
                          <span className="ml-auto text-xs font-semibold tabular-nums text-emerald-600">
                            {formatMoney(prf.outstanding_amount)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.prf_id && (() => {
                  const balance = outstandingPrfsForPicker.find((p) => p.prf_id === form.prf_id);
                  if (!balance) return null;
                  return (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      PRF Total: {formatMoney(balance.total_amount)} · Allocated: {formatMoney(balance.allocated_amount)} · Outstanding: <span className="font-semibold text-emerald-600">{formatMoney(balance.outstanding_amount)}</span>
                    </p>
                  );
                })()}
              </div>

              <Separator />

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Line Items</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Line
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[200px]">GL Account</TableHead>
                        <TableHead className="w-[120px]">Cheque No.</TableHead>
                        <TableHead className="w-[140px] text-right">Amount (RM)</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input type="date" value={line.line_date} onChange={(e) => updateLine(index, 'line_date', e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} placeholder="Description" />
                          </TableCell>
                          <TableCell>
                            <GLAccountCombobox
                              value={line.gl_account_id}
                              onChange={(value) => updateLine(index, 'gl_account_id', value)}
                              options={postableAccounts}
                              size="sm"
                              popoverWidth="w-[340px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input value={line.cheque_no} onChange={(e) => updateLine(index, 'cheque_no', e.target.value)} placeholder="Cheque no." />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" className="text-right" value={line.amount} onChange={(e) => updateLine(index, 'amount', e.target.value)} />
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
                <div className="text-right text-sm font-medium">
                  Line Total: {formatMoney(linesTotal)}
                </div>
              </div>

              {/* Invoice Allocation */}
              {form.supplier_id && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Invoice Allocation</h4>
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
                                    <div className="space-y-0.5">
                                      <div className="font-medium text-sm">{invoice.invoice_number || invoice.id}</div>
                                      <div className="text-xs text-muted-foreground">Due {format(new Date(invoice.due_date), 'dd MMM yyyy')}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(invoice.total_amount)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(invoice.paid_amount)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatMoney(invoice.outstanding)}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number" min="0" step="0.01"
                                      className={`w-36 ml-auto ${invalid ? 'border-destructive' : ''}`}
                                      disabled={!checked}
                                      value={allocatedValue}
                                      onChange={(e) => updateAllocationAmount(invoice.id, e.target.value)}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks (Account Dept.)</Label>
                <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} placeholder="Optional notes" />
              </div>

              {/* Attachments */}
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

              {/* Totals */}
              <div className="rounded-md border bg-muted/30 p-4 space-y-1 text-right text-sm">
                {totalAllocated > 0 && <div>Invoice Allocation: <span className="font-medium">{formatMoney(totalAllocated)}</span></div>}
                {linesTotal > 0 && totalAllocated > 0 && <div>Line Items: <span className="font-medium">{formatMoney(linesTotal)}</span></div>}
                <div className="text-base font-semibold pt-1 border-t mt-2">
                  Total: {formatMoney(linesTotal + totalAllocated)}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="button" onClick={saveDraft} disabled={createVoucher.isCreating || updateVoucher.isSaving}>
                {createVoucher.isCreating || updateVoucher.isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailVoucher} onOpenChange={(open) => !open && setDetailVoucher(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>
                  {detailVoucher?.pv_number || 'Draft PV'}
                </DialogTitle>
                {detailVoucher && (
                  <Badge variant={STATUS_VARIANT[detailVoucher.status]}>
                    {AP_PV_STATUS_LABELS[detailVoucher.status]}
                  </Badge>
                )}
                {detailVoucher?.priority === 'urgent' && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Urgent
                  </Badge>
                )}
                {detailVoucher?.target_approval_level && detailVoucher.target_approval_level !== 'dmd' && (
                  <Badge variant="outline" className="text-xs">
                    {detailVoucher.target_approval_level === 'fa' ? 'FA-only' : 'FA → AM'}
                  </Badge>
                )}
              </div>
              <DialogDescription>Review payment details and invoice allocation breakdown.</DialogDescription>
            </DialogHeader>

            {!detailVoucher ? null : (
              <div className="space-y-5">
                {detailVoucher.priority === 'urgent' && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">URGENT</span>
                    <span className="text-muted-foreground">— this PV has been flagged for urgent processing.</span>
                  </div>
                )}
                {/* Key details grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium">{companyMap.get(detailVoucher.company_id)?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay To</span>
                      <span className="font-medium">{detailVoucher.pay_to || detailVoucher.supplier?.supplier_name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay For</span>
                      <span className="font-medium">{detailVoucher.pay_for || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ref No.</span>
                      <span>{detailVoucher.reference_no || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recurring</span>
                      <span>{detailVoucher.is_recurring ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{format(new Date(detailVoucher.payment_date), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Method</span>
                      <span>{detailVoucher.payment_method === 'others' ? (detailVoucher.payment_method_other || 'Others') : AP_PAYMENT_METHOD_LABELS[detailVoucher.payment_method]}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Amount</span>
                      <span className="text-base font-bold">{formatMoney(detailVoucher.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {detailVoucher.remarks && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <span className="text-muted-foreground">Remarks: </span>
                    {detailVoucher.remarks}
                  </div>
                )}

                {/* Line Items */}
                {(detailVoucher.lines || []).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Line Items</h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>GL Account</TableHead>
                            <TableHead>Cheque No.</TableHead>
                            <TableHead className="text-right">Amount (RM)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detailVoucher.lines || [])
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((line) => (
                              <TableRow key={line.id}>
                                <TableCell className="tabular-nums">{format(new Date(line.line_date), 'dd-MM-yyyy')}</TableCell>
                                <TableCell>{line.description}</TableCell>
                                <TableCell className="text-xs">
                                  {line.gl_account
                                    ? `${line.gl_account.account_code} - ${line.gl_account.account_name}`
                                    : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>{line.cheque_no || '-'}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{formatMoney(line.amount)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Invoice Allocations */}
                {(detailVoucher.allocations || []).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Invoice Allocations</h4>
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
                              <TableCell className="font-medium">{allocation.ap_invoice?.invoice_number || allocation.ap_invoice_id}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(allocation.ap_invoice?.total_amount || 0)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(allocation.ap_invoice?.paid_amount || 0)}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{formatMoney(allocation.allocated_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Post Type & Audit Trail */}
                {detailVoucher.status === 'posted' && detailVoucher.post_to_type && (
                  <PostTypeAuditSection pvId={detailVoucher.id} currentPostType={detailVoucher.post_to_type} />
                )}
              </div>
            )}

            {detailVoucher && (
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadSinglePvPdf(detailVoucher)}
                  disabled={isDownloadingPdf}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button onClick={() => setDetailVoucher(null)}>Close</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
