import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollRun, PayrollRunStatus } from '@/types/payroll';
import type { CreatePayrollRunInput } from '@/types/payroll';

export type PayrollRunsFilter = 'draft' | 'finalized' | 'cancelled' | 'all';

function getStatusList(filter: PayrollRunsFilter): PayrollRunStatus[] | null {
  if (filter === 'all') return null;
  if (filter === 'draft') return ['draft'];
  if (filter === 'finalized') return ['finalized'];
  return ['cancelled'];
}

export function usePayrollRuns(options?: { filter?: PayrollRunsFilter }) {
  const filter = options?.filter ?? 'all';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['payroll-runs', filter],
    queryFn: async () => {
      const db = supabase as any;
      let q = db
        .from('payroll_runs')
        .select(`
          *,
          companies:companies!payroll_runs_company_id_fkey(id, name)
        `)
        .order('created_at', { ascending: false });

      const statuses = getStatusList(filter);
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PayrollRun[];
    },
    staleTime: 20 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreatePayrollRunInput) => {
      const db = supabase as any;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      // Check for existing run in same period
      const { data: existing } = await db
        .from('payroll_runs')
        .select('id')
        .eq('company_id', input.company_id)
        .eq('pay_period_month', input.pay_period_month)
        .eq('pay_period_year', input.pay_period_year)
        .maybeSingle();

      if (existing) {
        throw new Error('A payroll run already exists for this company and period');
      }

      // Generate run number: always 001 per company per period
      const m = String(input.pay_period_month).padStart(2, '0');
      const run_number = `PR-${input.pay_period_year}-${m}-001`;

      const { data, error } = await db
        .from('payroll_runs')
        .insert({
          run_number,
          company_id: input.company_id,
          pay_period_month: input.pay_period_month,
          pay_period_year: input.pay_period_year,
          status: 'draft',
          created_by: authData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PayrollRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Created', description: 'Payroll run created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (runId: string) => {
      const db = supabase as any;
      const { data: current, error: fetchErr } = await db
        .from('payroll_runs')
        .select('status')
        .eq('id', runId)
        .single();
      if (fetchErr) throw fetchErr;
      if (current?.status !== 'draft') {
        throw new Error('Only draft payroll runs can be cancelled');
      }

      const { error } = await db
        .from('payroll_runs')
        .update({ status: 'cancelled' })
        .eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Cancelled', description: 'Payroll run cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (runId: string) => {
      const db = supabase as any;
      const { data: current, error: fetchErr } = await db
        .from('payroll_runs')
        .select('status, memo_id')
        .eq('id', runId)
        .single();
      if (fetchErr) throw fetchErr;
      if (current?.status !== 'draft') {
        throw new Error('Only draft payroll runs can be finalized');
      }

      const { error } = await db
        .from('payroll_runs')
        .update({ status: 'finalized' })
        .eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      toast({ title: 'Finalized', description: 'Payroll run finalized and ready for memo consolidation' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    createPayrollRun: createMutation.mutateAsync,
    cancelPayrollRun: cancelMutation.mutateAsync,
    finalizePayrollRun: finalizeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isFinalizing: finalizeMutation.isPending,
  };
}
