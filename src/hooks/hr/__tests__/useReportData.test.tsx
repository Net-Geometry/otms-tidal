import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useReportData } from '../useReportData';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useReportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes parent company employees in combined reports', async () => {
    const otRequests = [
      {
        id: 'ot-1',
        employee_id: 'profile-1',
        ot_date: '2026-05-20',
        total_hours: 3,
        ot_amount: 69.23,
        status: 'management_approved',
      },
    ];

    const profiles = [
      {
        id: 'profile-1',
        employee_id: 'EMP-001',
        full_name: 'Azman bin Ali',
        company_id: 'company-parent',
        department_id: 'department-1',
        position_id: null,
        departments: { name: 'Engineering', code: 'ENG' },
        positions: null,
        companies: {
          id: 'company-parent',
          name: 'Tidal Holdings Sdn Bhd',
          code: 'THSB',
          logo_url: null,
          parent_company_id: null,
        },
      },
    ];

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as unknown as Mock).mockImplementation((table: string) => {
      if (table === 'ot_requests') {
        return {
          select: () => ({
            in: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({ data: otRequests, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({ data: profiles, error: null }),
        };
      }

      return { select: () => ({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useReportData({
        month: new Date(2026, 4, 1),
        reportType: 'combined',
        enabled: true,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.employees).toEqual([
      expect.objectContaining({
        employee_id: 'profile-1',
        employee_no: 'EMP-001',
        employee_name: 'Azman bin Ali',
        company_name: 'Tidal Holdings Sdn Bhd',
        company_code: 'THSB',
        total_ot_hours: 3,
        amount: 69.23,
      }),
    ]);
  });

  it('does not apply month or year date filters for all-period reports', async () => {
    const gte = vi.fn();
    const lte = vi.fn();
    const order = vi.fn(() => ({ data: [], error: null }));
    const inFilter = vi.fn(() => ({ order }));

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as unknown as Mock).mockImplementation((table: string) => {
      if (table === 'ot_requests') {
        return {
          select: () => ({
            gte,
            lte,
            in: inFilter,
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({ data: [], error: null }),
        };
      }

      return { select: () => ({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useReportData({
        month: new Date(2026, 4, 1),
        reportType: 'combined',
        periodMode: 'all',
        enabled: true,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
    expect(inFilter).toHaveBeenCalledWith('status', ['management_approved']);
  });

  it('supports all-period filtering for individual company reports', async () => {
    const otRequests = [
      {
        id: 'ot-1',
        employee_id: 'profile-1',
        ot_date: '2026-02-10',
        total_hours: 2,
        ot_amount: 50,
        status: 'management_approved',
      },
      {
        id: 'ot-2',
        employee_id: 'profile-2',
        ot_date: '2026-04-10',
        total_hours: 4,
        ot_amount: 100,
        status: 'management_approved',
      },
    ];
    const profiles = [
      {
        id: 'profile-1',
        employee_id: 'EMP-001',
        full_name: 'Ali Ahmad',
        company_id: 'company-1',
        department_id: null,
        position_id: null,
        departments: null,
        positions: null,
        companies: { id: 'company-1', name: 'Company One', code: 'C1', logo_url: null, parent_company_id: null },
      },
      {
        id: 'profile-2',
        employee_id: 'EMP-002',
        full_name: 'Siti Aminah',
        company_id: 'company-2',
        department_id: null,
        position_id: null,
        departments: null,
        positions: null,
        companies: { id: 'company-2', name: 'Company Two', code: 'C2', logo_url: null, parent_company_id: null },
      },
    ];
    const gte = vi.fn();
    const lte = vi.fn();

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as unknown as Mock).mockImplementation((table: string) => {
      if (table === 'ot_requests') {
        return {
          select: () => ({
            in: () => ({
              gte,
              lte,
              order: () => ({ data: otRequests, error: null }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({ data: profiles, error: null }),
        };
      }

      return { select: () => ({ data: [], error: null }) };
    });

    const { result } = renderHook(
      () => useReportData({
        month: new Date(2026, 4, 1),
        reportType: 'individual',
        companyId: 'company-1',
        periodMode: 'all',
        enabled: true,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
    expect(result.current.data?.employees).toEqual([
      expect.objectContaining({ employee_id: 'profile-1', amount: 50 }),
    ]);
  });
});
