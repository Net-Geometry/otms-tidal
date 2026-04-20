import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AccountType, ChartOfAccount, CostCategory, GLReferenceType, ProjectCostAllocation } from '@/types/finance';
import { GL_REFERENCE_TYPE_LABELS } from '@/types/finance';

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

// ---------------------------------------------------------------------------
// Profit & Loss / Balance Sheet
// ---------------------------------------------------------------------------

export interface ReportLineItem {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  level: 0 | 1 | 2 | 3 | 4;
  parent_id: string | null;
  sort_order: number;
  amount: number;
}

export interface ReportSection {
  account: Pick<ChartOfAccount, 'id' | 'account_code' | 'account_name' | 'account_type' | 'level' | 'sort_order'>;
  amount: number;
  children: ReportSection[];
}

function buildReportTree(items: ReportLineItem[], showZero: boolean, maxLevel?: number): ReportSection[] {
  const byId = new Map<string, ReportLineItem>();
  for (const item of items) byId.set(item.account_id, item);

  const childrenOf = new Map<string | null, ReportLineItem[]>();
  for (const item of items) {
    const key = item.parent_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(item);
  }

  const build = (parentId: string | null): ReportSection[] => {
    const kids = childrenOf.get(parentId) || [];
    kids.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.account_code.localeCompare(b.account_code);
    });

    return kids
      .map((item) => {
        // Always build full children to get correct subtotals
        const fullChildren = build(item.account_id);
        const subtotal = fullChildren.length > 0
          ? fullChildren.reduce((s, c) => s + c.amount, 0)
          : item.amount;

        // If maxLevel is set and this account is at or beyond maxLevel,
        // hide children so this account appears as a leaf with the aggregated amount
        const atMaxLevel = maxLevel !== undefined && item.level >= maxLevel;
        const displayChildren = atMaxLevel ? [] : fullChildren;

        return {
          account: {
            id: item.account_id,
            account_code: item.account_code,
            account_name: item.account_name,
            account_type: item.account_type,
            level: item.level,
            sort_order: item.sort_order,
          },
          amount: subtotal,
          children: displayChildren,
        };
      })
      .filter((section) => showZero || section.amount !== 0 || section.children.length > 0);
  };

  return build(null);
}

export interface ProfitAndLossParams {
  startDate: string;
  endDate: string;
  companyId?: string;
}

