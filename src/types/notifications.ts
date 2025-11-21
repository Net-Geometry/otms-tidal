// src/types/notifications.ts

/**
 * Notification preference settings for different notification types
 */
export interface NotificationPreferences {
  /** Notifications for new OT requests (supervisors/managers only) */
  ot_requests_new: boolean;
  /** Notifications when OT requests are approved (employees) */
  ot_requests_approved: boolean;
  /** Notifications when OT requests are rejected (employees) */
  ot_requests_rejected: boolean;
  /** Notifications when OT needs supervisor confirmation (supervisors only) */
  ot_pending_confirmation: boolean;
  /** Notifications when supervisor confirms OT request (employees) */
  ot_supervisor_confirmed: boolean;
  /** Global disable flag - when true, all notifications are disabled */
  all_disabled: boolean;
}

/**
 * Default notification preferences for new users
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  ot_requests_new: true,
  ot_requests_approved: true,
  ot_requests_rejected: true,
  ot_pending_confirmation: true,
  ot_supervisor_confirmed: true,
  all_disabled: false,
};

/**
 * Notification type configuration with role-based visibility
 */
export interface NotificationTypeConfig {
  key: keyof Omit<NotificationPreferences, 'all_disabled'>;
  label: string;
  description: string;
  /** Roles that should see this notification type */
  roles: string[];
}

/**
 * Available notification types with their configurations
 */
export const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  {
    key: 'ot_requests_new',
    label: 'New OT Requests',
    description: 'Get notified when employees submit new overtime requests',
    roles: ['supervisor', 'hr', 'admin', 'management', 'bod']
  },
  {
    key: 'ot_requests_approved',
    label: 'Request Approved',
    description: 'Get notified when your OT requests are approved',
    roles: ['employee']
  },
  {
    key: 'ot_requests_rejected',
    label: 'Request Rejected',
    description: 'Get notified when your OT requests are rejected',
    roles: ['employee']
  },
  {
    key: 'ot_pending_confirmation',
    label: 'Confirmation Required',
    description: 'Get notified when verified OT requests need your confirmation',
    roles: ['supervisor']
  },
  {
    key: 'ot_supervisor_confirmed',
    label: 'OT Confirmed',
    description: 'Get notified when your supervisor confirms your OT request',
    roles: ['employee']
  }
];
