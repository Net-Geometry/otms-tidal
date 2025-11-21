/**
 * Tests for HolidayConfigService
 * Story: 7-2-web-scraping-holiday-engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HolidayConfigService } from '../HolidayConfigService';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('HolidayConfigService', () => {
  let service: HolidayConfigService;

  beforeEach(() => {
    service = new HolidayConfigService();
    vi.clearAllMocks();
  });

  describe('refreshHolidaysForState', () => {
    it('should call scraping function for current and next year', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.functions.invoke as any) = mockInvoke;

      await service.refreshHolidaysForState('SGR');

      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(mockInvoke).toHaveBeenCalledWith('scrape-malaysia-holidays', {
        body: {
          state: 'SELANGOR',
          year: expect.any(Number),
        },
      });
    });

    it('should throw error if scraping fails', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Scraping failed' }
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.functions.invoke as any) = mockInvoke;

      await expect(service.refreshHolidaysForState('SGR')).rejects.toThrow();
    });

    it('should continue even if next year scraping fails', async () => {
      const mockInvoke = vi.fn()
        .mockResolvedValueOnce({ data: { success: true }, error: null }) // Current year succeeds
        .mockResolvedValueOnce({ data: null, error: { message: 'Failed' } }); // Next year fails
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.functions.invoke as any) = mockInvoke;

      await expect(service.refreshHolidaysForState('SGR')).resolves.not.toThrow();
    });
  });

  describe('getHolidaysForState', () => {
    it('should query holidays for specified state and year', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { name: 'New Year', date: '2025-01-01', state: 'ALL' },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const holidays = await service.getHolidaysForState('SGR', 2025);

      expect(holidays).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('malaysian_holidays');
    });

    it('should return empty array on error', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      await expect(service.getHolidaysForState('SGR', 2025)).rejects.toThrow();
    });
  });

  describe('hasHolidayData', () => {
    it('should return true when holidays exist', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const hasData = await service.hasHolidayData('SGR', 2025);

      expect(hasData).toBe(true);
    });

    it('should return false when no holidays exist', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = mockFrom;

      const hasData = await service.hasHolidayData('SGR', 2025);

      expect(hasData).toBe(false);
    });
  });

  describe('refreshAllStates', () => {
    it('should call scraping function without state parameter', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: {
          success: true,
          states_scraped: 16,
          holidays_scraped: 50,
        },
        error: null
      });
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.functions.invoke as any) = mockInvoke;

      const result = await service.refreshAllStates(2025);

      expect(mockInvoke).toHaveBeenCalledWith('scrape-malaysia-holidays', {
        body: {
          year: 2025,
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
