/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { BankReconciliation, BankReconciliationItem } from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeReconciliation(row: any): BankReconciliation {
  return {
    ...row,
    statement_balance: toNumber(row.statement_balance),
    reconciled_balance: toNumber(row.reconciled_balance),
    difference: toNumber(row.difference),
  };
}

export interface BankReconciliationFilters {
  companyId?: string;
}

export function useBankReconciliations(filters: BankReconciliationFilters = {}) {
  const db = supabase as any;
  const { profile } = useAuth();

  return useQuery({
    queryKey: [
      'bank-reconciliations',
      filters.companyId || profile?.company_id || 'none',
    ],
    queryFn: async () => {
      const companyId = filters.companyId || profile?.company_id;
      if (!companyId) return [] as BankReconciliation[];

      const { data, error } = await db
        .from('bank_reconciliations')
        .select(`
          *,
          bank_account:bank_accounts(id, account_code, account_name, bank_name)
        `)
        .eq('company_id', companyId)
        .order('statement_date', { ascending: false });

      if (error) throw error;
      return ((data || []) as any[]).map(normalizeReconciliation);
    },
    enabled: !!(filters.companyId || profile?.company_id),
    staleTime: 20 * 1000,
  });
}

export interface CreateReconciliationInput {
  company_id: string;
  bank_account_id: string;
  statement_date: string;
  statement_balance: number;
}

export function useCreateReconciliation() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: CreateReconciliationInput) => {
      if (!input.company_id) throw new Error('Company is required');
      if (!input.bank_account_id) throw new Error('Bank account is required');
      if (!input.statement_date) throw new Error('Statement date is required');

      // 1. Insert the reconciliation record
      const { data: recon, error: reconError } = await db
        .from('bank_reconciliations')
        .insert({
          company_id: input.company_id,
          bank_account_id: input.bank_account_id,
          statement_date: input.statement_date,
          statement_balance: roundMoney(toNumber(input.statement_balance)),
          reconciled_balance: 0,
          difference: roundMoney(toNumber(input.statement_balance)),
        })
        .select('id')
        .single();

      if (reconError) throw reconError;
      const reconciliationId = recon.id as string;

      // 2. Get the bank account's GL account ID
      const { data: bankAccount, error: bankError } = await db
        .from('bank_accounts')
        .select('gl_account_id')
        .eq('id', input.bank_account_id)
        .single();

      if (bankError) throw bankError;
      if (!bankAccount?.gl_account_id) {
        throw new Error('Bank account is not linked to a GL account');
      }

      const glAccountId = bankAccount.gl_account_id as string;

      // 3. Find already-reconciled journal_entry_line IDs (from completed reconciliations)
      const { data: completedRecons, error: completedError } = await db
        .from('bank_reconciliations')
        .select('id')
        .eq('bank_account_id', input.bank_account_id)
        .eq('status', 'completed');

      if (completedError) throw completedError;
      const completedIds = ((completedRecons || []) as any[]).map((r: any) => r.id);

      let alreadyReconciledLineIds: string[] = [];
      if (completedIds.length > 0) {
        const { data: reconciledItems, error: reconciledError } = await db
          .from('bank_reconciliation_items')
          .select('journal_entry_line_id')
          .in('reconciliation_id', completedIds)
          .eq('is_reconciled', true);

        if (reconciledError) throw reconciledError;
        alreadyReconciledLineIds = ((reconciledItems || []) as any[]).map(
          (item: any) => item.journal_entry_line_id,
        );
      }

      // 4. Query all journal_entry_lines for this GL account
      const { data: allLines, error: linesError } = await db
        .from('journal_entry_lines')
        .select('id')
        .eq('account_id', glAccountId);

      if (linesError) throw linesError;

      // 5. Filter out already-reconciled lines
      const reconciledSet = new Set(alreadyReconciledLineIds);
      const unreconciledLines = ((allLines || []) as any[]).filter(
        (line: any) => !reconciledSet.has(line.id),
      );

      // 6. Insert reconciliation items
      if (unreconciledLines.length > 0) {
        const { error: itemsError } = await db
          .from('bank_reconciliation_items')
          .insert(
            unreconciledLines.map((line: any) => ({
              reconciliation_id: reconciliationId,
              journal_entry_line_id: line.id,
              is_reconciled: false,
            })),
          );
        if (itemsError) throw itemsError;
      }

      return { id: reconciliationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] });
      toast({ title: 'Created', description: 'Bank reconciliation created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createReconciliation: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useReconciliationDetail(id?: string | null) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['bank-reconciliation-detail', id || 'none'],
    queryFn: async () => {
      // 1. Fetch the reconciliation
      const { data: reconRaw, error: reconError } = await db
        .from('bank_reconciliations')
        .select(`
          *,
          bank_account:bank_accounts(id, account_code, account_name, bank_name)
        `)
        .eq('id', id)
        .single();

      if (reconError) throw reconError;
      const reconciliation = normalizeReconciliation(reconRaw);

      // 2. Fetch items with nested joins
      const { data: itemsRaw, error: itemsError } = await db
        .from('bank_reconciliation_items')
        .select(`
          *,
          journal_entry_line:journal_entry_lines(
            id, account_id, description, debit_amount, credit_amount,
            journal_entry:journal_entries(entry_date, entry_number, description, reference_type)
          )
        `)
        .eq('reconciliation_id', id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const items: BankReconciliationItem[] = ((itemsRaw || []) as any[]).map((item: any) => {
        const line = item.journal_entry_line || {};
        const entry = line.journal_entry || {};

        return {
          id: item.id,
          reconciliation_id: item.reconciliation_id,
          journal_entry_line_id: item.journal_entry_line_id,
          is_reconciled: item.is_reconciled,
          reconciled_at: item.reconciled_at,
          entry_date: entry.entry_date || null,
          entry_number: entry.entry_number || null,
          description: line.description || entry.description || null,
          reference_type: entry.reference_type || null,
          debit_amount: toNumber(line.debit_amount),
          credit_amount: toNumber(line.credit_amount),
        };
      });

      return { reconciliation, items };
    },
    enabled: !!id,
    staleTime: 10 * 1000,
  });
}

