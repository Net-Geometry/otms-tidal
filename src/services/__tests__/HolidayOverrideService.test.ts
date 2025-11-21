/**
 * Tests for HolidayOverrideService
 * Story: 7-3-manual-holiday-override-system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HolidayOverrideService } from '../HolidayOverrideService';
import type { HolidayOverride, HolidayOverrideInput } from '@/types/holiday-overrides';

// Mock dependencies
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

vi.mock('../HolidayNotificationService', () => ({
  holidayNotificationService: {
    sendEmergencyHolidayNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../HolidayConfigService', () => ({
  HolidayConfigService: class MockHolidayConfigService {
    getHolidaysForState = vi.fn().mockResolvedValue([]);
  },
}));

describe('HolidayOverrideService', () => {
  let service: HolidayOverrideService;

  beforeEach(() => {
    service = new HolidayOverrideService();
    vi.clearAllMocks();
  });

  describe('createOverride', () => {
    const mockUser = { id: 'user-123' };

    beforeEach(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should create a holiday override successfully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'override-1',
              company_id: 'user-123',
              date: '2025-03-15',
              name: 'Company Day',
              type: 'company',
              created_by: 'user-123',
            },
            error: null,
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const input: HolidayOverrideInput = {
        date: '2025-03-15',
        name: 'Company Day',
        type: 'company',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Company Day');
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should validate date format', async () => {
      const input: HolidayOverrideInput = {
        date: '03-15-2025', // Invalid format
        name: 'Company Day',
        type: 'company',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid date format');
    });

    it('should validate date value', async () => {
      const input: HolidayOverrideInput = {
        date: '2025-13-45', // Invalid date
        name: 'Company Day',
        type: 'company',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid date value');
    });

    it('should handle duplicate override error', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const input: HolidayOverrideInput = {
        date: '2025-03-15',
        name: 'Company Day',
        type: 'company',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should trigger emergency notification for emergency holidays', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'override-1',
              company_id: 'user-123',
              date: '2025-03-15',
              name: 'Emergency Closure',
              type: 'emergency',
              created_by: 'user-123',
            },
            error: null,
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const { holidayNotificationService } = await import('../HolidayNotificationService');

      const input: HolidayOverrideInput = {
        date: '2025-03-15',
        name: 'Emergency Closure',
        type: 'emergency',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(true);
      // Allow async notification to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(holidayNotificationService.sendEmergencyHolidayNotification).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const input: HolidayOverrideInput = {
        date: '2025-03-15',
        name: 'Company Day',
        type: 'company',
      };

      const result = await service.createOverride(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticated');
    });
  });

  describe('getOverrides', () => {
    const mockUser = { id: 'user-123' };

    beforeEach(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should fetch all overrides for the current user', async () => {
      const mockData = [
        { id: '1', name: 'Holiday 1', date: '2025-03-15', type: 'company' },
        { id: '2', name: 'Holiday 2', date: '2025-06-20', type: 'company' },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const overrides = await service.getOverrides();

      expect(overrides).toHaveLength(2);
      expect(overrides[0].name).toBe('Holiday 1');
    });

    it('should filter by year when provided', async () => {
      const mockData = [
        { id: '1', name: 'Holiday 1', date: '2025-03-15', type: 'company' },
      ];

      const mockLte = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte });
      const mockOrder = vi.fn().mockReturnValue({ gte: mockGte });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const overrides = await service.getOverrides(2025);

      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-01');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-12-31');
      expect(overrides).toHaveLength(1);
    });

    it('should return empty array when not authenticated', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const overrides = await service.getOverrides();

      expect(overrides).toEqual([]);
    });
  });

  describe('updateOverride', () => {
    it('should update an override successfully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'override-1',
                name: 'Updated Holiday',
                type: 'company',
              },
              error: null,
            }),
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        update: mockUpdate,
      });

      const result = await service.updateOverride('override-1', {
        name: 'Updated Holiday',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Holiday');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should reject update with no fields', async () => {
      const result = await service.updateOverride('override-1', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No update fields');
    });
  });

  describe('deleteOverride', () => {
    it('should delete an override successfully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        delete: mockDelete,
      });

      const success = await service.deleteOverride('override-1');

      expect(success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Delete failed' },
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        delete: mockDelete,
      });

      const success = await service.deleteOverride('override-1');

      expect(success).toBe(false);
    });
  });

  describe('getMergedHolidays', () => {
    it('should merge scraped and override holidays', async () => {
      const scrapedHolidays = [
        {
          id: 'scraped-1',
          date: '2025-01-01',
          name: 'New Year',
          state: 'ALL',
          type: 'federal',
          source: 'web',
          year: 2025,
          scraped_at: '2025-01-01',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: 'scraped-2',
          date: '2025-03-15',
          name: 'Federal Holiday',
          state: 'ALL',
          type: 'federal',
          source: 'web',
          year: 2025,
          scraped_at: '2025-01-01',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      const overrides: HolidayOverride[] = [
        {
          id: 'override-1',
          company_id: 'user-123',
          date: '2025-03-15',
          name: 'Company Day (Override)',
          type: 'company',
          created_by: 'user-123',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      // Mock the service methods
      service['configService'].getHolidaysForState = vi.fn().mockResolvedValue(scrapedHolidays);
      service.getOverrides = vi.fn().mockResolvedValue(overrides);

      const merged = await service.getMergedHolidays('SGR', 2025);

      // Should have 2 holidays: New Year (scraped) and Company Day (override replaces scraped)
      expect(merged).toHaveLength(2);
      expect(merged[0].name).toBe('New Year');
      expect(merged[0].source).toBe('scraped');
      expect(merged[1].name).toBe('Company Day (Override)');
      expect(merged[1].source).toBe('override');
    });

    it('should sort merged holidays by date', async () => {
      const scrapedHolidays = [
        {
          id: 'scraped-1',
          date: '2025-06-01',
          name: 'June Holiday',
          state: 'ALL',
          type: 'federal',
          source: 'web',
          year: 2025,
          scraped_at: '2025-01-01',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      const overrides: HolidayOverride[] = [
        {
          id: 'override-1',
          company_id: 'user-123',
          date: '2025-03-15',
          name: 'March Holiday',
          type: 'company',
          created_by: 'user-123',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      service['configService'].getHolidaysForState = vi.fn().mockResolvedValue(scrapedHolidays);
      service.getOverrides = vi.fn().mockResolvedValue(overrides);

      const merged = await service.getMergedHolidays('SGR', 2025);

      expect(merged).toHaveLength(2);
      expect(merged[0].date).toBe('2025-03-15'); // March should come first
      expect(merged[1].date).toBe('2025-06-01'); // June should come second
    });
  });

  describe('bulkImportOverrides', () => {
    const mockUser = { id: 'user-123' };

    beforeEach(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should import multiple holidays successfully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn()
            .mockResolvedValueOnce({
              data: { id: '1', name: 'Holiday 1', date: '2025-03-15', type: 'company' },
              error: null,
            })
            .mockResolvedValueOnce({
              data: { id: '2', name: 'Holiday 2', date: '2025-06-20', type: 'company' },
              error: null,
            }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const rows = [
        { date: '2025-03-15', name: 'Holiday 1', type: 'company' as const },
        { date: '2025-06-20', name: 'Holiday 2', type: 'company' as const },
      ];

      const result = await service.bulkImportOverrides(rows);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.imported).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn()
            .mockResolvedValueOnce({
              data: { id: '1', name: 'Holiday 1', date: '2025-03-15', type: 'company' },
              error: null,
            })
            .mockResolvedValueOnce({
              data: null,
              error: { code: '23505', message: 'duplicate' },
            }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      const rows = [
        { date: '2025-03-15', name: 'Holiday 1', type: 'company' as const },
        { date: '2025-03-15', name: 'Duplicate', type: 'company' as const },
      ];

      const result = await service.bulkImportOverrides(rows);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
    });
  });

  describe('hasOverrideForDate', () => {
    const mockUser = { id: 'user-123' };

    beforeEach(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should return true if override exists for date', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const exists = await service.hasOverrideForDate('2025-03-15');

      expect(exists).toBe(true);
    });

    it('should return false if no override exists', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.from as any) = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      const exists = await service.hasOverrideForDate('2025-03-15');

      expect(exists).toBe(false);
    });
  });
});
