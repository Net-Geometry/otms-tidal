/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Claim } from '@/types/claims';
import { createGLPosting } from '@/hooks/finance/useGeneralLedger';

export type ClaimPostingTab = 'ready' | 'posted';

export function useClaimPosting(options?: { tab?: ClaimPostingTab }) {
  const tab = options?.tab ?? 'ready';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['claim-posting', tab],
    queryFn: async () => {
      const db = supabase as any;
      let q = db
        .from('claims')
        .select(`
          *,
          claim_type:claim_types(*),
          profiles:profiles!claims_employee_id_fkey(
            id,
            employee_id,
            full_name,
            department_id,
            departments(name)
          )
        `)
        .in('status', ['hr_approved', 'director_approved', 'gm_approved', 'head_finance_approved'])
        .order('created_at', { ascending: false });

      if (tab === 'ready') q = q.eq('is_posted', false);
      if (tab === 'posted') q = q.eq('is_posted', true);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Claim[];
    },
    staleTime: 20 * 1000,
  });

  const postMutation = useMutation({
    mutationFn: async (input: { claimIds: string[]; reference?: string; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      if (!input.claimIds || input.claimIds.length === 0) return;

      const { data: current, error: fetchErr } = await db
        .from('claims')
        .select('id, ticket_number, claim_date, amount, purpose, status, is_posted')
        .in('id', input.claimIds);
      if (fetchErr) throw fetchErr;

      const postableStatuses = ['hr_approved', 'director_approved', 'gm_approved', 'head_finance_approved'];
      const invalid = (current || []).filter((r: any) => !postableStatuses.includes(r.status) || r.is_posted);
      if (invalid.length > 0) {
        throw new Error('Only unposted approved claims can be posted');
      }

      const { data: glAccounts, error: glAccountsError } = await db
        .from('chart_of_accounts')
        .select('id, system_tag')
        .in('system_tag', ['claims_expense', 'claims_payable', 'trade_payables'])
        .eq('is_active', true);
      if (glAccountsError) throw glAccountsError;

      const claimsExpenseAccountId = (glAccounts || []).find((row: any) => row.system_tag === 'claims_expense')?.id;
      const claimsPayableAccountId = (glAccounts || []).find((row: any) => row.system_tag === 'claims_payable')?.id
        || (glAccounts || []).find((row: any) => row.system_tag === 'trade_payables')?.id;

      if (!claimsExpenseAccountId || !claimsPayableAccountId) {
        throw new Error('Missing chart of account mappings for claims posting');
      }

      const now = new Date().toISOString();

      for (const claim of current || []) {
        const amount = Number(claim.amount || 0);
        if (amount <= 0) {
          throw new Error(`Claim ${claim.ticket_number || claim.id} has invalid amount`);
        }

        const posting = await createGLPosting({
          reference_type: 'claims',
          reference_id: claim.id,
          entry_date: claim.claim_date,
          description: `Claims posting ${claim.ticket_number || claim.id}`,
          prefix: 'JV',
          lines: [
            {
              account_id: claimsExpenseAccountId,
              description: claim.purpose || claim.ticket_number || 'Claim expense',
              debit_amount: amount,
              credit_amount: 0,
            },
            {
              account_id: claimsPayableAccountId,
              description: claim.purpose || claim.ticket_number || 'Claim payable',
              debit_amount: 0,
              credit_amount: amount,
            },
          ],
        });

        const { error: updateError } = await db
          .from('claims')
          .update({
            is_posted: true,
            posted_at: now,
            posted_by: authData.user.id,
            posting_reference: posting.entry_number,
            posting_remarks: input.remarks || null,
          })
          .eq('id', claim.id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-posting'] });
      queryClient.invalidateQueries({ queryKey: ['claim-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['claim-requests'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      toast({ title: 'Posted', description: 'Claim(s) marked as posted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    postClaims: postMutation.mutateAsync,
    isPosting: postMutation.isPending,
  };
}
