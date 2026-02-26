/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PettyCashStatus, PettyCashTransaction, PettyCashTxnType } from '@/types/finance';
import { canTransitionPettyCash } from '@/types/finance';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';

interface PettyCashTxnFilters {
  status?: PettyCashStatus | 'all';
  txnType?: PettyCashTxnType | 'all';
  month?: number;
  year?: number;
  search?: string;
}

interface CreatePettyCashTxnInput {
  txn_type: PettyCashTxnType;
  txn_date: string;
  amount: number;
  description: string;
  account_id: string;
  project_id?: string | null;
  receipt_urls?: string[];
  payee?: string | null;
  department?: string | null;
  tax_amount?: number;
}

function toSignedAmount(txnType: string, amount: number) {
  if (txnType === 'top_up') return Number(amount || 0);
  return -Number(amount || 0);
}

async function isFinanceOrAdmin(db: any, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['finance', 'admin'])
    .limit(1);

  if (error) throw error;
  return !!data?.length;
}

async function getCurrentApprovedBalance(db: any): Promise<number> {
  const { data, error } = await db
    .from('petty_cash_transactions')
    .select('txn_type, amount')
    .eq('status', 'approved');
  if (error) throw error;

  return (data || []).reduce((sum: number, row: any) => sum + toSignedAmount(row.txn_type, row.amount), 0);
}

async function generateTxnNumber(db: any, txnDate: string) {
  const dt = new Date(txnDate);
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { count, error } = await db
    .from('petty_cash_transactions')
    .select('id', { count: 'exact', head: true })
    .gte('txn_date', monthStart)
    .lte('txn_date', monthEnd);

  if (error) throw error;

  const nextSeq = String((count || 0) + 1).padStart(3, '0');
  return `PC-${year}-${String(month).padStart(2, '0')}-${nextSeq}`;
}

