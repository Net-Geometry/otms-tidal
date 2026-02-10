import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Claim } from '@/types/claims';

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
        .eq('status', 'finance_approved')
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
        .select('id, status, is_posted')
        .in('id', input.claimIds);
      if (fetchErr) throw fetchErr;

      const invalid = (current || []).filter((r: any) => r.status !== 'finance_approved' || r.is_posted);
      if (invalid.length > 0) {
        throw new Error('Only unposted finance-approved claims can be posted');
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('claims')
        .update({
          is_posted: true,
          posted_at: now,
          posted_by: authData.user.id,
          posting_reference: input.reference || null,
          posting_remarks: input.remarks || null,
        })
        .in('id', input.claimIds);
      if (error) throw error;
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
