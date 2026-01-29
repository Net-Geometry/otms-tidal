/**
 * Holiday Configuration Service
 *
 * Service layer for managing company holiday configuration settings.
 * Handles state selection persistence, retrieval, and holiday refresh triggers.
 *
 * @example
 * ```typescript
 * const service = new HolidayConfigService();
 *
 * // Save company state
 * await service.saveCompanyState('selangor');
 *
 * // Get current state
 * const state = await service.getCompanyState();
 * ```
 */

import { supabase } from '@/integrations/supabase/client';
import type { MalaysianStateKey } from '@/config/malaysia-states';
import type { CompanyConfig } from '@/types/holidays';
import { isValidStateKey } from '@/config/malaysia-states';

export class HolidayConfigService {
  /**
   * Manually trigger a full holiday refresh for a year (audit logged).
   */
  async manualRefresh(year?: number): Promise<{ success: boolean; error?: string }> {
    const targetYear = year || new Date().getFullYear();

    const { data, error } = await supabase.functions.invoke('scheduled-holiday-refresh', {
      body: {
        job_type: 'manual_refresh',
        year: targetYear,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: Boolean((data as any)?.success ?? true) };
  }

  /**
   * Fetch recent refresh history for HR/admin dashboards.
   */
  async getRefreshHistory(limit = 25): Promise<any[]> {
    const { data, error } = await supabase
      .from('holiday_refresh_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching refresh history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Fetch replacement holidays (Cuti Ganti) for a year.
   */
  async getReplacementHolidays(year?: number): Promise<any[]> {
    const targetYear = year || new Date().getFullYear();
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;

    const { data, error } = await supabase
      .from('malaysian_holidays')
      .select('*')
      .eq('is_replacement', true)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching replacement holidays:', error);
      return [];
    }

    return data || [];
  }

  /**
   * HR override for a calculated replacement holiday.
   *
   * Supported actions:
   * - approve: keep entry, record HR override metadata
   * - delete: remove replacement entry
   */
  async overrideReplacementHoliday(
    id: string,
    action: 'approve' | 'delete',
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await (supabase as any).rpc('hr_override_replacement_holiday', {
      p_holiday_id: id,
      p_action: action,
      p_reason: reason,
    });

    if (error) {
      console.error('Error overriding replacement holiday:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * HR modify a replacement holiday (date/name) with audit fields.
   */
  async modifyReplacementHoliday(
    id: string,
    updates: { date?: string; name?: string },
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await (supabase as any).rpc('hr_modify_replacement_holiday', {
      p_holiday_id: id,
      p_new_date: updates.date ?? null,
      p_new_name: updates.name ?? null,
      p_reason: reason,
    });

    if (error) {
      console.error('Error modifying replacement holiday:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Save or update company's selected Malaysian state
   *
   * This method:
   * 1. Validates the state key
   * 2. Saves to company_config table (upsert operation)
   * 3. Triggers holiday data refresh for the selected state
   *
   * @param stateKey - Valid Malaysian state key
   * @throws Error if state key is invalid or database operation fails
   *
   * @example
   * ```typescript
   * await service.saveCompanyState('selangor');
   * ```
   */
  async saveCompanyState(stateKey: string): Promise<void> {
    // Validate state key
    if (!isValidStateKey(stateKey)) {
      throw new Error(`Invalid state key: ${stateKey}`);
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to save configuration');
    }

    // Upsert company configuration
    const { error: upsertError } = await supabase
      .from('company_config')
      .upsert(
        {
          company_id: user.id,
          selected_state: stateKey,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'company_id'
        }
      );

    if (upsertError) {
      console.error('Error saving company state:', upsertError);
      throw new Error(`Failed to save state configuration: ${upsertError.message}`);
    }

    // Trigger holiday data refresh (will be implemented in Story 7.2)
    // For now, we just log the intent
    console.log(`Holiday refresh will be triggered for state: ${stateKey}`);
    // await this.refreshHolidaysForState(stateKey);
  }

  /**
   * Get current company's selected Malaysian state
   *
   * @returns The selected state key, or null if no configuration exists
   *
   * @example
   * ```typescript
   * const state = await service.getCompanyState();
   * if (state) {
   *   console.log(`Current state: ${state}`);
   * }
   * ```
   */
  async getCompanyState(): Promise<MalaysianStateKey | null> {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('User not authenticated, cannot fetch company state');
      return null;
    }

    // Query company configuration
    const { data, error } = await supabase
      .from('company_config')
      .select('selected_state')
      .eq('company_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company state:', error);
      return null;
    }

    return data?.selected_state as MalaysianStateKey || null;
  }

  /**
   * Get full company configuration including timestamps
   *
   * @returns Complete configuration object or null
   *
   * @example
   * ```typescript
   * const config = await service.getCompanyConfig();
   * if (config) {
   *   console.log(`Last updated: ${config.updated_at}`);
   * }
   * ```
   */
  async getCompanyConfig(): Promise<CompanyConfig | null> {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('User not authenticated, cannot fetch company config');
      return null;
    }

    // Query company configuration
    const { data, error } = await supabase
      .from('company_config')
      .select('*')
      .eq('company_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company config:', error);
      return null;
    }

    return data as CompanyConfig | null;
  }

  /**
   * Trigger holiday data refresh for a specific state
   *
   * Calls the scrape-malaysia-holidays Edge Function to fetch and store
   * holiday data for the current and next year.
   *
   * @param stateKey - Malaysian state key to refresh holidays for
   * @throws Error if scraping fails or Edge Function is unavailable
   *
   * @example
   * ```typescript
   * await service.refreshHolidaysForState('selangor');
   * ```
   */
  async refreshHolidaysForState(stateKey: MalaysianStateKey): Promise<void> {
    console.log(`Holiday refresh requested for state: ${stateKey}`);

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    try {
      // Scrape holidays for current and next year
      const { data, error } = await supabase.functions.invoke('scrape-malaysia-holidays', {
        body: {
          state: stateKey.toUpperCase(),
          year: currentYear,
        },
      });

      if (error) {
        console.error('Error scraping holidays for current year:', error);
        throw new Error(`Failed to scrape holidays: ${error.message}`);
      }

      console.log(`Successfully scraped holidays for ${stateKey} (${currentYear}):`, data);

      // Scrape for next year
      const { data: nextYearData, error: nextYearError } = await supabase.functions.invoke('scrape-malaysia-holidays', {
        body: {
          state: stateKey.toUpperCase(),
          year: nextYear,
        },
      });

      if (nextYearError) {
        console.warn('Error scraping holidays for next year:', nextYearError);
        // Don't throw - next year is optional
      } else {
        console.log(`Successfully scraped holidays for ${stateKey} (${nextYear}):`, nextYearData);
      }
    } catch (error) {
      console.error('Holiday refresh failed:', error);
      throw error;
    }
  }

  /**
   * Get holidays for a specific state and year from the database
   *
   * @param stateKey - Malaysian state key
   * @param year - Year to fetch holidays for (defaults to current year)
   * @returns Array of holidays
   *
   * @example
   * ```typescript
   * const holidays = await service.getHolidaysForState('selangor', 2025);
   * ```
   */
  async getHolidaysForState(stateKey: MalaysianStateKey, year?: number): Promise<any[]> {
    const targetYear = year || new Date().getFullYear();
    const stateCode = stateKey.toUpperCase();

    const { data, error } = await supabase
      .from('malaysian_holidays')
      .select('*')
      .or(`state.eq.${stateCode},state.eq.ALL`)
      .eq('year', targetYear)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
      throw new Error(`Failed to fetch holidays: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Trigger scraping for all Malaysian states
   *
   * This is a heavy operation and should be used sparingly (e.g., annual refresh).
   *
   * @param year - Year to scrape (defaults to current year)
   * @returns Scraping result summary
   *
   * @example
   * ```typescript
   * const result = await service.refreshAllStates(2025);
   * ```
   */
  async refreshAllStates(year?: number): Promise<any> {
    const targetYear = year || new Date().getFullYear();

    console.log(`Refreshing holidays for all states (year: ${targetYear})`);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-malaysia-holidays', {
        body: {
          year: targetYear,
          // No state specified = scrape all states
        },
      });

      if (error) {
        console.error('Error scraping all states:', error);
        throw new Error(`Failed to scrape all states: ${error.message}`);
      }

      console.log('Successfully scraped all states:', data);
      return data;
    } catch (error) {
      console.error('Refresh all states failed:', error);
      throw error;
    }
  }

  /**
   * Check if holiday data exists for a state and year
   *
   * @param stateKey - Malaysian state key
   * @param year - Year to check (defaults to current year)
   * @returns True if holidays exist, false otherwise
   *
   * @example
   * ```typescript
   * const hasData = await service.hasHolidayData('selangor', 2025);
   * if (!hasData) {
   *   await service.refreshHolidaysForState('selangor');
   * }
   * ```
   */
  async hasHolidayData(stateKey: MalaysianStateKey, year?: number): Promise<boolean> {
    const targetYear = year || new Date().getFullYear();
    const stateCode = stateKey.toUpperCase();

    const { count, error } = await supabase
      .from('malaysian_holidays')
      .select('*', { count: 'exact', head: true })
      .or(`state.eq.${stateCode},state.eq.ALL`)
      .eq('year', targetYear);

    if (error) {
      console.error('Error checking holiday data:', error);
      return false;
    }

    return (count || 0) > 0;
  }

  /**
   * Delete company configuration
   *
   * @returns True if deletion was successful
   *
   * @example
   * ```typescript
   * await service.deleteCompanyConfig();
   * ```
   */
  async deleteCompanyConfig(): Promise<boolean> {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('User not authenticated, cannot delete company config');
      return false;
    }

    // Delete company configuration
    const { error } = await supabase
      .from('company_config')
      .delete()
      .eq('company_id', user.id);

    if (error) {
      console.error('Error deleting company config:', error);
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const holidayConfigService = new HolidayConfigService();
