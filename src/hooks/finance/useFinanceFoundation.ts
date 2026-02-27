import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type {
  ApprovalHistory,
  ApprovalWorkflow,
  BankAccount,
  Customer,
  DoaRule,
  FinanceApprovalStatus,
  FinanceCompanyProfile,
  FinanceDoaDocumentType,
  FinanceStatementFrequency,
  Supplier,
} from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

function includesQuery(value: string | null | undefined, query: string) {
  return (value || '').toLowerCase().includes(query);
}

export function useFinanceCompanyProfiles() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['finance-company-profiles'],
    queryFn: async () => {
      const { data, error } = await db
        .from('finance_company_profiles')
        .select(`
          *,
          companies:companies!finance_company_profiles_company_id_fkey(id, name, code)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as FinanceCompanyProfile[];
    },
    staleTime: 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (
      values: Omit<FinanceCompanyProfile, 'id' | 'created_at' | 'updated_at' | 'companies'> & { id?: string },
    ) => {
      const payload = {
        ...(values.id ? { id: values.id } : {}),
        company_id: values.company_id,
        base_currency: values.base_currency,
        fiscal_year_start_month: values.fiscal_year_start_month,
        payment_terms_days: values.payment_terms_days,
        tax_id: values.tax_id || null,
        sst_registration_no: values.sst_registration_no || null,
        lock_date: values.lock_date || null,
        notes: values.notes || null,
        decimal_precision: values.decimal_precision ?? 2,
        default_bank_account_id: values.default_bank_account_id || null,
        retained_earnings_gl_id: values.retained_earnings_gl_id || null,
        suspense_account_gl_id: values.suspense_account_gl_id || null,
        address_line1: values.address_line1 || null,
        address_line2: values.address_line2 || null,
        city: values.city || null,
        state: values.state || null,
        postcode: values.postcode || null,
        country: values.country || null,
        phone: values.phone || null,
        email: values.email || null,
        website: values.website || null,
      };

      const { error } = await db
        .from('finance_company_profiles')
        .upsert(payload, { onConflict: 'company_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-company-profiles'] });
      toast({ title: 'Saved', description: 'Company finance profile updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    profiles: query.data || [],
    upsertProfile: upsertMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
  };
}

interface UseDoaRulesOptions {
  companyId?: string;
  documentType?: FinanceDoaDocumentType | 'all';
  includeInactive?: boolean;
}

export function useDoaRules(options: UseDoaRulesOptions = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const includeInactive = options.includeInactive ?? false;

  const query = useQuery({
    queryKey: ['doa-rules', options.companyId || 'all', options.documentType || 'all', includeInactive],
    queryFn: async () => {
      let q = db
        .from('doa_rules')
        .select(`
          *,
          companies:companies!doa_rules_company_id_fkey(id, name, code)
        `)
        .order('document_type', { ascending: true })
        .order('approval_level', { ascending: true })
        .order('min_amount', { ascending: true });

      if (options.companyId) q = q.eq('company_id', options.companyId);
      if (options.documentType && options.documentType !== 'all') q = q.eq('document_type', options.documentType);
      if (!includeInactive) q = q.eq('is_active', true);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as DoaRule[]).map((rule) => ({
        ...rule,
        min_amount: toNumber(rule.min_amount),
        max_amount: rule.max_amount == null ? null : toNumber(rule.max_amount),
      }));
    },
    staleTime: 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (
      values: Omit<DoaRule, 'id' | 'created_at' | 'updated_at' | 'companies'> & { id?: string },
    ) => {
      const payload = {
        company_id: values.company_id,
        document_type: values.document_type,
        approval_level: values.approval_level,
        min_amount: toNumber(values.min_amount),
        max_amount: values.max_amount == null ? null : toNumber(values.max_amount),
        approver_role: values.approver_role,
        is_active: values.is_active,
        remarks: values.remarks || null,
      };

      if (values.id) {
        const { error } = await db
          .from('doa_rules')
          .update(payload)
          .eq('id', values.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('doa_rules')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doa-rules'] });
      toast({ title: 'Saved', description: 'DOA rule saved successfully' });
    },
    onError: (error: Error) => {
      const msg = error.message?.includes('idx_doa_rules_unique_window')
        ? 'A rule with this company, document type, level, amount, and role already exists.'
        : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('doa_rules')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doa-rules'] });
      toast({ title: 'Updated', description: 'DOA rule archived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    rules: query.data || [],
    upsertRule: upsertMutation.mutateAsync,
    archiveRule: archiveMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}

interface MasterListOptions {
  includeInactive?: boolean;
  search?: string;
}

export function useSuppliers(options: MasterListOptions = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const includeInactive = options.includeInactive ?? false;
  const search = (options.search || '').trim().toLowerCase();

  const query = useQuery({
    queryKey: ['suppliers', includeInactive],
    queryFn: async () => {
      let q = db
        .from('suppliers')
        .select(`
          *,
          companies:companies!suppliers_company_id_fkey(id, name, code)
        `)
        .order('supplier_code', { ascending: true });

      if (!includeInactive) q = q.eq('is_active', true);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as Supplier[]).map((row) => ({
        ...row,
        credit_limit: toNumber(row.credit_limit),
        opening_balance: toNumber(row.opening_balance),
        outstanding_balance: toNumber(row.outstanding_balance),
      }));
    },
    staleTime: 30 * 1000,
  });

  const filteredSuppliers = useMemo(() => {
    if (!search) return query.data || [];
    return (query.data || []).filter((row) => (
      includesQuery(row.supplier_code, search)
      || includesQuery(row.supplier_name, search)
      || includesQuery(row.category, search)
      || includesQuery(row.tax_id, search)
      || includesQuery(row.email, search)
      || includesQuery(row.phone, search)
    ));
  }, [query.data, search]);

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Supplier, 'created_at' | 'updated_at' | 'companies'> & { id?: string }) => {
      const payload = {
        company_id: values.company_id,
        supplier_code: values.supplier_code,
        supplier_name: values.supplier_name,
        category: values.category || null,
        tax_id: values.tax_id || null,
        gst_no: values.gst_no || null,
        contact_name: values.contact_name || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        bank_name: values.bank_name || null,
        bank_account_no: values.bank_account_no || null,
        bank_account_holder: values.bank_account_holder || null,
        swift_code: values.swift_code || null,
        payment_terms_days: Number(values.payment_terms_days || 0),
        credit_limit: toNumber(values.credit_limit),
        currency: (values.currency || 'MYR').trim().toUpperCase(),
        opening_balance: toNumber(values.opening_balance),
        outstanding_balance: toNumber(values.outstanding_balance),
        is_active: values.is_active,
        notes: values.notes || null,
      };

      if (values.id) {
        const { error } = await db
          .from('suppliers')
          .update(payload)
          .eq('id', values.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('suppliers')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Saved', description: 'Supplier saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Archived', description: 'Supplier archived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    suppliers: filteredSuppliers,
    upsertSupplier: upsertMutation.mutateAsync,
    archiveSupplier: archiveMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}

export function useCustomers(options: MasterListOptions = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const includeInactive = options.includeInactive ?? false;
  const search = (options.search || '').trim().toLowerCase();

  const query = useQuery({
    queryKey: ['customers', includeInactive],
    queryFn: async () => {
      let q = db
        .from('customers')
        .select(`
          *,
          companies:companies!customers_company_id_fkey(id, name, code)
        `)
        .order('customer_code', { ascending: true });

      if (!includeInactive) q = q.eq('is_active', true);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as Customer[]).map((row) => ({
        ...row,
        credit_limit: toNumber(row.credit_limit),
        opening_balance: toNumber(row.opening_balance),
        outstanding_balance: toNumber(row.outstanding_balance),
      }));
    },
    staleTime: 30 * 1000,
  });

  const filteredCustomers = useMemo(() => {
    if (!search) return query.data || [];
    return (query.data || []).filter((row) => (
      includesQuery(row.customer_code, search)
      || includesQuery(row.customer_name, search)
      || includesQuery(row.tax_id, search)
      || includesQuery(row.sst_no, search)
      || includesQuery(row.email, search)
      || includesQuery(row.phone, search)
    ));
  }, [query.data, search]);

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Customer, 'created_at' | 'updated_at' | 'companies'> & { id?: string }) => {
      const payload = {
        company_id: values.company_id,
        customer_code: values.customer_code,
        customer_name: values.customer_name,
        tax_id: values.tax_id || null,
        sst_no: values.sst_no || null,
        contact_name: values.contact_name || null,
        email: values.email || null,
        phone: values.phone || null,
        billing_address: values.billing_address || null,
        shipping_address: values.shipping_address || null,
        payment_terms_days: Number(values.payment_terms_days || 0),
        credit_limit: toNumber(values.credit_limit),
        currency: (values.currency || 'MYR').trim().toUpperCase(),
        statement_frequency: values.statement_frequency,
        opening_balance: toNumber(values.opening_balance),
        outstanding_balance: toNumber(values.outstanding_balance),
        is_active: values.is_active,
        notes: values.notes || null,
      };

      if (values.id) {
        const { error } = await db
          .from('customers')
          .update(payload)
          .eq('id', values.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('customers')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Saved', description: 'Customer saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Archived', description: 'Customer archived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    customers: filteredCustomers,
    upsertCustomer: upsertMutation.mutateAsync,
    archiveCustomer: archiveMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}

export function useBankAccounts(options: MasterListOptions = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const includeInactive = options.includeInactive ?? false;
  const search = (options.search || '').trim().toLowerCase();

  const query = useQuery({
    queryKey: ['bank-accounts', includeInactive],
    queryFn: async () => {
      let q = db
        .from('bank_accounts')
        .select(`
          *,
          companies:companies!bank_accounts_company_id_fkey(id, name, code),
          gl_account:chart_of_accounts!bank_accounts_gl_account_id_fkey(id, account_code, account_name)
        `)
        .order('account_code', { ascending: true });

      if (!includeInactive) q = q.eq('is_active', true);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as BankAccount[]).map((row) => ({
        ...row,
        current_balance: toNumber(row.current_balance),
      }));
    },
    staleTime: 30 * 1000,
  });

  const filteredBankAccounts = useMemo(() => {
    if (!search) return query.data || [];
    return (query.data || []).filter((row) => (
      includesQuery(row.account_code, search)
      || includesQuery(row.account_name, search)
      || includesQuery(row.bank_name, search)
      || includesQuery(row.account_number, search)
      || includesQuery(row.currency, search)
    ));
  }, [query.data, search]);

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<BankAccount, 'created_at' | 'updated_at' | 'companies' | 'gl_account'> & { id?: string }) => {
      const payload = {
        company_id: values.company_id,
        account_code: values.account_code,
        account_name: values.account_name,
        bank_name: values.bank_name,
        account_number: values.account_number,
        account_type: values.account_type,
        currency: (values.currency || 'MYR').trim().toUpperCase(),
        current_balance: toNumber(values.current_balance),
        gl_account_id: values.gl_account_id || null,
        is_reconciling: values.is_reconciling,
        last_reconciled_at: values.last_reconciled_at || null,
        is_active: values.is_active,
        notes: values.notes || null,
      };

      if (values.id) {
        const { error } = await db
          .from('bank_accounts')
          .update(payload)
          .eq('id', values.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('bank_accounts')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast({ title: 'Saved', description: 'Bank account saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('bank_accounts')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast({ title: 'Archived', description: 'Bank account archived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    bankAccounts: filteredBankAccounts,
    upsertBankAccount: upsertMutation.mutateAsync,
    archiveBankAccount: archiveMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}

interface UseApprovalWorkflowsOptions {
  status?: FinanceApprovalStatus | 'all';
  search?: string;
}

export function useApprovalWorkflows(options: UseApprovalWorkflowsOptions = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const search = (options.search || '').trim().toLowerCase();

  const query = useQuery({
    queryKey: ['approval-workflows', options.status || 'all'],
    queryFn: async () => {
      let q = db
        .from('approval_workflows')
        .select(`
          *,
          companies:companies!approval_workflows_company_id_fkey(id, name, code),
          requester:profiles!approval_workflows_requested_by_fkey(id, employee_id, full_name),
          decider:profiles!approval_workflows_decided_by_fkey(id, employee_id, full_name)
        `)
        .order('submitted_at', { ascending: false });

      if (options.status && options.status !== 'all') q = q.eq('status', options.status);

      const { data, error } = await q;
      if (error) throw error;

      return (data || []) as ApprovalWorkflow[];
    },
    staleTime: 20 * 1000,
  });

  const workflows = useMemo(() => {
    if (!search) return query.data || [];

    return (query.data || []).filter((row) => (
      includesQuery(row.document_number, search)
      || includesQuery(row.document_type, search)
      || includesQuery(row.remarks, search)
      || includesQuery(row.requester?.full_name, search)
      || includesQuery(row.companies?.name, search)
    ));
  }, [query.data, search]);

  const decideMutation = useMutation({
    mutationFn: async (values: { workflowId: string; decision: 'approve' | 'reject'; comments?: string }) => {
      const action = values.decision === 'approve' ? 'approved' : 'rejected';
      const nextStatus = action as FinanceApprovalStatus;

      const { data: workflow, error: workflowError } = await db
        .from('approval_workflows')
        .select('id, current_level')
        .eq('id', values.workflowId)
        .single();
      if (workflowError) throw workflowError;

      const { error: updateError } = await db
        .from('approval_workflows')
        .update({
          status: nextStatus,
          decided_at: new Date().toISOString(),
          decided_by: user?.id || null,
          remarks: values.comments || null,
        })
        .eq('id', values.workflowId)
        .eq('status', 'pending');
      if (updateError) throw updateError;

      const { error: historyError } = await db
        .from('approval_history')
        .insert({
          workflow_id: values.workflowId,
          approval_level: Number(workflow?.current_level || 1),
          action,
          acted_by: user?.id || null,
          comments: values.comments || null,
        });
      if (historyError) throw historyError;
    },
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['approval-history', values.workflowId] });
      toast({ title: 'Updated', description: 'Workflow decision recorded' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    workflows,
    decideWorkflow: decideMutation.mutateAsync,
    isDeciding: decideMutation.isPending,
  };
}

export function useApprovalHistory(workflowId?: string | null) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['approval-history', workflowId || 'none'],
    queryFn: async () => {
      const { data, error } = await db
        .from('approval_history')
        .select(`
          *,
          actor:profiles!approval_history_acted_by_fkey(id, employee_id, full_name)
        `)
        .eq('workflow_id', workflowId)
        .order('acted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (ApprovalHistory & {
        actor?: {
          id: string;
          employee_id: string;
          full_name: string;
        } | null;
      })[];
    },
    enabled: !!workflowId,
    staleTime: 20 * 1000,
  });
}

export function getFinanceStatementFrequencyOptions(): FinanceStatementFrequency[] {
  return ['monthly', 'quarterly', 'on_demand'];
}