export function useToggleReconciled() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: {
      reconciliationId: string;
      itemId: string;
      isReconciled: boolean;
    }) => {
      // 1. Update the item
      const { error: updateError } = await db
        .from('bank_reconciliation_items')
        .update({
          is_reconciled: input.isReconciled,
          reconciled_at: input.isReconciled ? new Date().toISOString() : null,
        })
        .eq('id', input.itemId);

      if (updateError) throw updateError;

      // 2. Recalculate reconciled_balance from all reconciled items
      const { data: reconciledItems, error: itemsError } = await db
        .from('bank_reconciliation_items')
        .select(`
          journal_entry_line:journal_entry_lines(debit_amount, credit_amount)
        `)
        .eq('reconciliation_id', input.reconciliationId)
        .eq('is_reconciled', true);

      if (itemsError) throw itemsError;

      let reconciledBalance = 0;
      for (const item of (reconciledItems || []) as any[]) {
        const line = item.journal_entry_line || {};
        reconciledBalance += toNumber(line.debit_amount) - toNumber(line.credit_amount);
      }
      reconciledBalance = roundMoney(reconciledBalance);

      // 3. Fetch the reconciliation to get statement_balance
      const { data: recon, error: reconError } = await db
        .from('bank_reconciliations')
        .select('statement_balance')
        .eq('id', input.reconciliationId)
        .single();

      if (reconError) throw reconError;

      const statementBalance = toNumber(recon.statement_balance);
      const difference = roundMoney(statementBalance - reconciledBalance);

      // 4. Update the reconciliation
      const { error: reconUpdateError } = await db
        .from('bank_reconciliations')
        .update({
          reconciled_balance: reconciledBalance,
          difference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reconciliationId);

      if (reconUpdateError) throw reconUpdateError;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', input.reconciliationId] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    toggleReconciled: mutation.mutateAsync,
    isToggling: mutation.isPending,
  };
}

export function useCompleteReconciliation() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { reconciliationId: string }) => {
      // Verify difference is 0
      const { data: recon, error: reconError } = await db
        .from('bank_reconciliations')
        .select('id, difference, status')
        .eq('id', input.reconciliationId)
        .single();

      if (reconError) throw reconError;
      if (!recon) throw new Error('Reconciliation not found');

      if (recon.status === 'completed') throw new Error('Reconciliation is already completed');

      const diff = toNumber(recon.difference);
      if (Math.abs(diff) > 0.0001) {
        throw new Error('Cannot complete reconciliation: difference must be zero');
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { error: updateError } = await db
        .from('bank_reconciliations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: authData?.user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reconciliationId);

      if (updateError) throw updateError;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', input.reconciliationId] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'] });
      toast({ title: 'Completed', description: 'Bank reconciliation completed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    completeReconciliation: mutation.mutateAsync,
    isCompleting: mutation.isPending,
  };
}
