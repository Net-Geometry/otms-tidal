import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

function asNumber(value: unknown) {
  return Number(value || 0);
}

export function useFinanceDashboard() {
  const db = supabase as any;

  return useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const sixMonthStart = format(subMonths(new Date(), 5), 'yyyy-MM-01');

      const [
        { data: apInvoices, error: apError },
        { data: arInvoices, error: arError },
        { data: bankAccounts, error: bankError },
        { data: payrollPosted, error: payrollPostedError },
        { count: payrollPendingCount, error: payrollPendingError },
        { data: claimsPosted, error: claimsPostedError },
        { count: claimsPendingCount, error: claimsPendingError },
        { data: pettyApproved, error: pettyApprovedError },
        { data: allocations, error: allocationsError },
        { data: projects, error: projectsError },
      ] = await Promise.all([
        db.from('ap_invoices').select('id, total_amount, paid_amount, due_date, status').in('status', ['posted', 'partially_paid']),
        db.from('ar_invoices').select('id, total_amount, paid_amount, due_date, status').in('status', ['posted', 'partially_paid']),
        db.from('bank_accounts').select('id, current_balance').eq('is_active', true),
        db.from('payroll_runs').select('id, total_net_salary, posted_at').eq('is_posted', true),
        db.from('payroll_runs').select('id', { count: 'exact', head: true }).eq('status', 'pending_finance'),
        db.from('claims').select('id, amount, posted_at').eq('is_posted', true),
        db.from('claims').select('id', { count: 'exact', head: true }).eq('status', 'pending_finance'),
        db.from('petty_cash_transactions').select('id, txn_type, amount, txn_date, status').eq('status', 'approved'),
        db.from('project_cost_allocations').select('project_id, amount'),
        db.from('projects').select('id, project_code, project_name, budget_amount').eq('is_active', true),
      ]);

      if (apError) throw apError;
      if (arError) throw arError;
      if (bankError) throw bankError;
      if (payrollPostedError) throw payrollPostedError;
      if (payrollPendingError) throw payrollPendingError;
      if (claimsPostedError) throw claimsPostedError;
      if (claimsPendingError) throw claimsPendingError;
      if (pettyApprovedError) throw pettyApprovedError;
      if (allocationsError) throw allocationsError;
      if (projectsError) throw projectsError;

      // KPI 1: AP Outstanding
      const apOutstanding = (apInvoices || []).reduce(
        (sum: number, row: any) => sum + (asNumber(row.total_amount) - asNumber(row.paid_amount)),
        0
      );

      // KPI 2: AR Outstanding
      const arOutstanding = (arInvoices || []).reduce(
        (sum: number, row: any) => sum + (asNumber(row.total_amount) - asNumber(row.paid_amount)),
        0
      );

      // KPI 3: Cash Position
      const cashPosition = (bankAccounts || []).reduce(
        (sum: number, row: any) => sum + asNumber(row.current_balance),
        0
      );

      // KPI 4: Overdue Invoices
      const overdueAp = (apInvoices || []).filter((row: any) => row.due_date < today).length;
      const overdueAr = (arInvoices || []).filter((row: any) => row.due_date < today).length;
      const overdueCount = overdueAp + overdueAr;

      // Expense trend chart (keep existing)
      const monthKeys = Array.from({ length: 6 }).map((_, index) => {
        const dt = subMonths(new Date(), 5 - index);
        return format(dt, 'yyyy-MM');
      });

      const trendMap = new Map<string, { payroll: number; claims: number; pettyCash: number }>();
      for (const key of monthKeys) {
        trendMap.set(key, { payroll: 0, claims: 0, pettyCash: 0 });
      }

      for (const row of payrollPosted || []) {
        if (!row.posted_at) continue;
        const key = format(new Date(row.posted_at), 'yyyy-MM');
        if (!trendMap.has(key)) continue;
        trendMap.get(key)!.payroll += asNumber(row.total_net_salary);
      }

      for (const row of claimsPosted || []) {
        if (!row.posted_at) continue;
        const key = format(new Date(row.posted_at), 'yyyy-MM');
        if (!trendMap.has(key)) continue;
        trendMap.get(key)!.claims += asNumber(row.amount);
      }

      for (const row of pettyApproved || []) {
        const key = format(new Date(row.txn_date), 'yyyy-MM');
        if (!trendMap.has(key)) continue;
        if (row.txn_type === 'expenditure') {
          trendMap.get(key)!.pettyCash += asNumber(row.amount);
        }
      }

      const expenseTrend = Array.from(trendMap.entries()).map(([month, value]) => ({
        month,
        label: format(new Date(`${month}-01`), 'MMM yy'),
        payroll: value.payroll,
        claims: value.claims,
        pettyCash: value.pettyCash,
      }));

      // Project cost chart (keep existing)
      const spentByProject = new Map<string, number>();
      for (const row of allocations || []) {
        spentByProject.set(row.project_id, (spentByProject.get(row.project_id) || 0) + asNumber(row.amount));
      }

      const topProjectsByCost = (projects || [])
        .map((row: any) => ({
          id: row.id,
          project_code: row.project_code,
          project_name: row.project_name,
          amount: spentByProject.get(row.id) || 0,
        }))
        .sort((a: any, b: any) => b.amount - a.amount)
        .slice(0, 5);

      return {
        stats: {
          apOutstanding,
          arOutstanding,
          cashPosition,
          overdueCount,
        },
        pendingActions: {
          pendingPayrollCount: payrollPendingCount || 0,
          pendingClaimsCount: claimsPendingCount || 0,
        },
        charts: {
          expenseTrend,
          topProjectsByCost,
        },
      };
    },
    staleTime: 20 * 1000,
  });
}
