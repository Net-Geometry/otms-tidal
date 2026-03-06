/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PettyCashStatus, PettyCashTransaction, PettyCashTxnType } from '@/types/finance';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';

interface PettyCashTxnFilters {
  status?: PettyCashStatus | 'all';
  txnType?: PettyCashTxnType | 'all';
  month?: number;
  year?: number;
  search?: string;
  fundAccountId?: string;
}

interface CreatePettyCashTxnInput {
  txn_type: PettyCashTxnType;
  txn_date: string;
  description: string;
  fund_account_id: string;
  lines: Array<{ account_id: string; description: string; amount: number }>;
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
    queryKey: ['petty-cash-transactions', filters.status, filters.txnType, filters.month, filters.year, filters.search, filters.fundAccountId],
    queryFn: async () => {
      let q = db
        .from('petty_cash_transactions')
        .select(`
          *,
          account:chart_of_accounts(id, account_code, account_name),
          fund_account:chart_of_accounts!fund_account_id(id, account_code, account_name),
          lines:petty_cash_transaction_lines(id, txn_id, account_id, description, amount, sort_order,
            account:chart_of_accounts!account_id(id, account_code, account_name)
          ),
          project:projects(id, project_code, project_name),
          requester:profiles!petty_cash_transactions_requested_by_fkey(id, employee_id, full_name),
          approver:profiles!petty_cash_transactions_approved_by_fkey(id, employee_id, full_name),
          rejector:profiles!petty_cash_transactions_rejected_by_fkey(id, employee_id, full_name)
        `)
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.txnType && filters.txnType !== 'all') q = q.eq('txn_type', filters.txnType);

      if (filters.fundAccountId) q = q.eq('fund_account_id', filters.fundAccountId);

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
      if (!input.fund_account_id) throw new Error('Fund account is required');
      if (!input.description?.trim()) throw new Error('Description is required');
      if (!input.lines?.length) throw new Error('At least one line item is required');

      const amount = input.lines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
      if (amount <= 0) throw new Error('Total amount must be greater than 0');

      const userId = authData.user.id;

      const txnNumber = await generateTxnNumber(db, input.txn_date);
      const now = new Date().toISOString();
      const currentBalance = await getCurrentApprovedBalance(db);
      const runningBalance = currentBalance + toSignedAmount(input.txn_type, amount);

      const { data: txn, error } = await db
        .from('petty_cash_transactions')
        .insert({
          txn_number: txnNumber,
          txn_type: input.txn_type,
          txn_date: input.txn_date,
          amount,
          description: input.description.trim(),
          account_id: input.lines[0].account_id,
          fund_account_id: input.fund_account_id,
          project_id: input.project_id || null,
          receipt_urls: input.receipt_urls || [],
          payee: input.payee || null,
          department: input.department || null,
          tax_amount: Number(input.tax_amount || 0),
          status: 'approved' as PettyCashStatus,
          requested_by: userId,
          approved_by: userId,
          approved_at: now,
          approval_remarks: 'Auto-approved',
          running_balance: runningBalance,
        })
        .select('id')
        .single();

      if (error) throw error;

      const lineRows = input.lines.map((l, i) => ({
        txn_id: txn.id,
        account_id: l.account_id,
        description: l.description,
        amount: l.amount,
        sort_order: i,
      }));
      const { error: lineError } = await db.from('petty_cash_transaction_lines').insert(lineRows);
      if (lineError) throw lineError;
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

  /* --- approval mutations removed (all txns are auto-approved on create) --- */

  const postMutation = useMutation({
    mutationFn: async (input: { txnId: string; reference?: string; remarks?: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const { data: current, error: fetchError } = await db
        .from('petty_cash_transactions')
        .select('id, txn_number, txn_type, txn_date, amount, description, account_id, fund_account_id, status, is_posted')
        .eq('id', input.txnId)
        .single();
      if (fetchError) throw fetchError;

      if (!current) throw new Error('Transaction not found');
      if (current.status !== 'approved' || current.is_posted) {
        throw new Error('Only approved and unposted transactions can be posted');
      }

      const fundAccountId = current.fund_account_id;
      if (!fundAccountId) throw new Error('Transaction is missing fund_account_id');

      const amount = Number(current.amount || 0);
      if (amount <= 0) throw new Error('Invalid petty cash amount');

      let glLines: Array<{ account_id: string; description: string; debit_amount: number; credit_amount: number }>;

      if (current.txn_type === 'top_up') {
        // DR fund_account, CR cash_bank
        const { data: cashBankRow, error: cbErr } = await db
          .from('chart_of_accounts')
          .select('id')
          .eq('system_tag', 'cash_bank')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (cbErr) throw cbErr;

        glLines = [
          { account_id: fundAccountId, description: current.description, debit_amount: amount, credit_amount: 0 },
          { account_id: cashBankRow.id, description: current.description, debit_amount: 0, credit_amount: amount },
        ];
      } else {
        // expenditure: DR each line's account_id, CR fund_account_id
        const { data: txnLines, error: linesErr } = await db
          .from('petty_cash_transaction_lines')
          .select('account_id, description, amount')
          .eq('txn_id', current.id)
          .order('sort_order', { ascending: true });
        if (linesErr) throw linesErr;

        const debitLines = (txnLines || []).map((l: any) => ({
          account_id: l.account_id,
          description: l.description,
          debit_amount: Number(l.amount || 0),
          credit_amount: 0,
        }));

        const totalDebit = debitLines.reduce((s: number, l: any) => s + l.debit_amount, 0);

        glLines = [
          ...debitLines,
          { account_id: fundAccountId, description: current.description, debit_amount: 0, credit_amount: totalDebit },
        ];
      }

      const posting = await createGLPosting({
        reference_type: 'petty_cash',
        reference_id: current.id,
        entry_date: current.txn_date,
        description: `Petty cash ${current.txn_type === 'top_up' ? 'top-up' : 'expenditure'} ${current.txn_number}`,
        prefix: 'PCV',
        lines: glLines,
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
    postTransaction: postMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isPosting: postMutation.isPending,
    currentMonthLabel: format(new Date(), 'MMMM yyyy'),
  };
}
