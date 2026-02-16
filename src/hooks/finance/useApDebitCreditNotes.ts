/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';
import type {
  ApDcnLine,
  ApDcnStatus,
  ApDcnType,
  ApDebitCreditNote,
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

function normalizeDcnLine(line: any): ApDcnLine {
  return {
    ...line,
    quantity: toNumber(line.quantity),
    unit_price: toNumber(line.unit_price),
    amount: toNumber(line.amount),
    tax_rate: toNumber(line.tax_rate),
    tax_amount: toNumber(line.tax_amount),
    sort_order: toNumber(line.sort_order),
  };
}

function normalizeDcn(row: any): ApDebitCreditNote {
  return {
    ...row,
    exchange_rate: toNumber(row.exchange_rate),
    subtotal: toNumber(row.subtotal),
    tax_total: toNumber(row.tax_total),
    total_amount: toNumber(row.total_amount),
    lines: ((row.lines || []) as any[]).map(normalizeDcnLine),
  };
}

// --- Filters ---

export interface ApDcnFilters {
  companyId?: string;
  status?: ApDcnStatus | 'all';
  noteType?: ApDcnType | 'all';
  supplierId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// --- List ---

export function useApDcnList(filters: ApDcnFilters = {}) {
  const db = supabase as any;
  const { profile } = useAuth();
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 15;

  return useQuery({
    queryKey: [
      'ap-dcn',
      filters.companyId || profile?.company_id || 'none',
      filters.status || 'all',
      filters.noteType || 'all',
      filters.supplierId || 'all',
      filters.search || '',
      page,
      pageSize,
    ],
    queryFn: async () => {
      const companyId = filters.companyId || profile?.company_id;
      if (!companyId) {
        return {
          rows: [] as ApDebitCreditNote[],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      let q = db
        .from('ap_debit_credit_notes')
        .select(
          `
            *,
            supplier:suppliers!ap_debit_credit_notes_supplier_id_fkey(id, supplier_code, supplier_name),
            ap_invoice:ap_invoices!ap_debit_credit_notes_ap_invoice_id_fkey(id, invoice_number, total_amount)
          `,
          { count: 'exact' },
        )
        .eq('company_id', companyId)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.noteType && filters.noteType !== 'all') q = q.eq('note_type', filters.noteType);
      if (filters.supplierId && filters.supplierId !== 'all') q = q.eq('supplier_id', filters.supplierId);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(
          `note_number.ilike.%${search}%,reason.ilike.%${search}%`,
        );
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = ((data || []) as any[]).map(normalizeDcn);
      const total = count || 0;

      return {
        rows,
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
    enabled: !!(filters.companyId || profile?.company_id),
    staleTime: 20 * 1000,
  });
}

// --- Detail ---

export function useApDcnDetail(id?: string | null) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['ap-dcn-detail', id || 'none'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ap_debit_credit_notes')
        .select(
          `
            *,
            supplier:suppliers!ap_debit_credit_notes_supplier_id_fkey(id, supplier_code, supplier_name),
            ap_invoice:ap_invoices!ap_debit_credit_notes_ap_invoice_id_fkey(id, invoice_number, total_amount),
            lines:ap_dcn_lines(
              *,
              gl_account:chart_of_accounts(id, account_code, account_name)
            )
          `,
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return normalizeDcn(data);
    },
    enabled: !!id,
    staleTime: 20 * 1000,
  });
}

// --- Upsert input ---

export interface ApDcnLineInput {
  description: string;
  gl_account_id: string;
  quantity?: number;
  unit_price?: number;
  tax_code?: string;
  tax_rate?: number;
  project_id?: string | null;
}

export interface UpsertApDcnInput {
  id?: string;
  company_id?: string | null;
  note_type: ApDcnType;
  supplier_id: string;
  ap_invoice_id?: string | null;
  note_date: string;
  currency?: string;
  exchange_rate?: number;
  reason?: string | null;
  lines: ApDcnLineInput[];
}

async function upsertApDcn(db: any, input: UpsertApDcnInput): Promise<{ id: string }> {
  const companyId = await resolveCompanyId(db, input.company_id);

  const preparedLines = (input.lines || [])
    .map((line, idx) => {
      const quantity = toNumber(line.quantity || 0);
      const unitPrice = toNumber(line.unit_price || 0);
      const amount = roundMoney(quantity * unitPrice);
      const taxCode = line.tax_code || 'zr';
      const taxRate = toNumber(line.tax_rate ?? 0);
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
        sort_order: idx,
      };
    })
    .filter((line) => line.description && line.gl_account_id && line.quantity > 0);

  if (!preparedLines.length) throw new Error('At least one valid line item is required');
  if (!input.supplier_id) throw new Error('Supplier is required');
  if (!input.note_date) throw new Error('Note date is required');

  const subtotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.amount, 0));
  const taxTotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.tax_amount, 0));
  const totalAmount = roundMoney(subtotal + taxTotal);

  const payload = {
    company_id: companyId,
    note_type: input.note_type,
    supplier_id: input.supplier_id,
    ap_invoice_id: input.ap_invoice_id || null,
    note_date: input.note_date,
    currency: (input.currency || 'MYR').trim().toUpperCase(),
    exchange_rate: toNumber(input.exchange_rate || 1),
    subtotal,
    tax_total: taxTotal,
    total_amount: totalAmount,
    reason: input.reason?.trim() || null,
  };

  let dcnId = input.id;

  if (dcnId) {
    const { data: current, error: currentError } = await db
      .from('ap_debit_credit_notes')
      .select('id, status')
      .eq('id', dcnId)
      .single();
    if (currentError) throw currentError;
    if (!current || current.status !== 'draft') {
      throw new Error('Only draft AP debit/credit notes can be edited');
    }

    const { error } = await db
      .from('ap_debit_credit_notes')
      .update(payload)
      .eq('id', dcnId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from('ap_debit_credit_notes')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    dcnId = data.id as string;
  }

  const { error: deleteError } = await db
    .from('ap_dcn_lines')
    .delete()
    .eq('ap_dcn_id', dcnId);
  if (deleteError) throw deleteError;

  const { error: insertLinesError } = await db
    .from('ap_dcn_lines')
    .insert(
      preparedLines.map((line) => ({
        ap_dcn_id: dcnId,
        description: line.description,
        gl_account_id: line.gl_account_id,
        quantity: line.quantity,
        unit_price: roundMoney(line.unit_price),
        amount: line.amount,
        tax_code: line.tax_code,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        project_id: line.project_id,
        sort_order: line.sort_order,
      })),
    );
  if (insertLinesError) throw insertLinesError;

  return { id: dcnId };
}

