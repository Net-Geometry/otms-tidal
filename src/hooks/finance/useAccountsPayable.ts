/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';
import { createFinanceNotification } from '@/hooks/finance/useFinanceNotifications';
import { AP_TAX_CODES } from '@/types/finance';
import {
  PV_POST_TO_LABELS,
  type ApInvoice,
  type ApInvoiceLine,
  type ApInvoiceStatus,
  type ApPaymentMethod,
  type ApPrfStatus,
  type ApPvStatus,
  type ApTaxCode,
  type ApUnitOfMeasure,
  type PaymentVoucher,
  type PaymentVoucherAllocation,
  type PaymentVoucherLine,
  type PrfType,
  type PurchaseRequisition,
  type PurchaseRequisitionItem,
  type PvPostToType,
} from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function resolveCompanyId(db: any, fallbackCompanyId?: string | null) {
  if (fallbackCompanyId) return fallbackCompanyId;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error('Not authenticated');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('company_id')
    .eq('id', authData.user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.company_id) throw new Error('No company is assigned to your profile');

  return profile.company_id as string;
}

async function getCurrentUserId() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error('Not authenticated');
  return authData.user.id;
}

async function nextDocumentNumber(db: any, companyId: string, prefix: string, docDate?: string) {
  const { data, error } = await db.rpc('finance_next_document_number', {
    p_company_id: companyId,
    p_prefix: prefix,
    p_doc_date: docDate || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  if (!data) throw new Error('Failed to generate document number');
  return data as string;
}

function normalizePrfItem(item: any): PurchaseRequisitionItem {
  return {
    ...item,
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.unit_price),
    amount: toNumber(item.amount),
  };
}

function normalizePrf(row: any): PurchaseRequisition {
  return {
    ...row,
    total_amount: toNumber(row.total_amount),
    items: ((row.items || []) as any[]).map(normalizePrfItem),
  };
}

function normalizeApInvoiceLine(line: any): ApInvoiceLine {
  return {
    ...line,
    quantity: toNumber(line.quantity),
    unit_price: toNumber(line.unit_price),
    amount: toNumber(line.amount),
    tax_rate: toNumber(line.tax_rate),
    tax_amount: toNumber(line.tax_amount),
  };
}

function normalizeApInvoice(row: any): ApInvoice {
  return {
    ...row,
    exchange_rate: toNumber(row.exchange_rate),
    subtotal: toNumber(row.subtotal),
    tax_total: toNumber(row.tax_total),
    withholding_tax: toNumber(row.withholding_tax),
    total_amount: toNumber(row.total_amount),
    paid_amount: toNumber(row.paid_amount),
    lines: ((row.lines || []) as any[]).map(normalizeApInvoiceLine),
  };
}

function normalizeAllocation(row: any): PaymentVoucherAllocation {
  return {
    ...row,
    allocated_amount: toNumber(row.allocated_amount),
    ap_invoice: row.ap_invoice
      ? {
          ...row.ap_invoice,
          total_amount: toNumber(row.ap_invoice.total_amount),
          paid_amount: toNumber(row.ap_invoice.paid_amount),
        }
      : null,
  };
}

function normalizePvLine(row: any): PaymentVoucherLine {
  return {
    ...row,
    amount: toNumber(row.amount),
  };
}

function normalizePv(row: any): PaymentVoucher {
  return {
    ...row,
    total_amount: toNumber(row.total_amount),
    allocations: ((row.allocations || []) as any[]).map(normalizeAllocation),
    lines: ((row.lines || []) as any[]).map(normalizePvLine),
  };
}

export interface PurchaseRequisitionFilters {
  companyId?: string;
  status?: ApPrfStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PurchaseRequisitionItemInput {
  doc_date?: string | null;
  description: string;
  gl_account_id: string;
  quantity?: number;
  unit?: ApUnitOfMeasure;
  unit_price?: number;
  project_id?: string | null;
  project_site?: string | null;
}

export interface UpsertPrfInput {
  id?: string;
  company_id?: string | null;
  requester_id?: string | null;
  prf_type?: PrfType;
  prf_type_others?: string | null;
  payable_to?: string | null;
  payment_via?: string | null;
  prf_date?: string | null;
  department?: string | null;
  priority?: 'normal' | 'urgent';
  required_by_date?: string | null;
  purpose?: string | null;
  justification?: string | null;
  suggested_supplier_id?: string | null;
  quotation_ref?: string | null;
  advance_date_received?: string | null;
  advance_form_no?: string | null;
  advance_amount?: number;
  refund_reimburse_amount?: number;
  management_remarks?: string | null;
  chk_invoice?: boolean;
  chk_purchase_order?: boolean;
  chk_delivery_order?: boolean;
  chk_purchase_req_form?: boolean;
  chk_quotation?: boolean;
  chk_work_order?: boolean;
  chk_letter?: boolean;
  chk_memo?: boolean;
  chk_others?: boolean;
  chk_others_text?: string | null;
  accounts_dept_remarks?: string | null;
  attachments?: string[];
  items: PurchaseRequisitionItemInput[];
}

async function upsertPrf(db: any, input: UpsertPrfInput): Promise<{ id: string }> {
  const requesterId = input.requester_id || (await getCurrentUserId());
  const companyId = await resolveCompanyId(db, input.company_id);

  const items = (input.items || [])
    .map((item) => ({
      doc_date: item.doc_date || null,
      description: item.description.trim(),
      gl_account_id: item.gl_account_id,
      quantity: toNumber(item.quantity || 0),
      unit: (item.unit || 'unit') as ApUnitOfMeasure,
      unit_price: toNumber(item.unit_price || 0),
      project_id: item.project_id || null,
      project_site: item.project_site?.trim() || null,
    }))
    .filter((item) => item.description && item.unit_price > 0);

  if (!items.length) throw new Error('At least one valid line item is required');

  const totalAmount = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));

  const payload = {
    company_id: companyId,
    requester_id: requesterId,
    prf_type: input.prf_type || 'payment_request',
    prf_type_others: input.prf_type_others?.trim() || null,
    payable_to: input.payable_to?.trim() || null,
    payment_via: input.payment_via?.trim() || null,
    prf_date: input.prf_date || null,
    department: input.department?.trim() || null,
    priority: input.priority || 'normal',
    required_by_date: input.required_by_date || null,
    purpose: input.purpose?.trim() || null,
    justification: input.justification?.trim() || null,
    suggested_supplier_id: input.suggested_supplier_id || null,
    quotation_ref: input.quotation_ref?.trim() || null,
    total_amount: totalAmount,
    advance_date_received: input.advance_date_received || null,
    advance_form_no: input.advance_form_no?.trim() || null,
    advance_amount: toNumber(input.advance_amount),
    refund_reimburse_amount: toNumber(input.refund_reimburse_amount),
    management_remarks: input.management_remarks?.trim() || null,
    chk_invoice: input.chk_invoice ?? false,
    chk_purchase_order: input.chk_purchase_order ?? false,
    chk_delivery_order: input.chk_delivery_order ?? false,
    chk_purchase_req_form: input.chk_purchase_req_form ?? false,
    chk_quotation: input.chk_quotation ?? false,
    chk_work_order: input.chk_work_order ?? false,
    chk_letter: input.chk_letter ?? false,
    chk_memo: input.chk_memo ?? false,
    chk_others: input.chk_others ?? false,
    chk_others_text: input.chk_others_text?.trim() || null,
    accounts_dept_remarks: input.accounts_dept_remarks?.trim() || null,
    attachments: input.attachments || [],
  };

  let prfId = input.id;

  if (prfId) {
    const { data: current, error: currentError } = await db
      .from('purchase_requisitions')
      .select('id, status')
      .eq('id', prfId)
      .single();
    if (currentError) throw currentError;
    if (!current || (current.status !== 'draft' && current.status !== 'rejected')) {
      throw new Error('Only draft or rejected PRFs can be edited');
    }

    const { error } = await db
      .from('purchase_requisitions')
      .update(payload)
      .eq('id', prfId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from('purchase_requisitions')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    prfId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('purchase_requisition_items')
    .delete()
    .eq('prf_id', prfId);
  if (deleteError) throw deleteError;

  const { error: insertItemsError } = await db
    .from('purchase_requisition_items')
    .insert(
      items.map((item) => ({
        prf_id: prfId,
        doc_date: item.doc_date,
        description: item.description,
        gl_account_id: item.gl_account_id,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: roundMoney(item.unit_price),
        project_id: item.project_id,
        project_site: item.project_site,
      })),
    );
  if (insertItemsError) throw insertItemsError;

  return { id: prfId };
}

export function usePurchaseRequisitions(filters: PurchaseRequisitionFilters = {}) {
  const db = supabase as any;
  const { profile } = useAuth();
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'purchase-requisitions',
      filters.companyId || 'all',
      filters.status || 'all',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      let q = db
        .from('purchase_requisitions')
        .select(
          `
            *,
            requester:profiles!purchase_requisitions_requester_id_fkey(id, employee_id, full_name),
            suggested_supplier:suppliers!purchase_requisitions_suggested_supplier_id_fkey(id, supplier_code, supplier_name),
            verified_by_profile:profiles!purchase_requisitions_verified_by_fkey(id, employee_id, full_name),
            checked_by_profile:profiles!purchase_requisitions_checked_by_fkey(id, employee_id, full_name),
            rejected_by_profile:profiles!purchase_requisitions_rejected_by_fkey(id, employee_id, full_name),
            items:purchase_requisition_items(
              *,
              gl_account:chart_of_accounts(id, account_code, account_name),
              project:projects(id, project_code, project_name)
            )
          `,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false });

      if (filters.companyId) {
        q = q.eq('company_id', filters.companyId);
      }

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `prf_number.ilike.%${search}%,payable_to.ilike.%${search}%,purpose.ilike.%${search}%,management_remarks.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizePrf);
      const total = count || 0;

      return {
        rows,
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
    enabled: !!profile?.id,
    staleTime: 20 * 1000,
  });
}

export function useCreatePRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertPrfInput) => upsertPrf(db, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Created', description: 'Purchase requisition saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createPRF: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useUpdatePRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertPrfInput) => {
      if (!input.id) throw new Error('PRF id is required');
      return upsertPrf(db, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Saved', description: 'Purchase requisition updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updatePRF: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const { data: current, error: currentError } = await db
        .from('purchase_requisitions')
        .select('id, company_id, prf_number, status')
        .eq('id', input.prfId)
        .single();
      if (currentError) throw currentError;
      if (!current || current.status !== 'draft') throw new Error('Only draft PRFs can be submitted');

      const prfNumber = current.prf_number || (await nextDocumentNumber(db, current.company_id, 'PRF'));

      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          prf_number: prfNumber,
          status: 'prepared',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', input.prfId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('PRF was already updated by another user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Submitted', description: 'Purchase requisition submitted for verification' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitPRF: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useVerifyPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const userId = await getCurrentUserId();
      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          status: 'verified',
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', input.prfId)
        .eq('status', 'prepared')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only prepared PRFs can be verified');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Verified', description: 'Purchase requisition verified' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    verifyPRF: mutation.mutateAsync,
    isVerifying: mutation.isPending,
  };
}

export function useCheckPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const userId = await getCurrentUserId();
      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          status: 'checked',
          checked_by: userId,
          checked_at: new Date().toISOString(),
        })
        .eq('id', input.prfId)
        .eq('status', 'verified')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only verified PRFs can be checked');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Checked', description: 'Purchase requisition checked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    checkPRF: mutation.mutateAsync,
    isChecking: mutation.isPending,
  };
}

export function useApprovePRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.prfId)
        .eq('status', 'checked')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only checked PRFs can be approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Approved', description: 'Purchase requisition approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approvePRF: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function useRejectPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string; remarks: string }) => {
      const userId = await getCurrentUserId();

      const { data: current, error: currentError } = await db
        .from('purchase_requisitions')
        .select('id, status')
        .eq('id', input.prfId)
        .single();
      if (currentError) throw currentError;

      const rejectableStatuses = ['prepared', 'verified', 'checked'];
      if (!current || !rejectableStatuses.includes(current.status)) {
        throw new Error('Only prepared, verified, or checked PRFs can be rejected');
      }

      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          status: 'rejected',
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          rejection_remarks: input.remarks.trim() || null,
          rejection_stage: current.status,
        })
        .eq('id', input.prfId)
        .eq('status', current.status)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('PRF was already updated by another user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Rejected', description: 'Purchase requisition rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    rejectPRF: mutation.mutateAsync,
    isRejecting: mutation.isPending,
  };
}

export function useResubmitPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const { data, error } = await db
        .from('purchase_requisitions')
        .update({
          status: 'prepared',
          rejected_by: null,
          rejected_at: null,
          rejection_remarks: null,
          rejection_stage: null,
          verified_by: null,
          verified_at: null,
          checked_by: null,
          checked_at: null,
          approved_at: null,
        })
        .eq('id', input.prfId)
        .eq('status', 'rejected')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only rejected PRFs can be resubmitted');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Resubmitted', description: 'Purchase requisition resubmitted for verification' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    resubmitPRF: mutation.mutateAsync,
    isResubmitting: mutation.isPending,
  };
}

export function useCancelPRF() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { prfId: string }) => {
      const { data, error } = await db
        .from('purchase_requisitions')
        .update({ status: 'cancelled' })
        .eq('id', input.prfId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Only draft PRFs can be cancelled');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({ title: 'Cancelled', description: 'Purchase requisition cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    cancelPRF: mutation.mutateAsync,
    isCancelling: mutation.isPending,
  };
}

export interface ApInvoiceFilters {
  companyId?: string;
  status?: ApInvoiceStatus | 'all';
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ApInvoiceLineInput {
  description: string;
  gl_account_id: string;
  quantity?: number;
  unit_price?: number;
  tax_code?: ApTaxCode;
  tax_rate?: number;
  project_id?: string | null;
}

export interface UpsertApInvoiceInput {
  id?: string;
  company_id?: string | null;
  supplier_id: string;
  supplier_invoice_no?: string | null;
  prf_id?: string | null;
  invoice_date: string;
  due_date: string;
  currency?: string;
  exchange_rate?: number;
  withholding_tax?: number;
  remarks?: string | null;
  lines: ApInvoiceLineInput[];
}

async function upsertApInvoice(db: any, input: UpsertApInvoiceInput): Promise<{ id: string }> {
  const companyId = await resolveCompanyId(db, input.company_id);

  const preparedLines = (input.lines || [])
    .map((line) => {
      const quantity = toNumber(line.quantity || 0);
      const unitPrice = toNumber(line.unit_price || 0);
      const amount = roundMoney(quantity * unitPrice);
      const taxCode = (line.tax_code || 'os') as ApTaxCode;
      const taxRate = toNumber(line.tax_rate ?? AP_TAX_CODES[taxCode]);
      const taxAmount = roundMoney((amount * taxRate) / 100);

      return {
        description: line.description.trim(),
        gl_account_id: line.gl_account_id,
        quantity,
        unit_price: unitPrice,
        amount,
        tax_code: taxCode,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        project_id: line.project_id || null,
      };
    })
    .filter((line) => line.description && line.gl_account_id && line.quantity > 0);

  if (!preparedLines.length) throw new Error('At least one valid line item is required');
  if (!input.supplier_id) throw new Error('Supplier is required');
  if (!input.invoice_date || !input.due_date) throw new Error('Invoice date and due date are required');

  const subtotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.amount, 0));
  const taxTotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.tax_amount, 0));
  const withholdingTax = roundMoney(toNumber(input.withholding_tax || 0));
  const totalAmount = roundMoney(subtotal + taxTotal - withholdingTax);

  const payload = {
    company_id: companyId,
    supplier_id: input.supplier_id,
    supplier_invoice_no: input.supplier_invoice_no?.trim() || null,
    prf_id: input.prf_id || null,
    invoice_date: input.invoice_date,
    due_date: input.due_date,
    currency: (input.currency || 'MYR').trim().toUpperCase(),
    exchange_rate: toNumber(input.exchange_rate || 1),
    subtotal,
    tax_total: taxTotal,
    withholding_tax: withholdingTax,
    total_amount: totalAmount,
    remarks: input.remarks?.trim() || null,
  };

  let invoiceId = input.id;

  if (invoiceId) {
    const { data: current, error: currentError } = await db
      .from('ap_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();
    if (currentError) throw currentError;
    if (!current || current.status !== 'draft') {
      throw new Error('Only draft AP invoices can be edited');
    }

    const { error } = await db
      .from('ap_invoices')
      .update(payload)
      .eq('id', invoiceId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from('ap_invoices')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    invoiceId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('ap_invoice_lines')
    .delete()
    .eq('ap_invoice_id', invoiceId);
  if (deleteError) throw deleteError;

  const { error: insertLinesError } = await db
    .from('ap_invoice_lines')
    .insert(
      preparedLines.map((line) => ({
        ap_invoice_id: invoiceId,
        description: line.description,
        gl_account_id: line.gl_account_id,
        quantity: line.quantity,
        unit_price: roundMoney(line.unit_price),
        amount: line.amount,
        tax_code: line.tax_code,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        project_id: line.project_id,
      })),
    );
  if (insertLinesError) throw insertLinesError;

  return { id: invoiceId };
}

export function useApInvoices(filters: ApInvoiceFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'ap-invoices',
      filters.companyId || 'all',
      filters.status || 'all',
      filters.supplierId || 'all',
      filters.startDate || '',
      filters.endDate || '',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      const companyId = filters.companyId;

      let q = db
        .from('ap_invoices')
        .select(
          `
            *,
            supplier:suppliers!ap_invoices_supplier_id_fkey(id, supplier_code, supplier_name),
            prf:purchase_requisitions!ap_invoices_prf_id_fkey(id, prf_number, purpose),
            lines:ap_invoice_lines(
              *,
              gl_account:chart_of_accounts(id, account_code, account_name),
              project:projects(id, project_code, project_name)
            )
          `,
          { count: 'exact' },
        )
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (companyId) q = q.eq('company_id', companyId);
      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.supplierId && filters.supplierId !== 'all') q = q.eq('supplier_id', filters.supplierId);
      if (filters.startDate) q = q.gte('invoice_date', filters.startDate);
      if (filters.endDate) q = q.lte('invoice_date', filters.endDate);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `invoice_number.ilike.%${search}%,supplier_invoice_no.ilike.%${search}%,remarks.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizeApInvoice);
      const total = count || 0;

      return {
        rows,
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
    enabled: true,
    staleTime: 20 * 1000,
  });
}

