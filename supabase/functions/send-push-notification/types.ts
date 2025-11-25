/**
 * TypeScript type definitions for Push Notification Service
 *
 * This module defines the interfaces used by the send-push-notification
 * Edge Function for payload validation, database queries, and response handling.
 */

/**
 * Input payload for sending push notifications
 */
export interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: NotificationData;
  notification_type?: 'ot_requests_new' | 'ot_requests_approved' | 'ot_requests_rejected';
}

/**
 * Custom data attached to notification for routing and context
 */
export interface NotificationData {
  targetUrl: string;
  type?: 'ot_request_submitted' | 'ot_request_approved' | 'ot_request_rejected' | string;
  requestId?: string;
  employeeName?: string;
  [key: string]: any;
}

/**
 * Result of push notification sending operation
 */
export interface PushResult {
  success: number;
  failed: number;
  expired: number;
  message?: string;
}

/**
 * Push subscription record from database (Web Push API)
 */
export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * FCM subscription record from database (Firebase Cloud Messaging)
 */
export interface FCMSubscriptionRecord {
  id: string;
  user_id: string;
  fcm_token: string;
  device_name?: string;
  device_type?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Web Push subscription format for web-push library
 */
export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

/**
 * User notification preferences stored in profiles table
 */
export interface NotificationPreferences {
  ot_requests_new: boolean;
  ot_requests_approved: boolean;
  ot_requests_rejected: boolean;
  all_disabled: boolean;
}