export interface ProfitAndLossResult {
  revenue: ReportSection[];
  expenses: ReportSection[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  showZero: boolean;
}

export function useProfitAndLoss(params: ProfitAndLossParams & { showZero?: boolean; maxLevel?: number }) {
  const db = supabase as any;

  return useQuery<ProfitAndLossResult>({
    queryKey: ['finance-report', 'profit-loss', params.startDate, params.endDate, params.companyId || 'all', params.showZero ?? false, params.maxLevel ?? 'all'],
    queryFn: async () => {
      // Fetch COA
      const { data: accounts, error: coaError } = await db
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type, level, parent_id, sort_order, is_active')
        .in('account_type', ['revenue', 'expense'])
        .eq('is_active', true)
        .order('sort_order')
        .order('account_code');
      if (coaError) throw coaError;

      // Fetch journal entry lines in date range
      let q = db
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, entry_date, company_id, is_reversed)
        `)
        .gte('journal_entry.entry_date', params.startDate)
        .lte('journal_entry.entry_date', params.endDate)
        .eq('journal_entry.is_reversed', false);

      if (params.companyId) q = q.eq('journal_entry.company_id', params.companyId);

      const { data: lines, error: lineError } = await q;
      if (lineError) throw lineError;

      // Aggregate by account
      const balances = new Map<string, { debit: number; credit: number }>();
      for (const line of (lines || []) as any[]) {
        const id = line.account_id as string;
        if (!balances.has(id)) balances.set(id, { debit: 0, credit: 0 });
        const b = balances.get(id)!;
        b.debit += asNumber(line.debit_amount);
        b.credit += asNumber(line.credit_amount);
      }

      // Build line items
      const coaList = (accounts || []) as ChartOfAccount[];
      const revenueItems: ReportLineItem[] = [];
      const expenseItems: ReportLineItem[] = [];

      for (const acct of coaList) {
        const bal = balances.get(acct.id) || { debit: 0, credit: 0 };
        const amount = acct.account_type === 'revenue'
          ? bal.credit - bal.debit
          : bal.debit - bal.credit;

        const item: ReportLineItem = {
          account_id: acct.id,
          account_code: acct.account_code,
          account_name: acct.account_name,
          account_type: acct.account_type,
          level: acct.level,
          parent_id: acct.parent_id,
          sort_order: acct.sort_order,
          amount,
        };

        if (acct.account_type === 'revenue') revenueItems.push(item);
        else expenseItems.push(item);
      }

      const showZero = params.showZero ?? false;
      const revenue = buildReportTree(revenueItems, showZero, params.maxLevel);
      const expenses = buildReportTree(expenseItems, showZero, params.maxLevel);

      const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
      const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

      return {
        revenue,
        expenses,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        showZero,
      };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

export interface BalanceSheetParams {
  asOfDate: string;
  companyId?: string;
}

export interface BalanceSheetResult {
  assets: ReportSection[];
  liabilities: ReportSection[];
  equity: ReportSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
  isBalanced: boolean;
  showZero: boolean;
}

export function useBalanceSheet(params: BalanceSheetParams & { showZero?: boolean; maxLevel?: number }) {
  const db = supabase as any;

  return useQuery<BalanceSheetResult>({
    queryKey: ['finance-report', 'balance-sheet', params.asOfDate, params.companyId || 'all', params.showZero ?? false, params.maxLevel ?? 'all'] as const,
    queryFn: async () => {
      // Fetch COA (all types)
      const { data: accounts, error: coaError } = await db
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type, level, parent_id, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order')
        .order('account_code');
      if (coaError) throw coaError;

      // Fetch ALL journal entry lines up to asOfDate
      let q = db
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, entry_date, company_id, is_reversed)
        `)
        .lte('journal_entry.entry_date', params.asOfDate)
        .eq('journal_entry.is_reversed', false);

      if (params.companyId) q = q.eq('journal_entry.company_id', params.companyId);

      const { data: lines, error: lineError } = await q;
      if (lineError) throw lineError;

      // Aggregate by account
      const balances = new Map<string, { debit: number; credit: number }>();
      for (const line of (lines || []) as any[]) {
        const id = line.account_id as string;
        if (!balances.has(id)) balances.set(id, { debit: 0, credit: 0 });
        const b = balances.get(id)!;
        b.debit += asNumber(line.debit_amount);
        b.credit += asNumber(line.credit_amount);
      }

      const coaList = (accounts || []) as ChartOfAccount[];
      const coaMap = new Map<string, ChartOfAccount>();
      for (const acct of coaList) coaMap.set(acct.id, acct);

      // Compute retained earnings (revenue - expense for all time up to asOfDate)
      let totalRevenueAllTime = 0;
      let totalExpenseAllTime = 0;
      for (const [accountId, bal] of balances) {
        const acct = coaMap.get(accountId);
        if (!acct) continue;
        if (acct.account_type === 'revenue') totalRevenueAllTime += (bal.credit - bal.debit);
        if (acct.account_type === 'expense') totalExpenseAllTime += (bal.debit - bal.credit);
      }
      const retainedEarnings = totalRevenueAllTime - totalExpenseAllTime;

      // Build line items for BS accounts
      const assetItems: ReportLineItem[] = [];
      const liabilityItems: ReportLineItem[] = [];
      const equityItems: ReportLineItem[] = [];

      for (const acct of coaList) {
        if (!['asset', 'liability', 'equity'].includes(acct.account_type)) continue;

        const bal = balances.get(acct.id) || { debit: 0, credit: 0 };
        let amount: number;
        if (acct.account_type === 'asset') {
          amount = bal.debit - bal.credit;
        } else {
          amount = bal.credit - bal.debit;
        }

        const item: ReportLineItem = {
          account_id: acct.id,
          account_code: acct.account_code,
          account_name: acct.account_name,
          account_type: acct.account_type,
          level: acct.level,
          parent_id: acct.parent_id,
          sort_order: acct.sort_order,
          amount,
        };

        if (acct.account_type === 'asset') assetItems.push(item);
        else if (acct.account_type === 'liability') liabilityItems.push(item);
        else equityItems.push(item);
      }

      const showZero = params.showZero ?? false;
      const assets = buildReportTree(assetItems, showZero, params.maxLevel);
      const liabilities = buildReportTree(liabilityItems, showZero, params.maxLevel);
      const equity = buildReportTree(equityItems, showZero, params.maxLevel);

      const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
      const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
      const equityFromAccounts = equity.reduce((s, r) => s + r.amount, 0);
      const totalEquity = equityFromAccounts + retainedEarnings;

      return {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities,
        totalEquity,
        retainedEarnings,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
        showZero,
      };
    },
    enabled: !!params.asOfDate,
  });
}

