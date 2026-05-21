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
          parent_company_id: null,
        },
      },
    ];

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as unknown as Mock).mockImplementation((table: string) => {
      if (table === 'ot_requests') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                in: () => ({
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
});
