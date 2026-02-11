import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CostCategory, ProjectCostAllocation } from '@/types/finance';

interface ProjectCostFilters {
  projectId?: string;
}

interface ManualCostAllocationInput {
  project_id: string;
  cost_category: CostCategory;
  account_id: string;
  amount: number;
  cost_date: string;
  description?: string | null;
}

export function useProjectCosts(filters: ProjectCostFilters = {}) {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['project-cost-allocations', filters.projectId || 'all'],
    queryFn: async () => {
      let q = db
        .from('project_cost_allocations')
        .select(`
          *,
          project:projects(id, project_code, project_name),
          account:chart_of_accounts(id, account_code, account_name)
        `)
        .order('cost_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.projectId) q = q.eq('project_id', filters.projectId);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ProjectCostAllocation[];
    },
    staleTime: 20 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: ManualCostAllocationInput) => {
      if (!input.project_id) throw new Error('Project is required');
      if (!input.account_id) throw new Error('Account is required');
      if (!input.cost_date) throw new Error('Cost date is required');
      if (Number(input.amount) <= 0) throw new Error('Amount must be greater than 0');

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const date = new Date(input.cost_date);
      const costMonth = date.getMonth() + 1;
      const costYear = date.getFullYear();

      const { error } = await db
        .from('project_cost_allocations')
        .insert({
          project_id: input.project_id,
          source_type: 'manual',
          source_id: null,
          cost_category: input.cost_category,
          account_id: input.account_id,
          amount: Number(input.amount),
          cost_date: input.cost_date,
          cost_month: costMonth,
          cost_year: costYear,
          description: input.description || null,
          created_by: authData.user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-cost-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-dashboard'] });
      toast({ title: 'Created', description: 'Cost allocation created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const summaryByCategory = useMemo(() => {
    const rows = query.data || [];
    const map = new Map<CostCategory, number>();

    for (const row of rows) {
      const current = map.get(row.cost_category) || 0;
      map.set(row.cost_category, current + Number(row.amount || 0));
    }

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [query.data]);

  const summaryByMonth = useMemo(() => {
    const rows = query.data || [];
    const map = new Map<string, number>();

    for (const row of rows) {
      const month = `${row.cost_year}-${String(row.cost_month).padStart(2, '0')}`;
      const current = map.get(month) || 0;
      map.set(month, current + Number(row.amount || 0));
    }

    return Array.from(map.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [query.data]);

  return {
    ...query,
    allocations: query.data || [],
    summaryByCategory,
    summaryByMonth,
    createManualAllocation: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
