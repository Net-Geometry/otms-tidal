/**
 * Holiday Configuration Types
 *
 * Type definitions for Malaysian holiday management system.
 */

import type { MalaysianStateKey } from '@/config/malaysia-states';

// Re-export holiday override types
export * from './holiday-overrides';

// Re-export holiday scheduling / automation types
export * from './holiday-scheduling';

/**
 * Company configuration for holiday calendar settings
 */
export interface CompanyConfig {
  /** Unique identifier */
  id: string;
  /** Company/user ID (references auth.users) */
  company_id: string;
  /** Selected Malaysian state key */
  selected_state: MalaysianStateKey;
  /** Timestamp of last configuration update */
  updated_at: string;
  /** Timestamp of initial configuration */
  created_at: string;
}

/**
 * Input data for creating or updating company configuration
 */
export interface CompanyConfigInput {
  /** Selected Malaysian state key */
  selected_state: MalaysianStateKey;
}

/**
 * Response from holiday configuration service methods
 */
export interface HolidayConfigResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Optional error message */
  error?: string;
  /** Optional result data */
  data?: CompanyConfig;
}

/**
 * Malaysian holiday data from the database
 */
export interface MalaysianHoliday {
  /** Unique identifier */
  id: string;
  /** Holiday date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Holiday name */
  name: string;
  /** State code (e.g., 'SGR', 'KUL') or 'ALL' for federal holidays */
  state: string;
  /** Holiday type classification */
  type: 'federal' | 'state' | 'religious';
  /** Source URL where holiday was scraped from */
  source: string;
  /** Year of the holiday */
  year: number;
  /** Timestamp when holiday was scraped */
  scraped_at: string;
  /** Timestamp when record was created */
  created_at: string;
  /** Timestamp when record was last updated */
  updated_at: string;
}

/**
 * Response from holiday scraping operations
 */
export interface HolidayScrapingResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Year that was scraped */
  year: number;
  /** Number of states scraped */
  states_scraped: number;
  /** Number of states that succeeded */
  states_succeeded: number;
  /** Number of states that failed */
  states_failed: number;
  /** Number of holidays scraped */
  holidays_scraped: number;
  /** Number of holidays from cache */
  holidays_cached: number;
  /** Total holidays available */
  total_holidays: number;
  /** Error details for failed states */
  errors?: Array<{ state: string; error: string }>;
  /** Human-readable message */
  message: string;
}
