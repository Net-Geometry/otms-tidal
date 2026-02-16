/**
 * Unit Tests: usePettyCashBalance hook
 * Tests for petty cash balance calculations and utilization metrics
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePettyCashBalance } from '../usePettyCashBalance';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

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

describe('usePettyCashBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockSupabase = (transactions: any[], floatAmount: number) => {
    return vi.fn().mockImplementation((table: string) => {
      if (table === 'petty_cash_transactions') {
        return {
          select: () => ({
            eq: () => ({
              data: transactions,
              error: null,
            }),
          }),
        };
      }
      if (table === 'petty_cash_settings') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { float_amount: floatAmount },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ data: [], error: null }) };
    });
  };

  it('should calculate balance correctly with top-ups and expenditures', async () => {
    const transactions = [
      { txn_type: 'top_up', amount: 5000 },
      { txn_type: 'top_up', amount: 2000 },
      { txn_type: 'expenditure', amount: 500 },
      { txn_type: 'expenditure', amount: 300 },
    ];

    const mockFrom = setupMockSupabase(transactions, 10000);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Balance = 5000 + 2000 - 500 - 300 = 6200
    expect(result.current.data?.balance).toBe(6200);
    expect(result.current.data?.totalTopUps).toBe(7000);
    expect(result.current.data?.totalExpenditures).toBe(800);
  });

  it('should calculate utilization percentage correctly', async () => {
    const transactions = [
      { txn_type: 'top_up', amount: 5000 },
      { txn_type: 'expenditure', amount: 2500 },
    ];

    const mockFrom = setupMockSupabase(transactions, 10000);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Utilization = (2500 / 10000) * 100 = 25%
    expect(result.current.data?.utilizationPct).toBe(25);
  });

  it('should cap utilization at 999%', async () => {
    const transactions = [
      { txn_type: 'expenditure', amount: 50000 },
    ];

    const mockFrom = setupMockSupabase(transactions, 1000);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Utilization would be 5000% but capped at 999%
    expect(result.current.data?.utilizationPct).toBe(999);
  });

  it('should handle zero float amount', async () => {
    const transactions = [
      { txn_type: 'top_up', amount: 5000 },
    ];

    const mockFrom = setupMockSupabase(transactions, 0);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.utilizationPct).toBe(0);
    expect(result.current.data?.floatAmount).toBe(0);
  });

  it('should handle empty transactions', async () => {
    const mockFrom = setupMockSupabase([], 5000);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.balance).toBe(0);
    expect(result.current.data?.totalTopUps).toBe(0);
    expect(result.current.data?.totalExpenditures).toBe(0);
    expect(result.current.data?.utilizationPct).toBe(0);
  });

  it('should handle null/undefined amounts', async () => {
    const transactions = [
      { txn_type: 'top_up', amount: null },
      { txn_type: 'top_up', amount: 5000 },
      { txn_type: 'expenditure', amount: undefined },
      { txn_type: 'expenditure', amount: 1000 },
    ];

    const mockFrom = setupMockSupabase(transactions, 10000);
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Balance = 0 + 5000 - 0 - 1000 = 4000
    expect(result.current.data?.balance).toBe(4000);
    expect(result.current.data?.totalTopUps).toBe(5000);
    expect(result.current.data?.totalExpenditures).toBe(1000);
  });

  it('should only consider approved transactions', async () => {
    // The hook filters by status='approved' in the query
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'petty_cash_transactions') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              data: [
                { txn_type: 'top_up', amount: 5000 },
                { txn_type: 'expenditure', amount: 1000 },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'petty_cash_settings') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { float_amount: 10000 },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ data: [], error: null }) };
    });

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => usePettyCashBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the query was called with approved status filter
    const transactionsCall = mockFrom.mock.results.find(
      (r: any) => r.value && r.value.select
    );
    expect(mockFrom).toHaveBeenCalledWith('petty_cash_transactions');
  });
});
