import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollRun } from '@/types/payroll';

export type PayrollPostingTab = 'ready' | 'posted';

export function usePayrollPosting(options?: { tab?: PayrollPostingTab }) {
  const tab = options?.tab ?? 'ready';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['payroll-posting', tab],
    queryFn: async () => {
      const db = supabase as any;
      let q = db
        .from('payroll_runs')
        .select(`
          *,
          companies:companies!payroll_runs_company_id_fkey(id, name)
        `)
        .eq('status', 'finance_approved')
        .order('created_at', { ascending: false });

      if (tab === 'ready') q = q.eq('is_posted', false);
      if (tab === 'posted') q = q.eq('is_posted', true);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PayrollRun[];
    },
    staleTime: 20 * 1000,
  });

  const postMutation = useMutation({
    mutationFn: async (input: { runIds: string[]; reference?: string; remarks?: string }) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      if (!input.runIds || input.runIds.length === 0) return;

      const { data: current, error: fetchErr } = await db
        .from('payroll_runs')
        .select('id, status, is_posted')
        .in('id', input.runIds);
      if (fetchErr) throw fetchErr;

      const invalid = (current || []).filter(
        (r: any) => r.status !== 'finance_approved' || r.is_posted
      );
      if (invalid.length > 0) {
        throw new Error('Only unposted finance-approved payroll runs can be posted');
      }

      const now = new Date().toISOString();
      const { error } = await db
        .from('payroll_runs')
        .update({
          is_posted: true,
          posted_at: now,
          posted_by: authData.user.id,
          posting_reference: input.reference || null,
          posting_remarks: input.remarks || null,
          status: 'posted',
        })
        .in('id', input.runIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-posting'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      toast({ title: 'Posted', description: 'Payroll run(s) marked as posted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    postPayrollRuns: postMutation.mutateAsync,
    isPosting: postMutation.isPending,
  };
}
