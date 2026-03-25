/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { createGLPosting } from '@/hooks/finance/useGeneralLedger';
import { AR_TAX_CODES } from '@/types/finance';
import type {
  ArInvoice,
  ArInvoiceLine,
  ArInvoiceStatus,
  ArPaymentMethod,
  ArReceiptStatus,
  ArTaxCode,
  OfficialReceipt,
  OfficialReceiptAllocation,
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

function normalizeArInvoiceLine(line: any): ArInvoiceLine {
  return {
    ...line,
    quantity: toNumber(line.quantity),
    unit_price: toNumber(line.unit_price),
    amount: toNumber(line.amount),
    tax_rate: toNumber(line.tax_rate),
    tax_amount: toNumber(line.tax_amount),
  };
}

function normalizeArInvoice(row: any): ArInvoice {
  return {
    ...row,
    exchange_rate: toNumber(row.exchange_rate),
    subtotal: toNumber(row.subtotal),
    tax_total: toNumber(row.tax_total),
    total_amount: toNumber(row.total_amount),
    paid_amount: toNumber(row.paid_amount),
    lines: ((row.lines || []) as any[]).map(normalizeArInvoiceLine),
  };
}

function normalizeAllocation(row: any): OfficialReceiptAllocation {
  return {
    ...row,
    allocated_amount: toNumber(row.allocated_amount),
    ar_invoice: row.ar_invoice
      ? {
          ...row.ar_invoice,
          total_amount: toNumber(row.ar_invoice.total_amount),
          paid_amount: toNumber(row.ar_invoice.paid_amount),
        }
      : null,
  };
}

function normalizeOfficialReceipt(row: any): OfficialReceipt {
  return {
    ...row,
    total_amount: toNumber(row.total_amount),
    allocations: ((row.allocations || []) as any[]).map(normalizeAllocation),
  };
}

export interface ArInvoiceFilters {
  companyId?: string;
  status?: ArInvoiceStatus | 'all';
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ArInvoiceLineInput {
  description: string;
  gl_account_id: string;
  quantity?: number;
  unit_price?: number;
  tax_code?: ArTaxCode;
  tax_rate?: number;
  project_id?: string | null;
}

export interface UpsertArInvoiceInput {
  id?: string;
  company_id?: string | null;
  customer_id: string;
  sales_order_ref?: string | null;
  invoice_date: string;
  due_date: string;
  currency?: string;
  exchange_rate?: number;
  remarks?: string | null;
  lines: ArInvoiceLineInput[];
}

async function upsertArInvoice(db: any, input: UpsertArInvoiceInput): Promise<{ id: string }> {
  const companyId = await resolveCompanyId(db, input.company_id);

  const preparedLines = (input.lines || [])
    .map((line) => {
      const quantity = toNumber(line.quantity || 0);
      const unitPrice = toNumber(line.unit_price || 0);
      const amount = roundMoney(quantity * unitPrice);
      const taxCode = (line.tax_code || 'os') as ArTaxCode;
      const taxRate = toNumber(line.tax_rate ?? AR_TAX_CODES[taxCode]);
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
  if (!input.customer_id) throw new Error('Customer is required');
  if (!input.invoice_date || !input.due_date) throw new Error('Invoice date and due date are required');

  const subtotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.amount, 0));
  const taxTotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.tax_amount, 0));
  const totalAmount = roundMoney(subtotal + taxTotal);

  const payload = {
    company_id: companyId,
    customer_id: input.customer_id,
    sales_order_ref: input.sales_order_ref?.trim() || null,
    invoice_date: input.invoice_date,
    due_date: input.due_date,
    currency: (input.currency || 'MYR').trim().toUpperCase(),
    exchange_rate: toNumber(input.exchange_rate || 1),
    subtotal,
    tax_total: taxTotal,
    total_amount: totalAmount,
    remarks: input.remarks?.trim() || null,
  };

  let invoiceId = input.id;

  if (invoiceId) {
    const { data: current, error: currentError } = await db
      .from('ar_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();
    if (currentError) throw currentError;
    if (!current || current.status !== 'draft') {
      throw new Error('Only draft AR invoices can be edited');
    }

    const { error } = await db
      .from('ar_invoices')
      .update(payload)
      .eq('id', invoiceId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from('ar_invoices')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    invoiceId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('ar_invoice_lines')
    .delete()
    .eq('ar_invoice_id', invoiceId);
  if (deleteError) throw deleteError;

  const { error: insertLinesError } = await db
    .from('ar_invoice_lines')
    .insert(
      preparedLines.map((line) => ({
        ar_invoice_id: invoiceId,
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

export function useArInvoices(filters: ArInvoiceFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'ar-invoices',
      filters.companyId || 'all',
      filters.status || 'all',
      filters.customerId || 'all',
      filters.startDate || '',
      filters.endDate || '',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      const companyId = filters.companyId;

      let q = db
        .from('ar_invoices')
        .select(
          `
            *,
            customer:customers!ar_invoices_customer_id_fkey(id, customer_code, customer_name),
            lines:ar_invoice_lines(
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
      if (filters.customerId && filters.customerId !== 'all') q = q.eq('customer_id', filters.customerId);
      if (filters.startDate) q = q.gte('invoice_date', filters.startDate);
      if (filters.endDate) q = q.lte('invoice_date', filters.endDate);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `invoice_number.ilike.%${search}%,sales_order_ref.ilike.%${search}%,remarks.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizeArInvoice);
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

export function useCreateArInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertArInvoiceInput) => upsertArInvoice(db, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      toast({ title: 'Created', description: 'AR invoice saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createArInvoice: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useUpdateArInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertArInvoiceInput) => {
      if (!input.id) throw new Error('AR invoice id is required');
      return upsertArInvoice(db, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      toast({ title: 'Saved', description: 'AR invoice updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateArInvoice: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitArInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data: current, error: currentError } = await db
        .from('ar_invoices')
        .select('id, company_id, invoice_number, invoice_date, status')
        .eq('id', input.invoiceId)
        .single();
      if (currentError) throw currentError;
      if (!current || current.status !== 'draft') throw new Error('Only draft AR invoices can be submitted');

      const invoiceNumber = current.invoice_number
        || (await nextDocumentNumber(db, current.company_id, 'ARINV', current.invoice_date));

      const { data, error } = await db
        .from('ar_invoices')
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
      if (!data) throw new Error('AR invoice was already updated by another user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      toast({ title: 'Submitted', description: 'AR invoice submitted for approval' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitArInvoice: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useApproveArInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data, error } = await db
        .from('ar_invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.invoiceId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only pending AR invoices can be approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      toast({ title: 'Approved', description: 'AR invoice approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveArInvoice: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function usePostArInvoice() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { invoiceId: string }) => {
      const { data: invoiceRaw, error: invoiceError } = await db
        .from('ar_invoices')
        .select(
          `
            *,
            customer:customers!ar_invoices_customer_id_fkey(id, customer_code, customer_name),
            lines:ar_invoice_lines(*)
          `,
        )
        .eq('id', input.invoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      const invoice = normalizeArInvoice(invoiceRaw);
      if (invoice.status !== 'approved') throw new Error('Only approved AR invoices can be posted');
      if (invoice.journal_entry_id) throw new Error('Invoice is already posted to GL');
      if (!(invoice.lines || []).length) throw new Error('Invoice has no lines to post');

      const { data: tradeReceivables, error: tradeReceivablesError } = await db
        .from('chart_of_accounts')
        .select('id')
        .eq('system_tag', 'trade_receivables')
        .eq('is_active', true)
        .maybeSingle();
      if (tradeReceivablesError) throw tradeReceivablesError;
      if (!tradeReceivables?.id) throw new Error('Missing chart of account mapping for trade_receivables');

      const creditLines = (invoice.lines || []).map((line) => ({
        account_id: line.gl_account_id,
        description: line.description,
        debit_amount: 0,
        credit_amount: roundMoney(toNumber(line.amount) + toNumber(line.tax_amount)),
        project_id: line.project_id || null,
      }));

      const totalCredit = roundMoney(creditLines.reduce((sum, line) => sum + toNumber(line.credit_amount), 0));
      if (totalCredit <= 0) throw new Error('Invoice total must be greater than zero to post');

      const posting = await createGLPosting({
        company_id: invoice.company_id,
        entry_date: invoice.invoice_date,
        description: `AR invoice ${invoice.invoice_number || invoice.id}`,
        reference_type: 'ar_invoice',
        reference_id: invoice.id,
        prefix: 'ARINV',
        lines: [
          {
            account_id: tradeReceivables.id,
            description: invoice.remarks || `AR invoice ${invoice.invoice_number || invoice.id}`,
            debit_amount: totalCredit,
            credit_amount: 0,
          },
          ...creditLines,
        ],
      });

      const { error: updateError } = await db
        .from('ar_invoices')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          journal_entry_id: posting.journal_entry_id,
          total_amount: totalCredit,
        })
        .eq('id', invoice.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Posted', description: 'AR invoice posted to GL' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postArInvoice: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

export interface OfficialReceiptFilters {
  companyId?: string;
  status?: ArReceiptStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface OfficialReceiptAllocationInput {
  ar_invoice_id: string;
  allocated_amount: number;
}

export interface UpsertOfficialReceiptInput {
  id?: string;
  company_id?: string | null;
  received_from: string;
  bank_account_id: string;
  receipt_date: string;
  payment_method?: ArPaymentMethod;
  reference_no?: string | null;
  remarks?: string | null;
  allocations: OfficialReceiptAllocationInput[];
}

export function useOfficialReceipts(filters: OfficialReceiptFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'official-receipts',
      filters.companyId || 'all',
      filters.status || 'all',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      const companyId = filters.companyId;

      let q = db
        .from('official_receipts')
        .select(
          `
            *,
            customer:customers!official_receipts_customer_id_fkey(id, customer_code, customer_name),
            bank_account:bank_accounts!official_receipts_bank_account_id_fkey(id, account_code, account_name, bank_name, gl_account_id),
            allocations:official_receipt_allocations(
              *,
              ar_invoice:ar_invoices(id, invoice_number, total_amount, paid_amount, status)
            )
          `,
          { count: 'exact' },
        )
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (companyId) q = q.eq('company_id', companyId);
      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `receipt_number.ilike.%${search}%,reference_no.ilike.%${search}%,received_from.ilike.%${search}%,remarks.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizeOfficialReceipt);
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

async function upsertOfficialReceipt(db: any, input: UpsertOfficialReceiptInput): Promise<{ id: string }> {
  const companyId = await resolveCompanyId(db, input.company_id);
  if (!input.received_from?.trim()) throw new Error('Received From is required');
  if (!input.bank_account_id) throw new Error('Bank account is required');
  if (!input.receipt_date) throw new Error('Receipt date is required');

  const allocations = (input.allocations || [])
    .map((allocation) => ({
      ar_invoice_id: allocation.ar_invoice_id,
      allocated_amount: roundMoney(toNumber(allocation.allocated_amount)),
    }))
    .filter((allocation) => allocation.ar_invoice_id && allocation.allocated_amount > 0);

  if (!allocations.length) throw new Error('At least one invoice allocation is required');

  const totalAmount = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.allocated_amount, 0));
  if (totalAmount <= 0) throw new Error('Allocated amount must be greater than zero');

  let receiptId = input.id;

  if (receiptId) {
    const { data: current, error: currentError } = await db
      .from('official_receipts')
      .select('id, status')
      .eq('id', receiptId)
      .single();
    if (currentError) throw currentError;
    if (!current || current.status !== 'draft') {
      throw new Error('Only draft official receipts can be edited');
    }
  }

  const payload = {
    company_id: companyId,
    received_from: input.received_from.trim(),
    customer_id: null,
    bank_account_id: input.bank_account_id,
    receipt_date: input.receipt_date,
    payment_method: (input.payment_method || 'online_transfer') as ArPaymentMethod,
    reference_no: input.reference_no?.trim() || null,
    remarks: input.remarks?.trim() || null,
    total_amount: totalAmount,
  };

  if (receiptId) {
    const { error } = await db
      .from('official_receipts')
      .update(payload)
      .eq('id', receiptId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from('official_receipts')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    receiptId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('official_receipt_allocations')
    .delete()
    .eq('or_id', receiptId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await db
    .from('official_receipt_allocations')
    .insert(
      allocations.map((allocation) => ({
        or_id: receiptId,
        ar_invoice_id: allocation.ar_invoice_id,
        allocated_amount: allocation.allocated_amount,
      })),
    );
  if (insertError) throw insertError;

  return { id: receiptId };
}

export function useCreateOfficialReceipt() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertOfficialReceiptInput) => upsertOfficialReceipt(db, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-receipts'] });
      toast({ title: 'Created', description: 'Official receipt saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createOfficialReceipt: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useUpdateOfficialReceipt() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertOfficialReceiptInput) => {
      if (!input.id) throw new Error('Official receipt id is required');
      return upsertOfficialReceipt(db, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-receipts'] });
      toast({ title: 'Saved', description: 'Official receipt updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateOfficialReceipt: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitOR() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { orId: string }) => {
      const { data: current, error: currentError } = await db
        .from('official_receipts')
        .select('id, company_id, receipt_number, receipt_date, status')
        .eq('id', input.orId)
        .single();
      if (currentError) throw currentError;
      if (!current || current.status !== 'draft') throw new Error('Only draft official receipts can be submitted');

      const receiptNumber = current.receipt_number
        || (await nextDocumentNumber(db, current.company_id, 'OR', current.receipt_date));

      const { data, error } = await db
        .from('official_receipts')
        .update({
          receipt_number: receiptNumber,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', input.orId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Official receipt was already updated by another user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-receipts'] });
      toast({ title: 'Submitted', description: 'Official receipt submitted for approval' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitOR: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useApproveOR() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { orId: string }) => {
      const { data, error } = await db
        .from('official_receipts')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.orId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only pending official receipts can be approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-receipts'] });
      toast({ title: 'Approved', description: 'Official receipt approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveOR: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function usePostOR() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { orId: string }) => {
      const { data: receiptRaw, error: receiptError } = await db
        .from('official_receipts')
        .select(
          `
            *,
            bank_account:bank_accounts!official_receipts_bank_account_id_fkey(id, account_code, account_name, gl_account_id),
            allocations:official_receipt_allocations(
              id,
              ar_invoice_id,
              allocated_amount,
              ar_invoice:ar_invoices(id, invoice_number, total_amount, paid_amount, status)
            )
          `,
        )
        .eq('id', input.orId)
        .single();
      if (receiptError) throw receiptError;

      const receipt = normalizeOfficialReceipt(receiptRaw);
      if (receipt.status !== 'approved') throw new Error('Only approved official receipts can be posted');
      if (receipt.journal_entry_id) throw new Error('Official receipt is already posted to GL');

      const allocations = receipt.allocations || [];
      if (!allocations.length) throw new Error('Official receipt has no allocations');

      const { data: tradeReceivables, error: tradeReceivablesError } = await db
        .from('chart_of_accounts')
        .select('id')
        .eq('system_tag', 'trade_receivables')
        .eq('is_active', true)
        .maybeSingle();
      if (tradeReceivablesError) throw tradeReceivablesError;
      if (!tradeReceivables?.id) throw new Error('Missing chart of account mapping for trade_receivables');

      const bankGlAccountId = receipt.bank_account?.gl_account_id;
      if (!bankGlAccountId) throw new Error('Selected bank account is not linked to a GL account');

      let totalAllocated = 0;
      for (const allocation of allocations) {
        const invoice = allocation.ar_invoice;
        if (!invoice) throw new Error('Allocation references a missing invoice');

        if (!['posted', 'partially_paid'].includes(invoice.status)) {
          throw new Error(`Invoice ${invoice.invoice_number || invoice.id} is not available for collection`);
        }

        const outstanding = roundMoney(toNumber(invoice.total_amount) - toNumber(invoice.paid_amount));
        const amount = roundMoney(toNumber(allocation.allocated_amount));

        if (amount <= 0) throw new Error('Allocation amount must be greater than zero');
        if (amount > outstanding + 0.0001) {
          throw new Error(`Allocation for invoice ${invoice.invoice_number || invoice.id} exceeds outstanding balance`);
        }

        totalAllocated = roundMoney(totalAllocated + amount);
      }

      const posting = await createGLPosting({
        company_id: receipt.company_id,
        entry_date: receipt.receipt_date,
        description: `Official receipt ${receipt.receipt_number || receipt.id}`,
        reference_type: 'official_receipt',
        reference_id: receipt.id,
        prefix: 'OR',
        lines: [
          {
            account_id: bankGlAccountId,
            description: receipt.reference_no || receipt.remarks || `Official receipt ${receipt.receipt_number || receipt.id}`,
            debit_amount: totalAllocated,
            credit_amount: 0,
          },
          {
            account_id: tradeReceivables.id,
            description: receipt.remarks || `Official receipt ${receipt.receipt_number || receipt.id}`,
            debit_amount: 0,
            credit_amount: totalAllocated,
          },
        ],
      });

      const { error: receiptUpdateError } = await db
        .from('official_receipts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          journal_entry_id: posting.journal_entry_id,
          total_amount: totalAllocated,
        })
        .eq('id', receipt.id);
      if (receiptUpdateError) throw receiptUpdateError;

      for (const allocation of allocations) {
        const invoice = allocation.ar_invoice;
        if (!invoice) continue;

        const currentPaid = roundMoney(toNumber(invoice.paid_amount));
        const totalAmount = roundMoney(toNumber(invoice.total_amount));
        const newPaid = roundMoney(currentPaid + toNumber(allocation.allocated_amount));

        const nextStatus: ArInvoiceStatus = newPaid >= totalAmount - 0.0001 ? 'paid' : 'partially_paid';

        const { error: invoiceUpdateError } = await db
          .from('ar_invoices')
          .update({
            paid_amount: newPaid,
            status: nextStatus,
          })
          .eq('id', invoice.id);

        if (invoiceUpdateError) throw invoiceUpdateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['official-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Posted', description: 'Official receipt posted to GL' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postOR: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

// ─── AR Payments ─────────────────────────────────────────────────────────────

export interface ArPaymentFilters {
  companyId?: string;
  status?: string;
  customerId?: string;
  search?: string;
  page?: number;
}

const AR_PAYMENT_PAGE_SIZE = 20;

export function useArPayments(filters: ArPaymentFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;

  return useQuery({
    queryKey: ['ar-payments', filters],
    queryFn: async () => {
      let q = db
        .from('ar_payments')
        .select(
          `*, customer:customers(id, customer_code, customer_name), bank_account:bank_accounts(id, account_code, account_name, bank_name, gl_account_id), allocations:ar_payment_allocations(*, ar_invoice:ar_invoices(id, invoice_number, total_amount, paid_amount, status))`,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false });

      if (filters.companyId) q = q.eq('company_id', filters.companyId);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.customerId) q = q.eq('customer_id', filters.customerId);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `payment_number.ilike.%${search}%,reference_no.ilike.%${search}%,received_from.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * AR_PAYMENT_PAGE_SIZE, page * AR_PAYMENT_PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      return {
        data: (data || []) as any[],
        total: count || 0,
        page,
        pageSize: AR_PAYMENT_PAGE_SIZE,
      };
    },
    staleTime: 20 * 1000,
  });
}

export interface CreateArPaymentInput {
  company_id: string;
  customer_id?: string;
  received_from?: string;
  bank_account_id: string;
  payment_date: string;
  payment_method: string;
  reference_no?: string;
  remarks?: string;
  allocations: Record<string, string>; // ar_invoice_id -> amount string
}

export function useCreateArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: CreateArPaymentInput) => {
      const companyId = await resolveCompanyId(db, input.company_id);
      const paymentNumber = await nextDocumentNumber(db, companyId, 'ARP', input.payment_date);

      const allocationEntries = Object.entries(input.allocations || {})
        .map(([ar_invoice_id, amount]) => ({
          ar_invoice_id,
          allocated_amount: roundMoney(toNumber(amount)),
        }))
        .filter((a) => a.ar_invoice_id && a.allocated_amount > 0);

      const totalAmount = roundMoney(allocationEntries.reduce((sum, a) => sum + a.allocated_amount, 0));

      const { data: payment, error: paymentError } = await db
        .from('ar_payments')
        .insert({
          company_id: companyId,
          payment_number: paymentNumber,
          customer_id: input.customer_id || null,
          received_from: input.received_from?.trim() || null,
          bank_account_id: input.bank_account_id,
          payment_date: input.payment_date,
          payment_method: input.payment_method,
          reference_no: input.reference_no?.trim() || null,
          remarks: input.remarks?.trim() || null,
          total_amount: totalAmount,
        })
        .select('id')
        .single();
      if (paymentError) throw paymentError;

      const paymentId = payment.id as string;

      if (allocationEntries.length) {
        const { error: allocError } = await db
          .from('ar_payment_allocations')
          .insert(
            allocationEntries.map((a) => ({
              ar_payment_id: paymentId,
              ar_invoice_id: a.ar_invoice_id,
              allocated_amount: a.allocated_amount,
            })),
          );
        if (allocError) throw allocError;
      }

      return { id: paymentId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      toast({ title: 'Created', description: 'AR payment saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createArPayment: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export interface UpdateArPaymentInput extends CreateArPaymentInput {
  id: string;
}

export function useUpdateArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpdateArPaymentInput) => {
      if (!input.id) throw new Error('AR payment id is required');

      const companyId = await resolveCompanyId(db, input.company_id);

      const allocationEntries = Object.entries(input.allocations || {})
        .map(([ar_invoice_id, amount]) => ({
          ar_invoice_id,
          allocated_amount: roundMoney(toNumber(amount)),
        }))
        .filter((a) => a.ar_invoice_id && a.allocated_amount > 0);

      const totalAmount = roundMoney(allocationEntries.reduce((sum, a) => sum + a.allocated_amount, 0));

      const { error: updateError } = await db
        .from('ar_payments')
        .update({
          company_id: companyId,
          customer_id: input.customer_id || null,
          received_from: input.received_from?.trim() || null,
          bank_account_id: input.bank_account_id,
          payment_date: input.payment_date,
          payment_method: input.payment_method,
          reference_no: input.reference_no?.trim() || null,
          remarks: input.remarks?.trim() || null,
          total_amount: totalAmount,
        })
        .eq('id', input.id);
      if (updateError) throw updateError;

      const { error: deleteError } = await db
        .from('ar_payment_allocations')
        .delete()
        .eq('ar_payment_id', input.id);
      if (deleteError) throw deleteError;

      if (allocationEntries.length) {
        const { error: allocError } = await db
          .from('ar_payment_allocations')
          .insert(
            allocationEntries.map((a) => ({
              ar_payment_id: input.id,
              ar_invoice_id: a.ar_invoice_id,
              allocated_amount: a.allocated_amount,
            })),
          );
        if (allocError) throw allocError;
      }

      return { id: input.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      toast({ title: 'Saved', description: 'AR payment updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateArPayment: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useSubmitArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('ar_payments')
        .update({ status: 'pending', submitted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      toast({ title: 'Submitted', description: 'AR payment submitted for approval' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitArPayment: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

export function useApproveArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('ar_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      toast({ title: 'Approved', description: 'AR payment approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveArPayment: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

export function usePostArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: updateError } = await db
        .from('ar_payments')
        .update({ status: 'posted', posted_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;

      const { data: allocations, error: allocError } = await db
        .from('ar_payment_allocations')
        .select('ar_invoice_id, allocated_amount')
        .eq('ar_payment_id', id);
      if (allocError) throw allocError;

      for (const alloc of (allocations || []) as any[]) {
        const { data: invoice, error: invoiceError } = await db
          .from('ar_invoices')
          .select('paid_amount, total_amount')
          .eq('id', alloc.ar_invoice_id)
          .single();
        if (invoiceError) throw invoiceError;

        const newPaid = toNumber(invoice.paid_amount) + toNumber(alloc.allocated_amount);
        const newStatus = newPaid >= toNumber(invoice.total_amount) ? 'paid' : 'partially_paid';

        const { error: invoiceUpdateError } = await db
          .from('ar_invoices')
          .update({ paid_amount: roundMoney(newPaid), status: newStatus })
          .eq('id', alloc.ar_invoice_id);
        if (invoiceUpdateError) throw invoiceUpdateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      toast({ title: 'Posted', description: 'AR payment posted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postArPayment: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}

export function useDeleteArPayment() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('ar_payments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-payments'] });
      toast({ title: 'Deleted', description: 'AR payment deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    deleteArPayment: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
}
