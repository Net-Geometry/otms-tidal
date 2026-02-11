import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Project, ProjectStatus } from '@/types/finance';

type UpsertProjectInput = Partial<Project> & {
  project_code: string;
  project_name: string;
  company_id: string;
};

function toNumber(value: unknown) {
  return Number(value || 0);
}

export function useProjects(options?: { includeInactive?: boolean }) {
  const db = supabase as any;
  const includeInactive = options?.includeInactive ?? false;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['projects', includeInactive],
    queryFn: async () => {
      let q = db
        .from('projects')
        .select(`
          *,
          companies:companies!projects_company_id_fkey(id, name, code)
        `)
        .order('project_code', { ascending: true });

      if (!includeInactive) q = q.eq('is_active', true);

      const { data: projects, error } = await q;
      if (error) throw error;

      const { data: allocations, error: allocationError } = await db
        .from('project_cost_allocations')
        .select('project_id, amount');
      if (allocationError) throw allocationError;

      const totalsByProject = new Map<string, number>();
      for (const row of allocations || []) {
        const current = totalsByProject.get(row.project_id) || 0;
        totalsByProject.set(row.project_id, current + toNumber(row.amount));
      }

      return ((projects || []) as Project[]).map((project) => {
        const totalSpent = totalsByProject.get(project.id) || 0;
        const budget = toNumber(project.budget_amount);
        const budgetUtilization = budget > 0 ? (totalSpent / budget) * 100 : 0;

        return {
          ...project,
          total_spent: totalSpent,
          budget_utilization: budgetUtilization,
        };
      });
    },
    staleTime: 30 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (input: UpsertProjectInput) => {
      const payload = {
        project_code: input.project_code,
        project_name: input.project_name,
        company_id: input.company_id,
        client_name: input.client_name || null,
        budget_amount: toNumber(input.budget_amount),
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        status: (input.status || 'active') as ProjectStatus,
        description: input.description || null,
        is_active: input.is_active ?? true,
      };

      if (input.id) {
        const { error } = await db
          .from('projects')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('projects')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-dashboard'] });
      toast({ title: 'Saved', description: 'Project saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await db
        .from('projects')
        .update({ is_active: false })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-dashboard'] });
      toast({ title: 'Archived', description: 'Project archived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const totals = useMemo(() => {
    const projects = query.data || [];
    const totalBudget = projects.reduce((sum, row) => sum + toNumber(row.budget_amount), 0);
    const totalSpent = projects.reduce((sum, row) => sum + toNumber(row.total_spent), 0);
    const activeCount = projects.filter((row) => row.status === 'active' && row.is_active).length;
    const overBudgetCount = projects.filter((row) => toNumber(row.total_spent) > toNumber(row.budget_amount)).length;

    return {
      totalBudget,
      totalSpent,
      activeCount,
      overBudgetCount,
    };
  }, [query.data]);

  return {
    ...query,
    projects: query.data || [],
    totals,
    upsertProject: upsertMutation.mutateAsync,
    archiveProject: archiveMutation.mutateAsync,
    isSaving: upsertMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}
