/**
 * Unit Tests: useChartOfAccounts hook
 * Tests for Chart of Accounts tree building, filtering, and CRUD operations
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useChartOfAccounts,
  useUpsertAccount,
  useDeleteAccount,
} from '../useChartOfAccounts';
import type { ChartOfAccount, AccountType } from '@/types/finance';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Test wrapper for React Query
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

// Mock data
const mockAccounts: ChartOfAccount[] = [
  {
    id: '1',
    account_code: '1000',
    account_name: 'Assets',
    account_type: 'asset' as AccountType,
    level: 1,
    is_active: true,
    is_postable: false,
    parent_id: null,
    sort_order: 1,
  },
  {
    id: '2',
    account_code: '1100',
    account_name: 'Current Assets',
    account_type: 'asset' as AccountType,
    level: 2,
    is_active: true,
    is_postable: false,
    parent_id: '1',
    sort_order: 1,
  },
  {
    id: '3',
    account_code: '1110',
    account_name: 'Cash',
    account_type: 'asset' as AccountType,
    level: 3,
    is_active: true,
    is_postable: true,
    parent_id: '2',
    sort_order: 1,
  },
  {
    id: '4',
    account_code: '2000',
    account_name: 'Liabilities',
    account_type: 'liability' as AccountType,
    level: 1,
    is_active: true,
    is_postable: false,
    parent_id: null,
    sort_order: 2,
  },
  {
    id: '5',
    account_code: '3000',
    account_name: 'Equity',
    account_type: 'equity' as AccountType,
    level: 1,
    is_active: false,
    is_postable: false,
    parent_id: null,
    sort_order: 3,
  },
];

describe('useChartOfAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetching accounts', () => {
    it('should fetch and return chart of accounts', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(() => useChartOfAccounts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.accounts).toHaveLength(5);
      expect(result.current.accounts[0].account_code).toBe('1000');
    });

    it('should handle fetch error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(() => useChartOfAccounts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('tree building', () => {
    it('should build hierarchical tree structure', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(() => useChartOfAccounts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Root nodes: Assets, Liabilities, and Equity (without activity filter, all are shown)
      expect(result.current.tree).toHaveLength(3);
      
      // Assets should have children
      const assets = result.current.tree.find((n) => n.account_code === '1000');
      expect(assets?.children).toHaveLength(1);
      expect(assets?.children?.[0].account_code).toBe('1100');
      
      // Cash should be nested under Current Assets
      const currentAssets = assets?.children?.[0];
      expect(currentAssets?.children).toHaveLength(1);
      expect(currentAssets?.children?.[0].account_code).toBe('1110');
    });

    it('should sort accounts by sort_order then account_code', async () => {
      const unsortedAccounts: ChartOfAccount[] = [
        {
          id: '1',
          account_code: '2000',
          account_name: 'Liabilities',
          account_type: 'liability' as AccountType,
          level: 1,
          is_active: true,
          is_postable: false,
          parent_id: null,
          sort_order: 2,
        },
        {
          id: '2',
          account_code: '1000',
          account_name: 'Assets',
          account_type: 'asset' as AccountType,
          level: 1,
          is_active: true,
          is_postable: false,
          parent_id: null,
          sort_order: 1,
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: unsortedAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(() => useChartOfAccounts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.tree[0].account_code).toBe('1000'); // sort_order 1
      expect(result.current.tree[1].account_code).toBe('2000'); // sort_order 2
    });
  });

  describe('filtering', () => {
    it('should filter by account type', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(
        () => useChartOfAccounts({ accountType: 'asset' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should only show asset accounts
      const allCodes = result.current.tree.flatMap((node) => [
        node.account_code,
        ...(node.children?.flatMap((c) => [
          c.account_code,
          ...(c.children?.map((gc) => gc.account_code) || []),
        ]) || []),
      ]);
      
      expect(allCodes).toContain('1000');
      expect(allCodes).toContain('1100');
      expect(allCodes).toContain('1110');
      expect(allCodes).not.toContain('2000');
      expect(allCodes).not.toContain('3000');
    });

    it('should filter by search query', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(
        () => useChartOfAccounts({ search: 'cash' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should find Cash account (1110) and include its parent chain
      expect(result.current.tree.length).toBeGreaterThan(0);
    });

    it('should filter by activity status', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const { result } = renderHook(
        () => useChartOfAccounts({ activity: 'inactive' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should only show inactive accounts
      expect(result.current.tree).toHaveLength(1);
      expect(result.current.tree[0].account_code).toBe('3000');
    });
  });
});

describe('useUpsertAccount', () => {
  it('should create new account', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useUpsertAccount(), {
      wrapper: createWrapper(),
    });

    await result.current.upsertAccount({
      account_code: '9999',
      account_name: 'Test Account',
      account_type: 'asset' as AccountType,
      level: 3,
    });

    expect(mockFrom).toHaveBeenCalledWith('chart_of_accounts');
  });

  it('should update existing account', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useUpsertAccount(), {
      wrapper: createWrapper(),
    });

    await result.current.upsertAccount({
      id: '123',
      account_code: '1110',
      account_name: 'Updated Cash',
      account_type: 'asset' as AccountType,
      level: 3,
    });

    expect(mockFrom).toHaveBeenCalledWith('chart_of_accounts');
  });

  it('should enforce is_postable only for level 3', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useUpsertAccount(), {
      wrapper: createWrapper(),
    });

    // Level 1 account with is_postable=true should be stored as false
    await result.current.upsertAccount({
      account_code: '1000',
      account_name: 'Assets',
      account_type: 'asset' as AccountType,
      level: 1,
      is_postable: true,
    });

    const insertCall = mockFrom().insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        is_postable: false,
      })
    );
  });
});

describe('useDeleteAccount', () => {
  it('should soft delete account by marking inactive', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = mockFrom;

    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: createWrapper(),
    });

    await result.current.deleteAccount('123');

    expect(mockFrom).toHaveBeenCalledWith('chart_of_accounts');
    expect(mockFrom().update).toHaveBeenCalledWith({ is_active: false });
  });
});