export function useCreateApInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertApInvoiceInput) => upsertApInvoice(db, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      toast({ title: 'Created', description: 'AP invoice saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createApInvoice: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useUpdateApInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertApInvoiceInput) => {
      if (!input.id) throw new Error('AP invoice id is required');
      return upsertApInvoice(db, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      toast({ title: 'Saved', description: 'AP invoice updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateApInvoice: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitApInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data: current, error: currentError } = await db
        .from('ap_invoices')
        .select('id, company_id, invoice_number, invoice_date, status')
        .eq('id', input.invoiceId)
        .single();
      if (currentError) throw currentError;
      if (!current || current.status !== 'draft') throw new Error('Only draft AP invoices can be submitted');

      const invoiceNumber = current.invoice_number
        || (await nextDocumentNumber(db, current.company_id, 'INV', current.invoice_date));

      const { data, error } = await db
        .from('ap_invoices')
        .update({
          invoice_number: invoiceNumber,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', input.invoiceId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('AP invoice was already updated by another user');
      return { invoice_number: invoiceNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      toast({ title: 'Submitted', description: 'AP invoice submitted for approval' });
      createFinanceNotification('ap_invoice_submitted', data.invoice_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitApInvoice: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useApproveApInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data, error } = await db
        .from('ap_invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.invoiceId)
        .eq('status', 'pending')
        .select('id, invoice_number')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only pending AP invoices can be approved');
      return data as { id: string; invoice_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      toast({ title: 'Approved', description: 'AP invoice approved' });
      createFinanceNotification('ap_invoice_approved', data.invoice_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveApInvoice: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function usePostApInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data: invoiceRaw, error: invoiceError } = await db
        .from('ap_invoices')
        .select(
          `
            *,
            supplier:suppliers!ap_invoices_supplier_id_fkey(id, supplier_code, supplier_name),
            lines:ap_invoice_lines(*)
          `,
        )
        .eq('id', input.invoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      const invoice = normalizeApInvoice(invoiceRaw);
      if (invoice.status !== 'approved') throw new Error('Only approved AP invoices can be posted');
      if (invoice.journal_entry_id) throw new Error('Invoice is already posted to GL');
      if (!(invoice.lines || []).length) throw new Error('Invoice has no lines to post');

      const { data: tradePayables, error: tradePayablesError } = await db
        .from('chart_of_accounts')
        .select('id')
        .eq('system_tag', 'trade_payables')
        .eq('is_active', true)
        .maybeSingle();
      if (tradePayablesError) throw tradePayablesError;
      if (!tradePayables?.id) throw new Error('Missing chart of account mapping for trade_payables');

      const debitLines = (invoice.lines || []).map((line) => ({
        account_id: line.gl_account_id,
        description: line.description,
        debit_amount: roundMoney(toNumber(line.amount) + toNumber(line.tax_amount)),
        credit_amount: 0,
        project_id: line.project_id || null,
      }));

      const totalDebit = roundMoney(debitLines.reduce((sum, line) => sum + toNumber(line.debit_amount), 0));
      if (totalDebit <= 0) throw new Error('Invoice total must be greater than zero to post');

      const posting = await createGLPosting({
        company_id: invoice.company_id,
        entry_date: invoice.invoice_date,
        description: `AP invoice ${invoice.invoice_number || invoice.id}`,
        reference_type: 'ap_invoice',
        reference_id: invoice.id,
        prefix: 'INV',
        lines: [
          ...debitLines,
          {
            account_id: tradePayables.id,
            description: invoice.remarks || `AP invoice ${invoice.invoice_number || invoice.id}`,
            debit_amount: 0,
            credit_amount: totalDebit,
          },
        ],
      });

      const { error: updateError } = await db
        .from('ap_invoices')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          journal_entry_id: posting.journal_entry_id,
          total_amount: totalDebit,
        })
        .eq('id', invoice.id);
      if (updateError) throw updateError;
      return { invoice_number: invoice.invoice_number || invoice.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Posted', description: 'AP invoice posted to GL' });
      createFinanceNotification('ap_invoice_posted', data.invoice_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postApInvoice: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

export interface PaymentVoucherFilters {
  companyId?: string;
  status?: ApPvStatus | 'all';
  supplierId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentVoucherAllocationInput {
  ap_invoice_id: string;
  allocated_amount: number;
}

export interface PaymentVoucherLineInput {
  line_date: string;
  description: string;
  cheque_no?: string | null;
  amount: number;
  gl_account_id?: string | null;
}

export interface UpsertPaymentVoucherInput {
  id?: string;
  company_id?: string | null;
  supplier_id?: string | null;
  bank_account_id: string;
  payment_date: string;
  payment_method?: ApPaymentMethod;
  payment_method_other?: string | null;
  reference_no?: string | null;
  pay_to?: string | null;
  pay_for?: string | null;
  is_recurring?: boolean;
  remarks?: string | null;
  prf_id?: string | null;
  attachment_urls?: string[];
  priority?: 'normal' | 'urgent';
  target_approval_level?: 'fa' | 'asst_mgr' | 'dmd';
  allocations?: PaymentVoucherAllocationInput[];
  lines?: PaymentVoucherLineInput[];
}

export function usePaymentVouchers(filters: PaymentVoucherFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'payment-vouchers',
      filters.companyId || 'all',
      filters.status || 'all',
      filters.supplierId || 'all',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      let q = db
        .from('payment_vouchers')
        .select(
          `
            *,
            supplier:suppliers!payment_vouchers_supplier_id_fkey(id, supplier_code, supplier_name),
            bank_account:bank_accounts!payment_vouchers_bank_account_id_fkey(id, account_code, account_name, bank_name, gl_account_id),
            allocations:payment_voucher_allocations(
              *,
              ap_invoice:ap_invoices(id, invoice_number, total_amount, paid_amount, status)
            ),
            lines:payment_voucher_lines(
              *,
              gl_account:chart_of_accounts!gl_account_id(id, account_code, account_name)
            )
          `,
          { count: 'exact' },
        )
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.companyId) {
        q = q.eq('company_id', filters.companyId);
      }

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.supplierId && filters.supplierId !== 'all') q = q.eq('supplier_id', filters.supplierId);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `pv_number.ilike.%${search}%,reference_no.ilike.%${search}%,remarks.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizePv);
      const total = count || 0;

      return {
        rows,
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
    enabled: true,
    staleTime: 20 * 1000,
  });
}

async function upsertPaymentVoucher(db: any, input: UpsertPaymentVoucherInput, createNumber: boolean): Promise<{ id: string }> {
  const companyId = await resolveCompanyId(db, input.company_id);
  if (!input.bank_account_id) throw new Error('Bank account is required');
  if (!input.payment_date) throw new Error('Payment date is required');

  const allocations = (input.allocations || [])
    .map((allocation) => ({
      ap_invoice_id: allocation.ap_invoice_id,
      allocated_amount: roundMoney(toNumber(allocation.allocated_amount)),
    }))
    .filter((allocation) => allocation.ap_invoice_id && allocation.allocated_amount > 0);

  const lines = (input.lines || [])
    .map((line, index) => ({
      line_date: line.line_date,
      description: (line.description || '').trim(),
      cheque_no: line.cheque_no?.trim() || null,
      amount: roundMoney(toNumber(line.amount)),
      sort_order: index,
      gl_account_id: line.gl_account_id || null,
    }))
    .filter((line) => line.amount > 0 || line.description);

  if (!allocations.length && !lines.length) throw new Error('Add at least one line item or invoice allocation');

  const allocationTotal = roundMoney(allocations.reduce((sum, a) => sum + a.allocated_amount, 0));
  const lineTotal = roundMoney(lines.reduce((sum, l) => sum + l.amount, 0));
  const totalAmount = roundMoney(allocationTotal + lineTotal);
  if (totalAmount <= 0) throw new Error('Total amount must be greater than zero');

  let pvId = input.id;

  if (pvId) {
    const { data: current, error: currentError } = await db
      .from('payment_vouchers')
      .select('id, status')
      .eq('id', pvId)
      .single();
    if (currentError) throw currentError;
    if (!current || current.status !== 'draft') {
      throw new Error('Only draft payment vouchers can be edited');
    }
  }

  const payload = {
    company_id: companyId,
    supplier_id: input.supplier_id || null,
    bank_account_id: input.bank_account_id,
    payment_date: input.payment_date,
    payment_method: (input.payment_method || 'online_transfer') as ApPaymentMethod,
    payment_method_other: input.payment_method_other?.trim() || null,
    reference_no: input.reference_no?.trim() || null,
    pay_to: input.pay_to?.trim() || null,
    pay_for: input.pay_for?.trim() || null,
    is_recurring: input.is_recurring ?? false,
    remarks: input.remarks?.trim() || null,
    prf_id: input.prf_id || null,
    attachment_urls: input.attachment_urls || [],
    priority: input.priority || 'normal',
    target_approval_level: input.target_approval_level || 'dmd',
    total_amount: totalAmount,
  };

  if (pvId) {
    const { error } = await db
      .from('payment_vouchers')
      .update(payload)
      .eq('id', pvId);
    if (error) throw error;
  } else {
    const pvNumber = createNumber
      ? await nextDocumentNumber(db, companyId, 'PV', input.payment_date)
      : null;

    const { data, error } = await db
      .from('payment_vouchers')
      .insert({
        ...payload,
        pv_number: pvNumber,
      })
      .select('id')
      .single();
    if (error) throw error;
    pvId = data.id as string;
  }

  // Upsert allocations
  const { error: deleteAllocError } = await db
    .from('payment_voucher_allocations')
    .delete()
    .eq('pv_id', pvId);
  if (deleteAllocError) throw deleteAllocError;

  if (allocations.length) {
    const { error: insertAllocError } = await db
      .from('payment_voucher_allocations')
      .insert(
        allocations.map((allocation) => ({
          pv_id: pvId,
          ap_invoice_id: allocation.ap_invoice_id,
          allocated_amount: allocation.allocated_amount,
        })),
      );
    if (insertAllocError) throw insertAllocError;
  }

  // Upsert lines
  const { error: deleteLinesError } = await db
    .from('payment_voucher_lines')
    .delete()
    .eq('pv_id', pvId);
  if (deleteLinesError) throw deleteLinesError;

  if (lines.length) {
    const { error: insertLinesError } = await db
      .from('payment_voucher_lines')
      .insert(
        lines.map((line) => ({
          pv_id: pvId,
          line_date: line.line_date,
          description: line.description,
          cheque_no: line.cheque_no,
          amount: line.amount,
          sort_order: line.sort_order,
          gl_account_id: line.gl_account_id,
        })),
      );
    if (insertLinesError) throw insertLinesError;
  }

  return { id: pvId };
}

export function useCreatePaymentVoucher() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertPaymentVoucherInput) => upsertPaymentVoucher(db, input, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({ title: 'Created', description: 'Payment voucher saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createPaymentVoucher: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useUpdatePaymentVoucher() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertPaymentVoucherInput) => {
      if (!input.id) throw new Error('Payment voucher id is required');
      return upsertPaymentVoucher(db, input, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({ title: 'Saved', description: 'Payment voucher updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updatePaymentVoucher: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitPV() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string }) => {
      // Look up target_approval_level to decide what status to land on
      const { data: pvCurrent, error: lookupError } = await db
        .from('payment_vouchers')
        .select('id, status, target_approval_level')
        .eq('id', input.pvId)
        .single();
      if (lookupError) throw lookupError;
      if (!pvCurrent || pvCurrent.status !== 'draft') {
        throw new Error('Only draft payment vouchers can be submitted');
      }

      const target = pvCurrent.target_approval_level || 'dmd';
      const now = new Date().toISOString();

      // FA-only: jump straight to 'approved' on submit (no AM, no DMD).
      // FA→AM: 'pending' (waits for AM check, which will jump to 'approved').
      // FA→AM→DMD: 'pending' as before.
      const updateFields: Record<string, string> = {
        status: target === 'fa' ? 'approved' : 'pending',
        submitted_at: now,
      };
      if (target === 'fa') {
        updateFields.approved_at = now;
      }

      const { data, error } = await db
        .from('payment_vouchers')
        .update(updateFields)
        .eq('id', input.pvId)
        .eq('status', 'draft')
        .select('id, pv_number, target_approval_level')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only draft payment vouchers can be submitted');
      return data as { id: string; pv_number: string; target_approval_level: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      const msg = data.target_approval_level === 'fa'
        ? 'Self-approved (FA-only routing)'
        : 'Payment voucher submitted for approval';
      toast({ title: 'Submitted', description: msg });
      createFinanceNotification('pv_submitted', data.pv_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitPV: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useCheckPV() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string }) => {
      const { data: pvCurrent, error: lookupError } = await db
        .from('payment_vouchers')
        .select('id, status, target_approval_level')
        .eq('id', input.pvId)
        .single();
      if (lookupError) throw lookupError;
      if (!pvCurrent || pvCurrent.status !== 'pending') {
        throw new Error('Only pending payment vouchers can be checked');
      }

      const target = pvCurrent.target_approval_level || 'dmd';
      const now = new Date().toISOString();

      // FA→AM (target='asst_mgr'): AM check is the final approval — jump to 'approved'.
      // FA→AM→DMD (target='dmd'): land on 'checked' to wait for DMD.
      const updateFields: Record<string, string> = {
        status: target === 'asst_mgr' ? 'approved' : 'checked',
        checked_at: now,
      };
      if (target === 'asst_mgr') {
        updateFields.approved_at = now;
      }

      const { data, error } = await db
        .from('payment_vouchers')
        .update(updateFields)
        .eq('id', input.pvId)
        .eq('status', 'pending')
        .select('id, pv_number, target_approval_level')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only pending payment vouchers can be checked');
      return data as { id: string; pv_number: string; target_approval_level: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      const msg = data.target_approval_level === 'asst_mgr'
        ? 'Approved (FA→AM routing)'
        : 'Payment voucher checked and forwarded for approval';
      toast({ title: 'Checked', description: msg });
      createFinanceNotification('pv_checked', data.pv_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    checkPV: mutation.mutateAsync,
    isChecking: mutation.isPending,
  };
}

export function useApprovePV() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string }) => {
      const { data, error } = await db
        .from('payment_vouchers')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.pvId)
        .eq('status', 'checked')
        .select('id, pv_number')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only checked payment vouchers can be approved');
      return data as { id: string; pv_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({ title: 'Approved', description: 'Payment voucher approved' });
      createFinanceNotification('pv_approved', data.pv_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approvePV: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function useRejectPV() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string; remarks: string }) => {
      const userId = await getCurrentUserId();

      const { data: current, error: currentError } = await db
        .from('payment_vouchers')
        .select('id, status')
        .eq('id', input.pvId)
        .single();
      if (currentError) throw currentError;

      const rejectableStatuses = ['pending', 'checked'];
      if (!current || !rejectableStatuses.includes(current.status)) {
        throw new Error('Only pending or checked payment vouchers can be rejected');
      }

      const { data, error } = await db
        .from('payment_vouchers')
        .update({
          status: 'rejected',
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          rejection_remarks: input.remarks,
          rejection_stage: current.status,
        })
        .eq('id', input.pvId)
        .in('status', rejectableStatuses)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Payment voucher was already updated by another user');

      const { data: pv } = await db.from('payment_vouchers').select('pv_number').eq('id', input.pvId).single();
      return pv as { pv_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({ title: 'Rejected', description: 'Payment voucher has been rejected' });
      createFinanceNotification('pv_rejected', data?.pv_number || '');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    rejectPV: mutation.mutateAsync,
    isRejecting: mutation.isPending,
  };
}

export function useMarkPVPaid() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();

  const mutation = useMutation({
    mutationFn: async (input: { pvIds: string[] }) => {
      if (!input.pvIds.length) throw new Error('No payment vouchers selected');

      const { data, error } = await db
        .from('payment_vouchers')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: profile?.id,
        })
        .in('id', input.pvIds)
        .eq('status', 'approved')
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('No approved payment vouchers found to mark as paid');

      const { data: pvs } = await db.from('payment_vouchers').select('pv_number').in('id', input.pvIds);
      return { count: data.length, pvNumbers: (pvs || []).map((p: any) => p.pv_number) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({
        title: 'Marked as Paid',
        description: `${data.count} payment voucher(s) marked as paid`,
      });
      for (const pvNum of data.pvNumbers) {
        createFinanceNotification('pv_paid', pvNum);
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    markPaid: mutation.mutateAsync,
    isMarkingPaid: mutation.isPending,
  };
}

export function usePostPV() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string; postToType: PvPostToType }) => {
      const { data: pvRaw, error: pvError } = await db
        .from('payment_vouchers')
        .select(
          `
            *,
            bank_account:bank_accounts!payment_vouchers_bank_account_id_fkey(id, account_code, account_name, gl_account_id),
            allocations:payment_voucher_allocations(
              id,
              ap_invoice_id,
              allocated_amount,
              ap_invoice:ap_invoices(id, invoice_number, total_amount, paid_amount, status)
            ),
            lines:payment_voucher_lines(*)
          `,
        )
        .eq('id', input.pvId)
        .single();
      if (pvError) throw pvError;

      const voucher = normalizePv(pvRaw);
      if (voucher.status !== 'paid') throw new Error('Only paid payment vouchers can be posted');
      if (voucher.journal_entry_id) throw new Error('Payment voucher is already posted to GL');

      const allocations = voucher.allocations || [];
      const lines = voucher.lines || [];
      if (!allocations.length && !lines.length) throw new Error('Payment voucher has no allocations or lines');

      const { data: tradePayables, error: tradePayablesError } = await db
        .from('chart_of_accounts')
        .select('id')
        .eq('system_tag', 'trade_payables')
        .eq('is_active', true)
        .maybeSingle();
      if (tradePayablesError) throw tradePayablesError;
      if (!tradePayables?.id) throw new Error('Missing chart of account mapping for trade_payables');

      const bankGlAccountId = voucher.bank_account?.gl_account_id;
      if (!bankGlAccountId) throw new Error('Selected bank account is not linked to a GL account');

      let totalAllocated = 0;

      // Validate allocations if present (invoice-linked PVs)
      for (const allocation of allocations) {
        const invoice = allocation.ap_invoice;
        if (!invoice) throw new Error('Allocation references a missing invoice');

        if (!['posted', 'partially_paid'].includes(invoice.status)) {
          throw new Error(`Invoice ${invoice.invoice_number || invoice.id} is not available for payment`);
        }

        const outstanding = roundMoney(toNumber(invoice.total_amount) - toNumber(invoice.paid_amount));
        const amount = roundMoney(toNumber(allocation.allocated_amount));

        if (amount <= 0) throw new Error('Allocation amount must be greater than zero');
        if (amount > outstanding + 0.0001) {
          throw new Error(`Allocation for invoice ${invoice.invoice_number || invoice.id} exceeds outstanding balance`);
        }

        totalAllocated = roundMoney(totalAllocated + amount);
      }

      // For lines-only PVs (e.g. payroll), use the PV total_amount
      if (!allocations.length) {
        totalAllocated = roundMoney(toNumber(voucher.total_amount));
        if (totalAllocated <= 0) throw new Error('Payment voucher total amount must be greater than zero');
      }

      const pvRef = voucher.pv_number || voucher.id;
      const payFor = voucher.pay_for ? ` - ${voucher.pay_for}` : '';
      const cbDescription = `Payment Voucher ${pvRef}${payFor}`;

      // Build debit lines:
      //  - allocation-linked PVs debit trade_payables (invoice already debited the expense GL)
      //  - lines-only PVs debit each line's gl_account_id (or fall back to trade_payables if missing)
      const debitLines: Array<{ account_id: string; description: string; debit_amount: number; credit_amount: number }> = [];

      if (allocations.length) {
        debitLines.push({
          account_id: tradePayables.id,
          description: cbDescription,
          debit_amount: totalAllocated,
          credit_amount: 0,
        });
      } else {
        for (const line of lines) {
          const lineAmount = roundMoney(toNumber(line.amount));
          if (lineAmount <= 0) continue;
          const accountId = line.gl_account_id || tradePayables.id;
          debitLines.push({
            account_id: accountId,
            description: line.description || cbDescription,
            debit_amount: lineAmount,
            credit_amount: 0,
          });
        }
      }

      const posting = await createGLPosting({
        company_id: voucher.company_id,
        entry_date: voucher.payment_date,
        description: cbDescription,
        reference_type: 'payment_voucher',
        reference_id: voucher.id,
        prefix: 'CB',
        lines: [
          ...debitLines,
          {
            account_id: bankGlAccountId,
            description: voucher.reference_no || cbDescription,
            debit_amount: 0,
            credit_amount: totalAllocated,
          },
        ],
      });

      const { error: voucherUpdateError } = await db
        .from('payment_vouchers')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          journal_entry_id: posting.journal_entry_id,
          total_amount: totalAllocated,
          post_to_type: input.postToType,
        })
        .eq('id', voucher.id);
      if (voucherUpdateError) throw voucherUpdateError;

      // Update AP invoice paid amounts (only for allocation-linked PVs)
      for (const allocation of allocations) {
        const invoice = allocation.ap_invoice;
        if (!invoice) continue;

        const currentPaid = roundMoney(toNumber(invoice.paid_amount));
        const totalAmount = roundMoney(toNumber(invoice.total_amount));
        const newPaid = roundMoney(currentPaid + toNumber(allocation.allocated_amount));

        const nextStatus: ApInvoiceStatus = newPaid >= totalAmount - 0.0001 ? 'paid' : 'partially_paid';

        const { error: invoiceUpdateError } = await db
          .from('ap_invoices')
          .update({
            paid_amount: newPaid,
            status: nextStatus,
          })
          .eq('id', invoice.id);

        if (invoiceUpdateError) throw invoiceUpdateError;
      }

      return { pv_number: voucher.pv_number || voucher.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      queryClient.invalidateQueries({ queryKey: ['ap-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Posted', description: 'Payment voucher posted to GL' });
      createFinanceNotification('pv_posted', data.pv_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postPV: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

// ─── Change Post Type ────────────────────────────────────────────────────────

export function useChangePostType() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { pvId: string; newPostType: PvPostToType; reason?: string }) => {
      // Fetch current PV
      const { data: pv, error: pvError } = await db
        .from('payment_vouchers')
        .select('id, pv_number, status, post_to_type')
        .eq('id', input.pvId)
        .single();
      if (pvError) throw pvError;

      if (pv.status !== 'posted') throw new Error('Only posted payment vouchers can have their post type changed');
      if (!pv.post_to_type) throw new Error('Payment voucher has no current post type');
      if (pv.post_to_type === input.newPostType) return null;

      const oldType = pv.post_to_type as string;

      // Update PV post_to_type
      const { error: updateError } = await db
        .from('payment_vouchers')
        .update({ post_to_type: input.newPostType })
        .eq('id', input.pvId);
      if (updateError) throw updateError;

      // Insert audit record
      const { error: auditError } = await db
        .from('pv_post_type_audit')
        .insert({
          pv_id: input.pvId,
          old_post_type: oldType,
          new_post_type: input.newPostType,
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          reason: input.reason?.trim() || null,
        });
      if (auditError) throw auditError;

      return { pvNumber: pv.pv_number, oldType, newType: input.newPostType };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      if (result) {
        toast({
          title: 'Post type changed',
          description: `${result.pvNumber} changed from ${PV_POST_TO_LABELS[result.oldType as PvPostToType] || result.oldType} to ${PV_POST_TO_LABELS[result.newType as PvPostToType] || result.newType}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    changePostType: mutation.mutate,
    isChanging: mutation.isPending,
  };
}

export function usePostTypeAudit(pvId: string | undefined) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['pv-post-type-audit', pvId || 'none'],
    queryFn: async () => {
      const { data, error } = await db
        .from('pv_post_type_audit')
        .select('id, old_post_type, new_post_type, reason, created_at, changed_by')
        .eq('pv_id', pvId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as {
        id: string;
        old_post_type: string;
        new_post_type: string;
        reason: string | null;
        created_at: string;
        changed_by: string;
      }[];
    },
    enabled: !!pvId,
    staleTime: 30 * 1000,
  });
}

// ─── AP Payments ─────────────────────────────────────────────────────────────

const AP_PAYMENT_PAGE_SIZE = 20;

export interface ApPaymentFilters {
  companyId?: string;
  status?: string;
  search?: string;
  page?: number;
}

export function useApPayments(filters: ApPaymentFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;

  return useQuery({
    queryKey: ['ap-payments', filters],
    queryFn: async () => {
      let q = db
        .from('ap_payments')
        .select(
          `*, bank_account:bank_accounts(id, account_code, account_name, bank_name, gl_account_id), allocations:ap_payment_allocations(*, payment_voucher:payment_vouchers(id, pv_number, total_amount, status, supplier:suppliers(id, supplier_code, supplier_name)))`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false });

      if (filters.companyId) q = q.eq('company_id', filters.companyId);
      if (filters.status) q = q.eq('status', filters.status);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(`payment_number.ilike.%${search}%,reference_no.ilike.%${search}%`);
      }

      q = q.range((page - 1) * AP_PAYMENT_PAGE_SIZE, page * AP_PAYMENT_PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const total = count || 0;
      return {
        data: (data || []) as any[],
        total,
        page,
        pageSize: AP_PAYMENT_PAGE_SIZE,
      };
    },
    staleTime: 20 * 1000,
  });
}

export interface CreateApPaymentInput {
  company_id: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: string;
  reference_no?: string;
  remarks?: string;
  allocations: Record<string, string>; // pv_id -> amount string
}

export function useCreateApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: CreateApPaymentInput) => {
      const companyId = await resolveCompanyId(db, input.company_id);
      const paymentNumber = await nextDocumentNumber(db, companyId, 'APP', input.payment_date);
      const totalAmount = roundMoney(
        Object.values(input.allocations).reduce((s, v) => s + toNumber(v), 0),
      );

      const { data, error } = await db
        .from('ap_payments')
        .insert({
          company_id: companyId,
          bank_account_id: input.bank_account_id,
          payment_date: input.payment_date,
          payment_method: input.payment_method,
          reference_no: input.reference_no?.trim() || null,
          remarks: input.remarks?.trim() || null,
          payment_number: paymentNumber,
          total_amount: totalAmount,
          status: 'draft',
        })
        .select('id')
        .single();
      if (error) throw error;

      const apPaymentId = data.id as string;

      const allocationRows = Object.entries(input.allocations)
        .map(([pvId, amount]) => ({ ap_payment_id: apPaymentId, pv_id: pvId, allocated_amount: roundMoney(toNumber(amount)) }))
        .filter((r) => r.allocated_amount > 0);

      if (allocationRows.length) {
        const { error: allocError } = await db.from('ap_payment_allocations').insert(allocationRows);
        if (allocError) throw allocError;
      }

      return { id: apPaymentId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Created', description: 'AP payment saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createApPayment: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export interface UpdateApPaymentInput extends CreateApPaymentInput {
  id: string;
}

export function useUpdateApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpdateApPaymentInput) => {
      const userId = await getCurrentUserId();
      const totalAmount = roundMoney(
        Object.values(input.allocations).reduce((s, v) => s + toNumber(v), 0),
      );

      const { error } = await db
        .from('ap_payments')
        .update({
          bank_account_id: input.bank_account_id,
          payment_date: input.payment_date,
          payment_method: input.payment_method,
          reference_no: input.reference_no?.trim() || null,
          remarks: input.remarks?.trim() || null,
          total_amount: totalAmount,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', input.id);
      if (error) throw error;

      const { error: deleteError } = await db
        .from('ap_payment_allocations')
        .delete()
        .eq('ap_payment_id', input.id);
      if (deleteError) throw deleteError;

      const allocationRows = Object.entries(input.allocations)
        .map(([pvId, amount]) => ({ ap_payment_id: input.id, pv_id: pvId, allocated_amount: roundMoney(toNumber(amount)) }))
        .filter((r) => r.allocated_amount > 0);

      if (allocationRows.length) {
        const { error: allocError } = await db.from('ap_payment_allocations').insert(allocationRows);
        if (allocError) throw allocError;
      }

      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Saved', description: 'AP payment updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateApPayment: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db
        .from('ap_payments')
        .update({ status: 'pending', submitted_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, payment_number')
        .single();
      if (error) throw error;
      return data as { id: string; payment_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Submitted', description: 'AP payment submitted for approval' });
      createFinanceNotification('ap_payment_submitted', data.payment_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitApPayment: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useCheckApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db
        .from('ap_payments')
        .update({ status: 'checked', checked_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, payment_number')
        .single();
      if (error) throw error;
      return data as { id: string; payment_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Checked', description: 'AP payment checked' });
      createFinanceNotification('ap_payment_checked', data.payment_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    checkApPayment: mutation.mutateAsync,
    isChecking: mutation.isPending,
  };
}

export function useApproveApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db
        .from('ap_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, payment_number')
        .single();
      if (error) throw error;
      return data as { id: string; payment_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Approved', description: 'AP payment approved' });
      createFinanceNotification('ap_payment_approved', data.payment_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveApPayment: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function usePostApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: payment, error: updateError } = await db
        .from('ap_payments')
        .update({ status: 'posted', posted_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, payment_number')
        .single();
      if (updateError) throw updateError;

      const { data: allocations, error: allocError } = await db
        .from('ap_payment_allocations')
        .select('pv_id')
        .eq('ap_payment_id', id);
      if (allocError) throw allocError;

      for (const allocation of (allocations || []) as any[]) {
        const { error: pvError } = await db
          .from('payment_vouchers')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', allocation.pv_id);
        if (pvError) throw pvError;
      }

      return payment as { id: string; payment_number: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['prf-outstanding-balances'] });
      toast({ title: 'Posted', description: 'AP payment posted' });
      createFinanceNotification('ap_payment_posted', data.payment_number);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postApPayment: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

export function useDeleteApPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('ap_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-payments'] });
      toast({ title: 'Deleted', description: 'AP payment deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    deleteApPayment: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
}
