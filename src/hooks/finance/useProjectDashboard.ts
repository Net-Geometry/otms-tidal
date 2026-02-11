import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

function asNumber(value: unknown) {
  return Number(value || 0);
}

export function useProjectDashboard() {
  const db = supabase as any;

  return useQuery({
    queryKey: ['project-dashboard'],
    queryFn: async () => {
      const [{ data: projects, error: projectsError }, { data: allocations, error: allocationsError }] = await Promise.all([
        db
          .from('projects')
          .select('id, project_code, project_name, budget_amount, status, is_active')
          .eq('is_active', true),
        db
          .from('project_cost_allocations')
          .select('project_id, amount, cost_category, cost_date, cost_year, cost_month'),
      ]);

      if (projectsError) throw projectsError;
      if (allocationsError) throw allocationsError;

      const projectRows = projects || [];
      const allocationRows = allocations || [];

      const spentByProject = new Map<string, number>();
      for (const row of allocationRows) {
        spentByProject.set(
          row.project_id,
          (spentByProject.get(row.project_id) || 0) + asNumber(row.amount)
        );
      }

      const projectSummaries = projectRows.map((project: any) => {
        const spent = spentByProject.get(project.id) || 0;
        const budget = asNumber(project.budget_amount);
        const utilization = budget > 0 ? (spent / budget) * 100 : 0;

        return {
          ...project,
          spent,
          budget,
          utilization,
        };
      });

      const totalBudget = projectSummaries.reduce((sum, row) => sum + row.budget, 0);
      const totalSpent = projectSummaries.reduce((sum, row) => sum + row.spent, 0);
      const activeProjects = projectSummaries.filter((row) => row.status === 'active').length;
      const completedProjects = projectSummaries.filter((row) => row.status === 'completed').length;
      const overBudgetProjects = projectSummaries.filter((row) => row.spent > row.budget && row.budget > 0).length;

      const categoryMap = new Map<string, number>();
      for (const row of allocationRows) {
        categoryMap.set(
          row.cost_category,
          (categoryMap.get(row.cost_category) || 0) + asNumber(row.amount)
        );
      }

      const costByCategory = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      const monthlyKeys = Array.from({ length: 6 }).map((_, index) => {
        const dt = subMonths(new Date(), 5 - index);
        return format(dt, 'yyyy-MM');
      });

      const monthMap = new Map<string, number>();
      for (const key of monthlyKeys) monthMap.set(key, 0);

      for (const row of allocationRows) {
        const key = `${row.cost_year}-${String(row.cost_month).padStart(2, '0')}`;
        if (!monthMap.has(key)) continue;
        monthMap.set(key, (monthMap.get(key) || 0) + asNumber(row.amount));
      }

      const monthlyCosts = Array.from(monthMap.entries()).map(([month, amount]) => ({
        month,
        label: format(new Date(`${month}-01`), 'MMM yy'),
        amount,
      }));

      const topProjects = [...projectSummaries]
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          project_code: row.project_code,
          project_name: row.project_name,
          amount: row.spent,
        }));

      return {
        stats: {
          activeProjects,
          completedProjects,
          overBudgetProjects,
          totalBudget,
          totalSpent,
          overallUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        },
        projects: projectSummaries,
        costByCategory,
        monthlyCosts,
        topProjects,
      };
    },
    staleTime: 30 * 1000,
  });
}
