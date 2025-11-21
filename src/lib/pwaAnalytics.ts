/**
 * PWA Installation Event Log
 */
export interface PWAInstallEvent {
  timestamp: number;
  type: 'prompt_shown' | 'prompt_clicked' | 'prompt_accepted' | 'prompt_dismissed' | 'install_success' | 'install_failed' | 'error';
  browser: string;
  device: string;
  details?: Record<string, any>;
}

/**
 * PWA Analytics Storage Key
 */
const STORAGE_KEY = 'pwa-install-events';
const MAX_EVENTS = 50; // Keep last 50 events

/**
 * Log a PWA installation event
 */
export const logPWAEvent = (
  type: PWAInstallEvent['type'],
  browser: string,
  device: string,
  details?: Record<string, any>
): void => {
  try {
    const events = getPWAEvents();

    const event: PWAInstallEvent = {
      timestamp: Date.now(),
      type,
      browser,
      device,
      details,
    };

    // Add new event
    events.push(event);

    // Keep only last MAX_EVENTS
    if (events.length > MAX_EVENTS) {
      events.shift();
    }

    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));

    // Also log to console for debugging
    console.log(`[PWA Analytics] ${type}:`, {
      browser,
      device,
      timestamp: new Date(event.timestamp).toISOString(),
      ...details,
    });
  } catch (error) {
    console.warn('[PWA Analytics] Failed to log event:', error);
  }
};

/**
 * Get all logged PWA events
 */
export const getPWAEvents = (): PWAInstallEvent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('[PWA Analytics] Failed to retrieve events:', error);
    return [];
  }
};

/**
 * Get analytics summary
 */
export const getPWAAnalyticsSummary = () => {
  const events = getPWAEvents();

  if (events.length === 0) {
    return {
      totalEvents: 0,
      uniqueBrowsers: 0,
      successRate: 0,
      lastEventTime: null,
    };
  }

  const successful = events.filter((e) => e.type === 'install_success').length;
  const total = events.filter((e) => e.type === 'prompt_shown').length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  const browsers = new Set(events.map((e) => e.browser)).size;
  const lastEvent = events[events.length - 1];

  return {
    totalEvents: events.length,
    uniqueBrowsers: browsers,
    successRate,
    lastEventTime: new Date(lastEvent.timestamp).toISOString(),
  };
};

/**
 * Clear all PWA events (for testing)
 */
export const clearPWAEvents = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[PWA Analytics] Events cleared');
  } catch (error) {
    console.warn('[PWA Analytics] Failed to clear events:', error);
  }
};

/**
 * Export analytics as JSON for debugging
 */
export const exportPWAAnalytics = (): string => {
  const events = getPWAEvents();
  const summary = getPWAAnalyticsSummary();

  return JSON.stringify(
    {
      summary,
      events,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
};
