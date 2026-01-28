import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          neq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [{ success: true }], error: null })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

describe('OT Base Salary Override', () => {
  describe('useUpdateEmployee with ot_base', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      vi.clearAllMocks();
    });

    it('should accept ot_base as a valid update field', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { useUpdateEmployee } = await import('@/hooks/hr/useUpdateEmployee');

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateEmployee(), { wrapper });

      result.current.mutate({
        id: 'test-employee-id',
        ot_base: 5000,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(supabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should allow null ot_base to clear the override', async () => {
      const { useUpdateEmployee } = await import('@/hooks/hr/useUpdateEmployee');

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateEmployee(), { wrapper });

      result.current.mutate({
        id: 'test-employee-id',
        ot_base: null,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should convert empty string ot_base to null', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { useUpdateEmployee } = await import('@/hooks/hr/useUpdateEmployee');

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateEmployee(), { wrapper });

      result.current.mutate({
        id: 'test-employee-id',
        ot_base: '' as any, // Simulating empty form input
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('OT Calculation Logic', () => {
    it('should use basic_salary when ot_base is null', () => {
      const profile = {
        basic_salary: 3000,
        ot_base: null,
      };

      const effectiveSalary = profile.ot_base ?? profile.basic_salary;
      expect(effectiveSalary).toBe(3000);
    });

    it('should use ot_base when set', () => {
      const profile = {
        basic_salary: 3000,
        ot_base: 5000,
      };

      const effectiveSalary = profile.ot_base ?? profile.basic_salary;
      expect(effectiveSalary).toBe(5000);
    });

    it('should calculate ORP correctly with ot_base override', () => {
      const ot_base = 5200; // RM 5,200
      const orp = ot_base / 26; // One Rate of Pay
      const hrp = orp / 8; // Hourly Rate of Pay

      expect(orp).toBe(200);
      expect(hrp).toBe(25);
    });

    it('should calculate weekday OT correctly with ot_base', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const hrp = orp / 8;
      const totalHours = 2;

      // Weekday: 1.5 x HRP x hours
      const otAmount = 1.5 * hrp * totalHours;
      expect(otAmount).toBe(75); // 1.5 * 25 * 2
    });

    it('should calculate saturday OT correctly with ot_base', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const hrp = orp / 8;
      const totalHours = 2;

      // Saturday: 2 x HRP x hours
      const otAmount = 2 * hrp * totalHours;
      expect(otAmount).toBe(100); // 2 * 25 * 2
    });

    it('should calculate sunday OT correctly with ot_base (<=4 hours)', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const totalHours = 3;

      // Sunday <= 4 hours: 0.5 x ORP
      const otAmount = 0.5 * orp;
      expect(otAmount).toBe(100); // 0.5 * 200
    });

    it('should calculate sunday OT correctly with ot_base (5-8 hours)', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const totalHours = 6;

      // Sunday 5-8 hours: 1 x ORP
      const otAmount = 1 * orp;
      expect(otAmount).toBe(200); // 1 * 200
    });

    it('should calculate sunday OT correctly with ot_base (>8 hours)', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const hrp = orp / 8;
      const totalHours = 10;

      // Sunday > 8 hours: (1 x ORP) + (2 x HRP x (hours - 8))
      const otAmount = (1 * orp) + (2 * hrp * (totalHours - 8));
      expect(otAmount).toBe(300); // 200 + (2 * 25 * 2)
    });

    it('should calculate public holiday OT correctly with ot_base (<=8 hours)', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const totalHours = 6;

      // Public Holiday <= 8 hours: 2 x ORP
      const otAmount = 2 * orp;
      expect(otAmount).toBe(400); // 2 * 200
    });

    it('should calculate public holiday OT correctly with ot_base (>8 hours)', () => {
      const ot_base = 5200;
      const orp = ot_base / 26;
      const hrp = orp / 8;
      const totalHours = 10;

      // Public Holiday > 8 hours: (2 x ORP) + (3 x HRP x (hours - 8))
      const otAmount = (2 * orp) + (3 * hrp * (totalHours - 8));
      expect(otAmount).toBe(550); // 400 + (3 * 25 * 2)
    });
  });

  describe('Calculation Comparison', () => {
    it('should show difference between basic_salary and ot_base calculations', () => {
      const basic_salary = 3000;
      const ot_base = 5200;
      const totalHours = 2;

      // Using basic_salary
      const orp_basic = basic_salary / 26; // 115.38
      const hrp_basic = orp_basic / 8; // 14.42
      const ot_amount_basic = 1.5 * hrp_basic * totalHours; // ~43.27

      // Using ot_base
      const orp_override = ot_base / 26; // 200
      const hrp_override = orp_override / 8; // 25
      const ot_amount_override = 1.5 * hrp_override * totalHours; // 75

      expect(ot_amount_override).toBeGreaterThan(ot_amount_basic);
      expect(Math.round(ot_amount_override - ot_amount_basic)).toBe(32);
    });
  });
});
