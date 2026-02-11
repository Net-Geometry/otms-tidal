import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { CostCategory, ProjectCostAllocation } from '@/types/finance';

function asNumber(value: unknown) {
  return Number(value || 0);
}

function initCategoryBucket() {
  return {
    labor: 0,
    materials: 0,
    subcontractor: 0,
    equipment: 0,
    overhead: 0,
    travel: 0,
    other: 0,
  } as Record<CostCategory, number>;
}

export interface ProjectCostSummaryParams {
  startDate: string;
  endDate: string;
  companyId?: string;
}

export function useProjectCostSummaryReport(params: ProjectCostSummaryParams) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['finance-report', 'project-cost-summary', params.startDate, params.endDate, params.companyId || 'all'],
    queryFn: async () => {
      let q = db
        .from('project_cost_allocations')
        .select(`
          *,
          project:projects(id, project_code, project_name, company_id, companies(name))
        `)
        .gte('cost_date', params.startDate)
        .lte('cost_date', params.endDate)
        .order('cost_date', { ascending: true });

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as (ProjectCostAllocation & {
        project?: {
          id: string;
          project_code: string;
          project_name: string;
          company_id: string;
          companies?: { name: string } | null;
        } | null;
      })[];

      const filtered = params.companyId
        ? rows.filter((row) => row.project?.company_id === params.companyId)
        : rows;

      const grouped = new Map<string, any>();

      for (const row of filtered) {
        const project = row.project;
        if (!project) continue;

        const key = project.id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            project_id: project.id,
            project_code: project.project_code,
            project_name: project.project_name,
            company_name: project.companies?.name || '-',
            categories: initCategoryBucket(),
            total: 0,
          });
        }

        const item = grouped.get(key);
        const amount = asNumber(row.amount);
        item.categories[row.cost_category] += amount;
        item.total += amount;
      }

      return Array.from(grouped.values()).sort((a, b) => a.project_code.localeCompare(b.project_code));
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

export interface ClaimsReportParams {
  startDate: string;
  endDate: string;
  status?: string;
  companyId?: string;
}