// --- Create ---

export function useCreateApDcn() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertApDcnInput) => upsertApDcn(db, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-dcn'] });
      toast({ title: 'Created', description: 'AP debit/credit note saved as draft' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createApDcn: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

// --- Update ---

export function useUpdateApDcn() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertApDcnInput) => {
      if (!input.id) throw new Error('AP DCN id is required');
      return upsertApDcn(db, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-dcn'] });
      toast({ title: 'Saved', description: 'AP debit/credit note updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    updateApDcn: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

// --- Submit ---

export function useSubmitApDcn() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { dcnId: string }) => {
      const { data: current, error: currentError } = await db
        .from('ap_debit_credit_notes')
        .select('id, company_id, note_number, note_type, note_date, status')
        .eq('id', input.dcnId)
        .single();
      if (currentError) throw currentError;
      if (!current || current.status !== 'draft') throw new Error('Only draft AP DCNs can be submitted');

      const prefix = current.note_type === 'debit_note' ? 'APDN' : 'APCN';
      const noteNumber = current.note_number
        || (await nextDocumentNumber(db, current.company_id, prefix, current.note_date));

      const { data, error } = await db
        .from('ap_debit_credit_notes')
        .update({
          note_number: noteNumber,
          status: 'pending',
        })
        .eq('id', input.dcnId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('AP DCN was already updated by another user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-dcn'] });
      toast({ title: 'Submitted', description: 'AP debit/credit note submitted for approval' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    submitApDcn: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}

// --- Approve ---

export function useApproveApDcn() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { dcnId: string }) => {
      const { data, error } = await db
        .from('ap_debit_credit_notes')
        .update({
          status: 'approved',
        })
        .eq('id', input.dcnId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Only pending AP DCNs can be approved');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-dcn'] });
      toast({ title: 'Approved', description: 'AP debit/credit note approved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approveApDcn: mutation.mutateAsync,
    isApproving: mutation.isPending,
  };
}

// --- Post to GL ---

export function usePostApDcn() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { dcnId: string }) => {
      const { data: dcnRaw, error: dcnError } = await db
        .from('ap_debit_credit_notes')
        .select(
          `
            *,
            supplier:suppliers!ap_debit_credit_notes_supplier_id_fkey(id, supplier_code, supplier_name),
            lines:ap_dcn_lines(*)
          `,
        )
        .eq('id', input.dcnId)
        .single();
      if (dcnError) throw dcnError;

      const dcn = normalizeDcn(dcnRaw);
      if (dcn.status !== 'approved') throw new Error('Only approved AP DCNs can be posted');
      if (dcn.journal_entry_id) throw new Error('AP DCN is already posted to GL');
      if (!(dcn.lines || []).length) throw new Error('AP DCN has no lines to post');

      const { data: tradePayables, error: tradePayablesError } = await db
        .from('chart_of_accounts')
        .select('id')
        .eq('system_tag', 'trade_payables')
        .eq('is_active', true)
        .maybeSingle();
      if (tradePayablesError) throw tradePayablesError;
      if (!tradePayables?.id) throw new Error('Missing chart of account mapping for trade_payables');

      const lines = dcn.lines || [];
      const lineEntries = lines.map((line) => ({
        account_id: line.gl_account_id,
        description: line.description,
        amount: roundMoney(toNumber(line.amount) + toNumber(line.tax_amount)),
        project_id: line.project_id || null,
      }));

      const totalAmount = roundMoney(lineEntries.reduce((sum, line) => sum + line.amount, 0));
      if (totalAmount <= 0) throw new Error('DCN total must be greater than zero to post');

      let glLines;
      if (dcn.note_type === 'debit_note') {
        // Debit Note (supplier owes us): DR trade_payables, CR per line gl_account_id
        glLines = [
          {
            account_id: tradePayables.id,
            description: dcn.reason || `AP debit note ${dcn.note_number || dcn.id}`,
            debit_amount: totalAmount,
            credit_amount: 0,
          },
          ...lineEntries.map((entry) => ({
            account_id: entry.account_id,
            description: entry.description,
            debit_amount: 0,
            credit_amount: entry.amount,
            project_id: entry.project_id,
          })),
        ];
      } else {
        // Credit Note (we owe supplier more): DR per line gl_account_id, CR trade_payables
        glLines = [
          ...lineEntries.map((entry) => ({
            account_id: entry.account_id,
            description: entry.description,
            debit_amount: entry.amount,
            credit_amount: 0,
            project_id: entry.project_id,
          })),
          {
            account_id: tradePayables.id,
            description: dcn.reason || `AP credit note ${dcn.note_number || dcn.id}`,
            debit_amount: 0,
            credit_amount: totalAmount,
          },
        ];
      }

      const posting = await createGLPosting({
        company_id: dcn.company_id,
        entry_date: dcn.note_date,
        description: `AP ${dcn.note_type === 'debit_note' ? 'debit note' : 'credit note'} ${dcn.note_number || dcn.id}`,
        reference_type: 'ap_dcn',
        reference_id: dcn.id,
        prefix: dcn.note_type === 'debit_note' ? 'APDN' : 'APCN',
        lines: glLines,
      });

      const { error: updateError } = await db
        .from('ap_debit_credit_notes')
        .update({
          status: 'posted',
          journal_entry_id: posting.journal_entry_id,
          total_amount: totalAmount,
        })
        .eq('id', dcn.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-dcn'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Posted', description: 'AP debit/credit note posted to GL' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postApDcn: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}
