/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';
import type { ChartOfAccount, GLOpeningBalance } from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

export function useOpeningBalances(companyId: string, fiscalYear: number) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['gl-opening-balances', companyId, fiscalYear],
    queryFn: async () => {
      const { data, error } = await db
        .from('gl_opening_balances')
        .select(
          `
            *,
            account:chart_of_accounts(id, account_code, account_name, account_type)
          `,
        )
        .eq('company_id', companyId)
        .eq('fiscal_year', fiscalYear)
        .order('account(account_code)', { ascending: true });

      if (error) throw error;

      return ((data || []) as any[]).map(
        (row): GLOpeningBalance => ({
          ...row,
          debit_amount: toNumber(row.debit_amount),
          credit_amount: toNumber(row.credit_amount),
        }),
      );
    },
    enabled: !!companyId && fiscalYear > 0,
    staleTime: 20 * 1000,
  });
}

export function usePostableAccounts(companyId: string) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['postable-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await db
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type')
        .eq('is_postable', true)
        .eq('is_active', true)
        .order('account_code', { ascending: true });

      if (error) throw error;
      return (data || []) as Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name' | 'account_type'>[];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

interface SaveOpeningBalancesInput {
  companyId: string;
  fiscalYear: number;
  balances: {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
  }[];
}

export function useSaveOpeningBalances() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: SaveOpeningBalancesInput) => {
      const { companyId, fiscalYear, balances } = input;

      // Delete existing rows for this company + year
      const { error: deleteError } = await db
        .from('gl_opening_balances')
        .delete()
        .eq('company_id', companyId)
        .eq('fiscal_year', fiscalYear);

      if (deleteError) throw deleteError;

      if (balances.length === 0) return;

      // Insert new batch
      const { error: insertError } = await db
        .from('gl_opening_balances')
        .insert(
          balances.map((b) => ({
            company_id: companyId,
            fiscal_year: fiscalYear,
            account_id: b.account_id,
            debit_amount: b.debit_amount,
            credit_amount: b.credit_amount,
          })),
        );

      if (insertError) throw insertError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['gl-opening-balances', variables.companyId, variables.fiscalYear],
      });
      toast({ title: 'Saved', description: 'Opening balances saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    saveOpeningBalances: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

interface PostOpeningBalancesInput {
  companyId: string;
  fiscalYear: number;
}

export function usePostOpeningBalances() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: PostOpeningBalancesInput) => {
      const { companyId, fiscalYear } = input;

      // Fetch all opening balances for company + year with non-zero amounts
      const { data, error } = await db
        .from('gl_opening_balances')
        .select('account_id, debit_amount, credit_amount')
        .eq('company_id', companyId)
        .eq('fiscal_year', fiscalYear);

      if (error) throw error;

      const rows = ((data || []) as any[]).filter(
        (row) => toNumber(row.debit_amount) > 0 || toNumber(row.credit_amount) > 0,
      );

      if (rows.length === 0) {
        throw new Error('No opening balances with non-zero amounts to post');
      }

      // Build GL lines
      const lines = rows.map((row) => ({
        account_id: row.account_id as string,
        debit_amount: toNumber(row.debit_amount),
        credit_amount: toNumber(row.credit_amount),
        description: `Opening Balance FY${fiscalYear}`,
      }));

      // Post via createGLPosting
      return createGLPosting({
        company_id: companyId,
        entry_date: `${fiscalYear}-01-01`,
        description: `Opening Balances FY${fiscalYear}`,
        reference_type: 'manual',
        reference_id: null,
        prefix: 'OB',
        lines,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['gl-opening-balances'] });
      toast({
        title: 'Posted',
        description: `Opening balances posted as ${result.entry_number}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postOpeningBalances: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}
