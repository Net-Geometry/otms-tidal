// src/config/features.ts

/**
 * Feature Flags for Tidal Portal
 * Control visibility of experimental or upcoming features
 */

/**
 * ENABLE_PUSH_NOTIFICATIONS
 *
 * Controls visibility of push notification UI (Settings page section)
 *
 * ACTIVE: Push notification subscription flow enabled (Story 3.2)
 * Users can grant permission and subscribe to push notifications
 *
 * Dependencies:
 * - Service worker push handlers (Story 2.2) ✓
 * - Push subscription API (Story 2.3) ✓
 * - VAPID keys configured (Story 3.1) ✓
 */
export const ENABLE_PUSH_NOTIFICATIONS = true;

// Future feature flags can be added here
// export const ENABLE_OFFLINE_MODE = false;
// export const ENABLE_BACKGROUND_SYNC = false;