export function usePettyCashTransactions(filters: PettyCashTxnFilters = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['petty-cash-transactions', filters.status, filters.txnType, filters.month, filters.year, filters.search],
    queryFn: async () => {
      let q = db
        .from('petty_cash_transactions')
        .select(`
          *,
          account:chart_of_accounts(id, account_code, account_name),
          project:projects(id, project_code, project_name),
          requester:profiles!petty_cash_transactions_requested_by_fkey(id, employee_id, full_name),
          approver:profiles!petty_cash_transactions_approved_by_fkey(id, employee_id, full_name),
          rejector:profiles!petty_cash_transactions_rejected_by_fkey(id, employee_id, full_name)
        `)
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.txnType && filters.txnType !== 'all') q = q.eq('txn_type', filters.txnType);

      if (filters.month && filters.year) {
        const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
        const lastDay = new Date(filters.year, filters.month, 0).getDate();
        const end = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        q = q.gte('txn_date', start).lte('txn_date', end);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as PettyCashTransaction[];
      const search = (filters.search || '').trim().toLowerCase();
      if (!search) return rows;

      return rows.filter((row) => {
        return (
          row.txn_number.toLowerCase().includes(search) ||
          row.description.toLowerCase().includes(search) ||
          (row.account?.account_name || '').toLowerCase().includes(search) ||
          (row.project?.project_name || '').toLowerCase().includes(search) ||
          (row.requester?.full_name || '').toLowerCase().includes(search)
        );
      });
    },
    staleTime: 20 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreatePettyCashTxnInput) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      if (!input.txn_date) throw new Error('Transaction date is required');
      if (!input.account_id) throw new Error('Account is required');
      if (!input.description?.trim()) throw new Error('Description is required');
      if (Number(input.amount) <= 0) throw new Error('Amount must be greater than 0');

      const userId = authData.user.id;
      const financeUser = await isFinanceOrAdmin(db, userId);

      const { data: settings, error: settingsError } = await db
        .from('petty_cash_settings')
        .select('approval_threshold')
        .eq('id', 1)
        .single();
      if (settingsError) throw settingsError;

      const threshold = Number(settings?.approval_threshold || 0);
      const amount = Number(input.amount || 0);
      const autoApproveTopUp = input.txn_type === 'top_up' && financeUser;
      const autoApproveSmallExpense = input.txn_type === 'expenditure' && amount < threshold;
      const shouldAutoApprove = autoApproveTopUp || autoApproveSmallExpense;

      const txnNumber = await generateTxnNumber(db, input.txn_date);
      const now = new Date().toISOString();
      const currentBalance = await getCurrentApprovedBalance(db);

      const status: PettyCashStatus = shouldAutoApprove ? 'approved' : 'pending';
      const runningBalance = shouldAutoApprove
        ? currentBalance + toSignedAmount(input.txn_type, amount)
        : currentBalance;

      const { error } = await db
        .from('petty_cash_transactions')
        .insert({
          txn_number: txnNumber,
          txn_type: input.txn_type,
          txn_date: input.txn_date,
          amount,
          description: input.description.trim(),
          account_id: input.account_id,
          project_id: input.project_id || null,
          receipt_urls: input.receipt_urls || [],
          payee: input.payee || null,
          department: input.department || null,
          tax_amount: Number(input.tax_amount || 0),
          status,
          requested_by: userId,
          approved_by: shouldAutoApprove ? userId : null,
          approved_at: shouldAutoApprove ? now : null,
          approval_remarks: shouldAutoApprove ? 'Auto-approved by rule' : null,
          running_balance: runningBalance,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-balance'] });
      toast({ title: 'Created', description: 'Petty cash transaction created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (input: { txnId: string; approve: boolean; remarks?: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      const userId = authData.user.id;

      const financeUser = await isFinanceOrAdmin(db, userId);
      if (!financeUser) throw new Error('Only finance/admin can approve petty cash transactions');

      const { data: current, error: fetchError } = await db
        .from('petty_cash_transactions')
        .select('id, txn_type, amount, status, requested_by')
        .eq('id', input.txnId)
        .single();
      if (fetchError) throw fetchError;

      if (!current) throw new Error('Transaction not found');
      const targetStatus = input.approve ? 'approved' : 'rejected';
      if (!canTransitionPettyCash(current.status, targetStatus, 'finance')) {
        throw new Error('Only pending transactions can be approved/rejected');
      }

      const now = new Date().toISOString();

      if (!input.approve) {
        const { error } = await db
          .from('petty_cash_transactions')
          .update({
            status: 'rejected',
            rejected_by: userId,
            rejected_at: now,
            rejection_remarks: input.remarks || null,
          })
          .eq('id', input.txnId);

        if (error) throw error;
        return;
      }

      const { data: settings, error: settingsError } = await db
        .from('petty_cash_settings')
        .select('approval_threshold')
        .eq('id', 1)
        .single();
      if (settingsError) throw settingsError;

      const threshold = Number(settings?.approval_threshold || 0);
      if (
        current.txn_type === 'expenditure' &&
        Number(current.amount || 0) >= threshold &&
        current.requested_by === userId
      ) {
        throw new Error('Large expenditures require approval from another finance user');
      }

      const currentBalance = await getCurrentApprovedBalance(db);
      const runningBalance = currentBalance + toSignedAmount(current.txn_type, Number(current.amount || 0));

      const { error } = await db
        .from('petty_cash_transactions')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: now,
          approval_remarks: input.remarks || null,
          running_balance: runningBalance,
        })
        .eq('id', input.txnId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-balance'] });
      toast({ title: 'Updated', description: 'Petty cash transaction updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (input: { txnId: string; reference?: string; remarks?: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchError } = await db
        .from('petty_cash_transactions')
        .select('id, txn_number, txn_type, txn_date, amount, description, account_id, status, is_posted')
        .eq('id', input.txnId)
        .single();
      if (fetchError) throw fetchError;

      if (!current) throw new Error('Transaction not found');
      if (current.status !== 'approved' || current.is_posted) {
        throw new Error('Only approved and unposted transactions can be posted');
      }

      const { data: glAccounts, error: glAccountsError } = await db
        .from('chart_of_accounts')
        .select('id, system_tag')
        .in('system_tag', ['petty_cash', 'cash_bank'])
        .eq('is_active', true);
      if (glAccountsError) throw glAccountsError;

      const pettyCashAccountId = (glAccounts || []).find((row: any) => row.system_tag === 'petty_cash')?.id;
      if (!pettyCashAccountId) {
        throw new Error('Missing chart of account mapping for petty_cash');
      }

      const cashBankAccountId = (glAccounts || []).find((row: any) => row.system_tag === 'cash_bank')?.id;

      const amount = Number(current.amount || 0);
      if (amount <= 0) {
        throw new Error('Invalid petty cash amount');
      }

      const posting = await createGLPosting({
        reference_type: 'petty_cash',
        reference_id: current.id,
        entry_date: current.txn_date,
        description: `Petty cash ${current.txn_type === 'top_up' ? 'top-up' : 'expenditure'} ${current.txn_number}`,
        prefix: 'PCV',
        lines: current.txn_type === 'top_up'
          ? [
              {
                account_id: pettyCashAccountId,
                description: current.description,
                debit_amount: amount,
                credit_amount: 0,
              },
              {
                account_id: cashBankAccountId || pettyCashAccountId,
                description: current.description,
                debit_amount: 0,
                credit_amount: amount,
              },
            ]
          : [
              {
                account_id: current.account_id,
                description: current.description,
                debit_amount: amount,
                credit_amount: 0,
              },
              {
                account_id: pettyCashAccountId,
                description: current.description,
                debit_amount: 0,
                credit_amount: amount,
              },
            ],
      });

      const now = new Date().toISOString();
      const { error } = await db
        .from('petty_cash_transactions')
        .update({
          is_posted: true,
          posted_by: authData.user.id,
          posted_at: now,
          posting_reference: posting.entry_number,
          posting_remarks: input.remarks || null,
        })
        .eq('id', input.txnId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-transactions'] });
      toast({ title: 'Posted', description: 'Petty cash transaction posted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    transactions: query.data || [],
    createTransaction: createMutation.mutateAsync,
    approveTransaction: approveMutation.mutateAsync,
    postTransaction: postMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isApproving: approveMutation.isPending,
    isPosting: postMutation.isPending,
    currentMonthLabel: format(new Date(), 'MMMM yyyy'),
  };
}
