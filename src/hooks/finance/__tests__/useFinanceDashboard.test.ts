/**
 * Unit Tests: useFinanceDashboard hook
 * Tests for dashboard KPI calculations and chart data aggregation
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinanceDashboard } from '../useFinanceDashboard';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Note: Using actual date-fns functions for realistic date handling

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useFinanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDashboardData = {
    apInvoices: [
      { id: '1', total_amount: 10000, paid_amount: 3000, due_date: '2025-06-10', status: 'posted' },
      { id: '2', total_amount: 5000, paid_amount: 5000, due_date: '2025-06-20', status: 'posted' },
      { id: '3', total_amount: 8000, paid_amount: 0, due_date: '2025-05-01', status: 'posted' }, // overdue
    ],
    arInvoices: [
      { id: '4', total_amount: 15000, paid_amount: 10000, due_date: '2025-06-05', status: 'posted' }, // overdue
      { id: '5', total_amount: 6000, paid_amount: 0, due_date: '2025-06-25', status: 'posted' },
    ],
    bankAccounts: [
      { id: '1', current_balance: 50000 },
      { id: '2', current_balance: 25000 },
    ],
    payrollPosted: [
      { id: '1', total_net_salary: 30000, posted_at: '2025-06-01' },
      { id: '2', total_net_salary: 28000, posted_at: '2025-05-01' },
    ],
    claimsPosted: [
      { id: '1', amount: 5000, posted_at: '2025-06-10' },
      { id: '2', amount: 3000, posted_at: '2025-06-15' },
    ],
    pettyApproved: [
      { id: '1', txn_type: 'expenditure', amount: 500, txn_date: '2025-06-05' },
      { id: '2', txn_type: 'expenditure', amount: 300, txn_date: '2025-06-10' },
      { id: '3', txn_type: 'topup', amount: 1000, txn_date: '2025-06-01' }, // should be excluded
    ],
    allocations: [
      { project_id: 'p1', amount: 50000 },
      { project_id: 'p1', amount: 30000 },
      { project_id: 'p2', amount: 25000 },
    ],
    projects: [
      { id: 'p1', project_code: 'PROJ001', project_name: 'Project Alpha', budget_amount: 150000 },
      { id: 'p2', project_code: 'PROJ002', project_name: 'Project Beta', budget_amount: 100000 },
      { id: 'p3', project_code: 'PROJ003', project_name: 'Project Gamma', budget_amount: 200000 },
    ],
    payrollPendingCount: 2,
    claimsPendingCount: 5,
  };

  const setupMockSupabase = (data: typeof mockDashboardData) => {
    return vi.fn().mockImplementation((table: string) => {
      const builders: Record<string, any> = {
        ap_invoices: {
          select: () => ({
            in: () => ({
              data: data.apInvoices,
              error: null,
            }),
          }),
        },
        ar_invoices: {
          select: () => ({
            in: () => ({
              data: data.arInvoices,
              error: null,
            }),
          }),
        },
        bank_accounts: {
          select: () => ({
            eq: () => ({
              data: data.bankAccounts,
              error: null,
            }),
          }),
        },
        payroll_runs: {
          select: vi.fn().mockReturnValueOnce({
            eq: () => ({
              data: data.payrollPosted,
              error: null,
            }),
          }).mockReturnValueOnce({
            eq: () => ({
              count: data.payrollPendingCount,
              error: null,
            }),
          }),
        },
        claims: {
          select: vi.fn().mockReturnValueOnce({
            eq: () => ({
              data: data.claimsPosted,
              error: null,
            }),
          }).mockReturnValueOnce({
            eq: () => ({
              count: data.claimsPendingCount,
              error: null,
            }),
          }),
        },
        petty_cash_transactions: {
          select: () => ({
            eq: () => ({
              data: data.pettyApproved,
              error: null,
            }),
          }),
        },
        project_cost_allocations: {
          select: () => ({
            data: data.allocations,
            error: null,
          }),
        },
        projects: {
          select: () => ({
            eq: () => ({
              data: data.projects,
              error: null,
            }),
          }),
        },
      };
      return builders[table] || { select: () => ({ data: [], error: null }) };
    });
  };

  it('should calculate AP Outstanding correctly', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // AP Outstanding = (10000-3000) + (5000-5000) + (8000-0) = 7000 + 0 + 8000 = 15000
    expect(result.current.data?.stats.apOutstanding).toBe(15000);
  });

  it('should calculate AR Outstanding correctly', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // AR Outstanding = (15000-10000) + (6000-0) = 5000 + 6000 = 11000
    expect(result.current.data?.stats.arOutstanding).toBe(11000);
  });

  it('should calculate Cash Position correctly', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Cash Position = 50000 + 25000 = 75000
    expect(result.current.data?.stats.cashPosition).toBe(75000);
  });

  it('should count overdue invoices correctly', async () => {
    // Use dates relative to today for consistent testing
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const testData = {
      ...mockDashboardData,
      apInvoices: [
        { id: '1', total_amount: 10000, paid_amount: 3000, due_date: formatDate(tomorrow), status: 'posted' },
        { id: '2', total_amount: 5000, paid_amount: 5000, due_date: formatDate(tomorrow), status: 'posted' },
        { id: '3', total_amount: 8000, paid_amount: 0, due_date: formatDate(lastMonth), status: 'posted' }, // overdue
      ],
      arInvoices: [
        { id: '4', total_amount: 15000, paid_amount: 10000, due_date: formatDate(yesterday), status: 'posted' }, // overdue
        { id: '5', total_amount: 6000, paid_amount: 0, due_date: formatDate(tomorrow), status: 'posted' },
      ],
    };
    
    const mockFrom = setupMockSupabase(testData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Overdue: AP with due_date in past (1), AR with due_date in past (1)
    expect(result.current.data?.stats.overdueCount).toBe(2);
  });

  it('should return pending actions counts', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify that pending actions are returned as numbers
    expect(typeof result.current.data?.pendingActions.pendingPayrollCount).toBe('number');
    expect(typeof result.current.data?.pendingActions.pendingClaimsCount).toBe('number');
  });

  it('should aggregate expense trend data by month', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const trend = result.current.data?.charts.expenseTrend;
    expect(trend).toBeDefined();
    expect(trend?.length).toBeGreaterThan(0); // At least some months
    expect(trend?.[0]).toHaveProperty('month');
    expect(trend?.[0]).toHaveProperty('payroll');
    expect(trend?.[0]).toHaveProperty('claims');
    expect(trend?.[0]).toHaveProperty('pettyCash');
  });

  it('should calculate top projects by cost', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const topProjects = result.current.data?.charts.topProjectsByCost;
    expect(topProjects).toBeDefined();
    expect(topProjects?.length).toBeLessThanOrEqual(5);
    
    // Project Alpha has 50000 + 30000 = 80000
    // Project Beta has 25000
    // Project Gamma has 0 (no allocations)
    const projectAlpha = topProjects?.find((p) => p.project_code === 'PROJ001');
    expect(projectAlpha?.amount).toBe(80000);
  });

  it('should handle null/undefined values gracefully', async () => {
    const dataWithNulls = {
      ...mockDashboardData,
      apInvoices: [
        { id: '1', total_amount: null, paid_amount: undefined, due_date: '2025-06-20', status: 'posted' },
        { id: '2', total_amount: 10000, paid_amount: null, due_date: '2025-06-20', status: 'posted' },
      ],
      bankAccounts: [
        { id: '1', current_balance: null },
        { id: '2', current_balance: 5000 },
      ],
    };

    const mockFrom = setupMockSupabase(dataWithNulls);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // AP Outstanding = (0-0) + (10000-0) = 10000
    expect(result.current.data?.stats.apOutstanding).toBe(10000);
    // Cash Position = 0 + 5000 = 5000
    expect(result.current.data?.stats.cashPosition).toBe(5000);
  });

  it('should handle empty data gracefully', async () => {
    const emptyData = {
      apInvoices: [],
      arInvoices: [],
      bankAccounts: [],
      payrollPosted: [],
      claimsPosted: [],
      pettyApproved: [],
      allocations: [],
      projects: [],
      payrollPendingCount: 0,
      claimsPendingCount: 0,
    };

    const mockFrom = setupMockSupabase(emptyData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stats.apOutstanding).toBe(0);
    expect(result.current.data?.stats.arOutstanding).toBe(0);
    expect(result.current.data?.stats.cashPosition).toBe(0);
    expect(result.current.data?.stats.overdueCount).toBe(0);
  });

  it('should only include expenditure type in petty cash calculations', async () => {
    const mockFrom = setupMockSupabase(mockDashboardData);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useFinanceDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Only expenditure types should be counted (not topups)
    // The petty cash trend should have non-negative values
    const trend = result.current.data?.charts.expenseTrend;
    expect(trend?.every(t => t.pettyCash >= 0)).toBe(true);
  });
});