export function useClaimsReport(params: ClaimsReportParams) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['finance-report', 'claims', params.startDate, params.endDate, params.status || 'all', params.companyId || 'all'],
    queryFn: async () => {
      let q = db
        .from('claims')
        .select(`
          id,
          ticket_number,
          claim_date,
          amount,
          status,
          is_posted,
          claim_type:claim_types(id, code, name),
          profiles:profiles!claims_employee_id_fkey(id, employee_id, full_name, company_id, companies(name))
        `)
        .gte('claim_date', params.startDate)
        .lte('claim_date', params.endDate)
        .order('claim_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (params.status && params.status !== 'all') q = q.eq('status', params.status);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as any[];
      const filtered = params.companyId
        ? rows.filter((row) => row.profiles?.company_id === params.companyId)
        : rows;

      const totalsByType = new Map<string, number>();
      let grandTotal = 0;

      for (const row of filtered) {
        const key = row.claim_type?.name || 'Unknown';
        const amount = asNumber(row.amount);
        totalsByType.set(key, (totalsByType.get(key) || 0) + amount);
        grandTotal += amount;
      }

      return {
        rows: filtered,
        grandTotal,
        totalsByType: Array.from(totalsByType.entries())
          .map(([type, amount]) => ({ type, amount }))
          .sort((a, b) => b.amount - a.amount),
      };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

export interface PettyCashStatementParams {
  month: number;
  year: number;
}

export function usePettyCashStatement(params: PettyCashStatementParams) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['finance-report', 'petty-cash-statement', params.month, params.year],
    queryFn: async () => {
      const start = `${params.year}-${String(params.month).padStart(2, '0')}-01`;
      const end = `${params.year}-${String(params.month).padStart(2, '0')}-31`;

      const [{ data: openingRows, error: openingError }, { data: monthRows, error: monthError }] = await Promise.all([
        db
          .from('petty_cash_transactions')
          .select('txn_type, amount, status, txn_date')
          .lt('txn_date', start)
          .eq('status', 'approved'),
        db
          .from('petty_cash_transactions')
          .select(`
            *,
            account:chart_of_accounts(id, account_code, account_name),
            requester:profiles!petty_cash_transactions_requested_by_fkey(id, employee_id, full_name)
          `)
          .gte('txn_date', start)
          .lte('txn_date', end)
          .order('txn_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (openingError) throw openingError;
      if (monthError) throw monthError;

      const openingBalance = (openingRows || []).reduce((sum: number, row: any) => {
        if (row.txn_type === 'top_up') return sum + asNumber(row.amount);
        return sum - asNumber(row.amount);
      }, 0);

      const rows = monthRows || [];
      const approvedMovement = rows
        .filter((row: any) => row.status === 'approved')
        .reduce((sum: number, row: any) => {
          if (row.txn_type === 'top_up') return sum + asNumber(row.amount);
          return sum - asNumber(row.amount);
        }, 0);

      const totalTopUps = rows
        .filter((row: any) => row.status === 'approved' && row.txn_type === 'top_up')
        .reduce((sum: number, row: any) => sum + asNumber(row.amount), 0);
      const totalExpenditures = rows
        .filter((row: any) => row.status === 'approved' && row.txn_type === 'expenditure')
        .reduce((sum: number, row: any) => sum + asNumber(row.amount), 0);

      return {
        month: params.month,
        year: params.year,
        periodLabel: format(new Date(`${params.year}-${String(params.month).padStart(2, '0')}-01`), 'MMMM yyyy'),
        openingBalance,
        closingBalance: openingBalance + approvedMovement,
        totalTopUps,
        totalExpenditures,
        rows,
      };
    },
    enabled: !!params.month && !!params.year,
  });
}

export interface PaymentRegisterParams {
  startDate: string;
  endDate: string;
}

export function usePaymentRegister(params: PaymentRegisterParams) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['finance-report', 'payment-register', params.startDate, params.endDate],
    queryFn: async () => {
      const [{ data: payrollRows, error: payrollError }, { data: claimRows, error: claimError }, { data: pettyRows, error: pettyError }] = await Promise.all([
        db
          .from('payroll_runs')
          .select('id, run_number, posted_at, posting_reference, total_net_salary, companies:companies!payroll_runs_company_id_fkey(name)')
          .eq('is_posted', true)
          .gte('posted_at', `${params.startDate}T00:00:00`)
          .lte('posted_at', `${params.endDate}T23:59:59`),
        db
          .from('claims')
          .select('id, ticket_number, posted_at, posting_reference, amount, profiles:profiles!claims_employee_id_fkey(full_name)')
          .eq('is_posted', true)
          .gte('posted_at', `${params.startDate}T00:00:00`)
          .lte('posted_at', `${params.endDate}T23:59:59`),
        db
          .from('petty_cash_transactions')
          .select('id, txn_number, posted_at, posting_reference, amount, txn_type, description')
          .eq('is_posted', true)
          .gte('posted_at', `${params.startDate}T00:00:00`)
          .lte('posted_at', `${params.endDate}T23:59:59`),
      ]);

      if (payrollError) throw payrollError;
      if (claimError) throw claimError;
      if (pettyError) throw pettyError;

      const payments = [
        ...(payrollRows || []).map((row: any) => ({
          id: row.id,
          source: 'payroll' as const,
          reference_no: row.run_number,
          posting_reference: row.posting_reference,
          posted_at: row.posted_at,
          description: `Payroll run (${row.companies?.name || 'N/A'})`,
          amount: asNumber(row.total_net_salary),
        })),
        ...(claimRows || []).map((row: any) => ({
          id: row.id,
          source: 'claims' as const,
          reference_no: row.ticket_number,
          posting_reference: row.posting_reference,
          posted_at: row.posted_at,
          description: `Claim reimbursement (${row.profiles?.full_name || 'N/A'})`,
          amount: asNumber(row.amount),
        })),
        ...(pettyRows || []).map((row: any) => ({
          id: row.id,
          source: 'petty_cash' as const,
          reference_no: row.txn_number,
          posting_reference: row.posting_reference,
          posted_at: row.posted_at,
          description: `Petty cash ${row.txn_type.replace('_', ' ')} - ${row.description}`,
          amount: asNumber(row.amount),
        })),
      ].sort((a, b) => {
        return new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime();
      });

      const totalAmount = payments.reduce((sum, row) => sum + asNumber(row.amount), 0);

      return {
        rows: payments,
        totalAmount,
      };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}