// ---------------------------------------------------------------------------
// AP Aging
// ---------------------------------------------------------------------------

export interface AgingBucket {
  current: number;   // 0-30 days
  days30: number;    // 31-60 days
  days60: number;    // 61-90 days
  days90plus: number; // 90+ days
  total: number;
}

export type ApAgingStatus = 'outstanding' | 'partially_paid' | 'paid';

export interface AgingInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  original_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: ApAgingStatus;
  payment_date: string | null;
  payment_ref: string | null; // PV number(s)
  buckets: AgingBucket;
}

export interface ApAgingResult {
  rows: AgingInvoiceRow[];
  totals: AgingBucket & { paid_total: number; original_total: number };
}

// Legacy per-party aging row (still used by AR Aging which hasn't been re-grained)
export interface AgingRow {
  id: string;
  code: string;
  name: string;
  buckets: AgingBucket;
}

export interface ArAgingResult {
  rows: AgingRow[];
  totals: AgingBucket;
}

export function useApAging(companyId?: string, asOfDate?: string, includePaid: boolean = false) {
  const db = supabase as any;

  return useQuery<ApAgingResult>({
    queryKey: ['finance-report', 'ap-aging', companyId || 'all', asOfDate || 'today', includePaid],
    queryFn: async () => {
      const refDate = asOfDate || new Date().toISOString().slice(0, 10);
      const statuses = includePaid
        ? ['posted', 'partially_paid', 'paid']
        : ['posted', 'partially_paid'];

      let q = db
        .from('ap_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          total_amount,
          paid_amount,
          due_date,
          status,
          supplier:suppliers(id, supplier_code, supplier_name),
          allocations:payment_voucher_allocations(
            allocated_amount,
            pv:payment_vouchers(pv_number, payment_date, status)
          )
        `)
        .in('status', statuses);

      if (companyId) q = q.eq('company_id', companyId);

      const { data, error } = await q;
      if (error) throw error;

      const rows: AgingInvoiceRow[] = [];

      for (const inv of (data || []) as any[]) {
        const supplier = inv.supplier;
        if (!supplier) continue;

        const original = asNumber(inv.total_amount);
        const paid = asNumber(inv.paid_amount);
        const outstanding = Math.max(0, original - paid);

        let status: ApAgingStatus;
        if (paid <= 0) status = 'outstanding';
        else if (outstanding > 0.0001) status = 'partially_paid';
        else status = 'paid';

        // Pick the most recent posted PV from allocations as the "payment" reference
        const postedAllocations = (inv.allocations || []).filter(
          (a: any) => a.pv && ['paid', 'posted'].includes(a.pv.status),
        );
        postedAllocations.sort((a: any, b: any) =>
          (b.pv?.payment_date || '').localeCompare(a.pv?.payment_date || ''),
        );
        const lastPaymentDate = postedAllocations[0]?.pv?.payment_date || null;
        const allPvNumbers = postedAllocations.map((a: any) => a.pv?.pv_number).filter(Boolean);
        const paymentRef = allPvNumbers.length ? allPvNumbers.join(', ') : null;

        // Aging buckets based on outstanding ONLY — paid items show 0 in all buckets
        const buckets: AgingBucket = { current: 0, days30: 0, days60: 0, days90plus: 0, total: outstanding };
        if (outstanding > 0) {
          const dueDate = new Date(inv.due_date);
          const asOf = new Date(refDate);
          const daysPast = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysPast <= 30) buckets.current = outstanding;
          else if (daysPast <= 60) buckets.days30 = outstanding;
          else if (daysPast <= 90) buckets.days60 = outstanding;
          else buckets.days90plus = outstanding;
        }

        rows.push({
          id: inv.id,
          invoice_number: inv.invoice_number || inv.id,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          supplier_id: supplier.id,
          supplier_code: supplier.supplier_code,
          supplier_name: supplier.supplier_name,
          original_amount: original,
          paid_amount: paid,
          outstanding_amount: outstanding,
          status,
          payment_date: lastPaymentDate,
          payment_ref: paymentRef,
          buckets,
        });
      }

      // Sort by supplier code then invoice number for stable display
      rows.sort((a, b) => a.supplier_code.localeCompare(b.supplier_code) || a.invoice_number.localeCompare(b.invoice_number));

      const totals = {
        current: 0,
        days30: 0,
        days60: 0,
        days90plus: 0,
        total: 0,
        paid_total: 0,
        original_total: 0,
      };
      for (const row of rows) {
        totals.current += row.buckets.current;
        totals.days30 += row.buckets.days30;
        totals.days60 += row.buckets.days60;
        totals.days90plus += row.buckets.days90plus;
        totals.total += row.buckets.total;
        totals.paid_total += row.paid_amount;
        totals.original_total += row.original_amount;
      }

      return { rows, totals };
    },
    enabled: true,
  });
}

// ---------------------------------------------------------------------------
// AR Aging
// ---------------------------------------------------------------------------

export function useArAging(companyId?: string, asOfDate?: string) {
  const db = supabase as any;

  return useQuery<ArAgingResult>({
    queryKey: ['finance-report', 'ar-aging', companyId || 'all', asOfDate || 'today'],
    queryFn: async () => {
      const refDate = asOfDate || new Date().toISOString().slice(0, 10);

      let q = db
        .from('ar_invoices')
        .select(`
          id,
          total_amount,
          paid_amount,
          due_date,
          customer:customers(id, customer_code, customer_name)
        `)
        .in('status', ['posted', 'partially_paid']);

      if (companyId) q = q.eq('company_id', companyId);

      const { data, error } = await q;
      if (error) throw error;

      const grouped = new Map<string, AgingRow>();

      for (const inv of (data || []) as any[]) {
        const customer = inv.customer;
        if (!customer) continue;

        const outstanding = asNumber(inv.total_amount) - asNumber(inv.paid_amount);
        if (outstanding <= 0) continue;

        const dueDate = new Date(inv.due_date);
        const asOf = new Date(refDate);
        const daysPast = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        const key = customer.id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: customer.id,
            code: customer.customer_code,
            name: customer.customer_name,
            buckets: { current: 0, days30: 0, days60: 0, days90plus: 0, total: 0 },
          });
        }

        const row = grouped.get(key)!;
        if (daysPast <= 30) row.buckets.current += outstanding;
        else if (daysPast <= 60) row.buckets.days30 += outstanding;
        else if (daysPast <= 90) row.buckets.days60 += outstanding;
        else row.buckets.days90plus += outstanding;
        row.buckets.total += outstanding;
      }

      const rows = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
      const totals: AgingBucket = { current: 0, days30: 0, days60: 0, days90plus: 0, total: 0 };
      for (const row of rows) {
        totals.current += row.buckets.current;
        totals.days30 += row.buckets.days30;
        totals.days60 += row.buckets.days60;
        totals.days90plus += row.buckets.days90plus;
        totals.total += row.buckets.total;
      }

      return { rows, totals };
    },
    enabled: true,
  });
}

// ---------------------------------------------------------------------------
// General Ledger Listing
// ---------------------------------------------------------------------------

export interface GLReportTransaction {
  entry_date: string;
  entry_number: string;
  description: string;
  reference_type: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

export interface GLReportAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  transactions: GLReportTransaction[];
  closing_balance: number;
}

export interface GLReportParams {
  startDate: string;
  endDate: string;
  companyId?: string;
  accountId?: string;
}

export interface GLReportResult {
  accounts: GLReportAccount[];
}

export function useGLReport(params: GLReportParams) {
  const db = supabase as any;

  return useQuery<GLReportResult>({
    queryKey: ['finance-report', 'gl-listing', params.startDate, params.endDate, params.companyId || 'all', params.accountId || 'all'],
    queryFn: async () => {
      // 1. Fetch COA (postable accounts only)
      let coaQ = db
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type, is_postable')
        .eq('is_active', true)
        .eq('is_postable', true)
        .order('account_code');

      if (params.accountId) coaQ = coaQ.eq('id', params.accountId);

      const { data: accounts, error: coaError } = await coaQ;
      if (coaError) throw coaError;

      const coaList = (accounts || []) as any[];
      const coaMap = new Map<string, any>();
      for (const acct of coaList) coaMap.set(acct.id, acct);

      const accountIds = coaList.map((a: any) => a.id);
      if (accountIds.length === 0) return { accounts: [] };

      // 2. Fetch opening balance lines (before startDate)
      let openQ = db
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, entry_date, company_id, is_reversed)
        `)
        .lt('journal_entry.entry_date', params.startDate)
        .eq('journal_entry.is_reversed', false)
        .in('account_id', accountIds);

      if (params.companyId) openQ = openQ.eq('journal_entry.company_id', params.companyId);

      // 3. Fetch period lines
      let periodQ = db
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          description,
          journal_entry:journal_entries!inner(id, entry_date, entry_number, description, reference_type, company_id, is_reversed)
        `)
        .gte('journal_entry.entry_date', params.startDate)
        .lte('journal_entry.entry_date', params.endDate)
        .eq('journal_entry.is_reversed', false)
        .in('account_id', accountIds);

      if (params.companyId) periodQ = periodQ.eq('journal_entry.company_id', params.companyId);

      const [openRes, periodRes] = await Promise.all([openQ, periodQ]);
      if (openRes.error) throw openRes.error;
      if (periodRes.error) throw periodRes.error;

      // 4. Compute opening balances
      const openingMap = new Map<string, number>();
      for (const line of (openRes.data || []) as any[]) {
        const acct = coaMap.get(line.account_id);
        if (!acct) continue;
        const current = openingMap.get(line.account_id) || 0;
        const debit = asNumber(line.debit_amount);
        const credit = asNumber(line.credit_amount);
        // Asset & expense: debit-normal; Liability, equity, revenue: credit-normal
        if (['asset', 'expense'].includes(acct.account_type)) {
          openingMap.set(line.account_id, current + debit - credit);
        } else {
          openingMap.set(line.account_id, current + credit - debit);
        }
      }

      // 5. Build per-account transactions
      const txnsByAccount = new Map<string, any[]>();
      for (const line of (periodRes.data || []) as any[]) {
        if (!txnsByAccount.has(line.account_id)) txnsByAccount.set(line.account_id, []);
        txnsByAccount.get(line.account_id)!.push(line);
      }

      // 6. Assemble result
      const result: GLReportAccount[] = [];

      for (const acct of coaList) {
        const rawTxns = txnsByAccount.get(acct.id) || [];
        if (rawTxns.length === 0 && !openingMap.has(acct.id)) continue;

        const isDebitNormal = ['asset', 'expense'].includes(acct.account_type);
        const opening = openingMap.get(acct.id) || 0;

        // Sort by date, then entry_number
        rawTxns.sort((a: any, b: any) => {
          const dateCompare = (a.journal_entry?.entry_date || '').localeCompare(b.journal_entry?.entry_date || '');
          if (dateCompare !== 0) return dateCompare;
          return (a.journal_entry?.entry_number || '').localeCompare(b.journal_entry?.entry_number || '');
        });

        let runningBalance = opening;
        const transactions: GLReportTransaction[] = [];

        for (const line of rawTxns) {
          const debit = asNumber(line.debit_amount);
          const credit = asNumber(line.credit_amount);
          if (isDebitNormal) {
            runningBalance += debit - credit;
          } else {
            runningBalance += credit - debit;
          }

          const je = line.journal_entry || {};
          transactions.push({
            entry_date: je.entry_date || '',
            entry_number: je.entry_number || '',
            description: line.description || je.description || '',
            reference_type: GL_REFERENCE_TYPE_LABELS[je.reference_type as GLReferenceType] || je.reference_type || '',
            debit_amount: debit,
            credit_amount: credit,
            running_balance: runningBalance,
          });
        }

        result.push({
          account_id: acct.id,
          account_code: acct.account_code,
          account_name: acct.account_name,
          account_type: acct.account_type,
          opening_balance: opening,
          transactions,
          closing_balance: runningBalance,
        });
      }

      return { accounts: result };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

// ---------------------------------------------------------------------------
// Cash Flow Summary
// ---------------------------------------------------------------------------

export interface CashFlowItem {
  reference_type: string;
  label: string;
  amount: number;
}

export interface CashFlowCategory {
  label: string;
  amount: number;
  items: CashFlowItem[];
}

export interface CashFlowResult {
  openingCash: number;
  operating: CashFlowCategory;
  financing: CashFlowCategory;
  netChange: number;
  closingCash: number;
}

export interface CashFlowParams {
  startDate: string;
  endDate: string;
  companyId?: string;
}

const OPERATING_TYPES: GLReferenceType[] = ['ap_invoice', 'ar_invoice', 'petty_cash', 'claims', 'payroll', 'ap_dcn', 'ar_dcn'];
const FINANCING_TYPES: GLReferenceType[] = ['payment_voucher', 'official_receipt'];

export function useCashFlowReport(params: CashFlowParams) {
  const db = supabase as any;

  return useQuery<CashFlowResult>({
    queryKey: ['finance-report', 'cash-flow', params.startDate, params.endDate, params.companyId || 'all'],
    queryFn: async () => {
      // 1. Get all bank accounts for the company (those with gl_account_id)
      let bankQ = db
        .from('bank_accounts')
        .select('id, gl_account_id')
        .eq('is_active', true)
        .not('gl_account_id', 'is', null);

      if (params.companyId) bankQ = bankQ.eq('company_id', params.companyId);

      const { data: bankAccounts, error: bankError } = await bankQ;
      if (bankError) throw bankError;

      const bankGlIds = (bankAccounts || []).map((b: any) => b.gl_account_id).filter(Boolean) as string[];
      if (bankGlIds.length === 0) {
        return { openingCash: 0, operating: { label: 'Operating Activities', amount: 0, items: [] }, financing: { label: 'Financing Activities', amount: 0, items: [] }, netChange: 0, closingCash: 0 };
      }

      // 2. Opening cash: all bank GL transactions before startDate
      let openQ = db
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, entry_date, company_id, is_reversed)
        `)
        .lt('journal_entry.entry_date', params.startDate)
        .eq('journal_entry.is_reversed', false)
        .in('account_id', bankGlIds);

      if (params.companyId) openQ = openQ.eq('journal_entry.company_id', params.companyId);

      // 3. Period transactions
      let periodQ = db
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!inner(id, entry_date, reference_type, company_id, is_reversed)
        `)
        .gte('journal_entry.entry_date', params.startDate)
        .lte('journal_entry.entry_date', params.endDate)
        .eq('journal_entry.is_reversed', false)
        .in('account_id', bankGlIds);

      if (params.companyId) periodQ = periodQ.eq('journal_entry.company_id', params.companyId);

      const [openRes, periodRes] = await Promise.all([openQ, periodQ]);
      if (openRes.error) throw openRes.error;
      if (periodRes.error) throw periodRes.error;

      // Opening cash = sum of debit - credit on bank accounts (asset = debit normal)
      const openingCash = (openRes.data || []).reduce((sum: number, line: any) => {
        return sum + asNumber(line.debit_amount) - asNumber(line.credit_amount);
      }, 0);

      // Group period by reference_type
      const byRefType = new Map<string, number>();
      for (const line of (periodRes.data || []) as any[]) {
        const refType = (line.journal_entry?.reference_type || 'manual') as string;
        const net = asNumber(line.debit_amount) - asNumber(line.credit_amount); // debit = inflow, credit = outflow
        byRefType.set(refType, (byRefType.get(refType) || 0) + net);
      }

      // Build operating items
      const operatingItems: CashFlowItem[] = [];
      let operatingTotal = 0;
      for (const refType of OPERATING_TYPES) {
        const amount = byRefType.get(refType) || 0;
        if (amount !== 0) {
          operatingItems.push({
            reference_type: refType,
            label: GL_REFERENCE_TYPE_LABELS[refType] || refType,
            amount,
          });
          operatingTotal += amount;
        }
      }

      // Build financing items
      const financingItems: CashFlowItem[] = [];
      let financingTotal = 0;
      for (const refType of FINANCING_TYPES) {
        const amount = byRefType.get(refType) || 0;
        if (amount !== 0) {
          financingItems.push({
            reference_type: refType,
            label: GL_REFERENCE_TYPE_LABELS[refType] || refType,
            amount,
          });
          financingTotal += amount;
        }
      }

      // Manual entries (investing placeholder)
      const manualAmount = byRefType.get('manual') || 0;
      if (manualAmount !== 0) {
        operatingItems.push({
          reference_type: 'manual',
          label: 'Manual / Other',
          amount: manualAmount,
        });
        operatingTotal += manualAmount;
      }

      const netChange = operatingTotal + financingTotal;

      return {
        openingCash,
        operating: { label: 'Operating Activities', amount: operatingTotal, items: operatingItems },
        financing: { label: 'Financing Activities', amount: financingTotal, items: financingItems },
        netChange,
        closingCash: openingCash + netChange,
      };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

// ---------------------------------------------------------------------------
// SST Summary
// ---------------------------------------------------------------------------

export interface SSTSummaryData {
  outputTax: { taxableAmount: number; taxAmount: number };
  inputTax: { taxableAmount: number; taxAmount: number };
  netPayable: number;
}

export interface SSTReportParams {
  startDate: string;
  endDate: string;
  companyId?: string;
}

export function useSSTReport(params: SSTReportParams) {
  const db = supabase as any;

  return useQuery<SSTSummaryData>({
    queryKey: ['finance-report', 'sst-summary', params.startDate, params.endDate, params.companyId || 'all'],
    queryFn: async () => {
      // Output Tax: AR invoice lines with tax_code = 'sr'
      let arQ = db
        .from('ar_invoice_lines')
        .select(`
          amount,
          tax_amount,
          tax_code,
          ar_invoice:ar_invoices!inner(id, company_id, invoice_date, status)
        `)
        .eq('tax_code', 'sr')
        .in('ar_invoice.status', ['posted', 'partially_paid', 'paid'])
        .gte('ar_invoice.invoice_date', params.startDate)
        .lte('ar_invoice.invoice_date', params.endDate);

      if (params.companyId) arQ = arQ.eq('ar_invoice.company_id', params.companyId);

      // Input Tax: AP invoice lines with tax_code = 'sr'
      let apQ = db
        .from('ap_invoice_lines')
        .select(`
          amount,
          tax_amount,
          tax_code,
          ap_invoice:ap_invoices!inner(id, company_id, invoice_date, status)
        `)
        .eq('tax_code', 'sr')
        .in('ap_invoice.status', ['posted', 'partially_paid', 'paid'])
        .gte('ap_invoice.invoice_date', params.startDate)
        .lte('ap_invoice.invoice_date', params.endDate);

      if (params.companyId) apQ = apQ.eq('ap_invoice.company_id', params.companyId);

      const [arRes, apRes] = await Promise.all([arQ, apQ]);
      if (arRes.error) throw arRes.error;
      if (apRes.error) throw apRes.error;

      const outputTax = (arRes.data || []).reduce(
        (acc: { taxableAmount: number; taxAmount: number }, line: any) => {
          acc.taxableAmount += asNumber(line.amount);
          acc.taxAmount += asNumber(line.tax_amount);
          return acc;
        },
        { taxableAmount: 0, taxAmount: 0 }
      );

      const inputTax = (apRes.data || []).reduce(
        (acc: { taxableAmount: number; taxAmount: number }, line: any) => {
          acc.taxableAmount += asNumber(line.amount);
          acc.taxAmount += asNumber(line.tax_amount);
          return acc;
        },
        { taxableAmount: 0, taxAmount: 0 }
      );

      return {
        outputTax,
        inputTax,
        netPayable: outputTax.taxAmount - inputTax.taxAmount,
      };
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}
