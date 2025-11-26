/**
 * Type definitions for Firebase Cloud Messaging push notification system
 */

export type NotificationType =
  | 'ot_requests_new'
  | 'ot_requests_approved'
  | 'ot_requests_rejected'
  | 'ot_pending_confirmation'
  | 'ot_supervisor_confirmed';

/**
 * Notification payload sent by calling edge functions
 * This is the primary interface used when sending push notifications
 */
export interface FCMNotificationPayload {
  // Required: User to receive the notification
  user_id: string;

  // Required: Notification content
  title: string;
  body: string;

  // Optional: Visual assets
  icon?: string;
  badge?: string;

  // Optional: Preference filtering
  // Used to check user notification preferences before sending
  notification_type?: NotificationType;

  // Optional: Deep linking and app behavior
  data?: {
    // Where to navigate on notification click
    targetUrl: string;
    // Event type for app handling (e.g., "ot_request_approved")
    type: string;
    // Optional reference to the triggering resource
    requestId?: string;
    // Additional flexible properties
    [key: string]: unknown;
  };
}

/**
 * Firebase Cloud Messaging message structure
 * This is the internal format sent to FCM API
 */
export interface FCMMessage {
  // FCM device token
  token: string;

  // Basic notification for all platforms
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };

  // Web-specific push notification options
  webpush?: {
    notification: {
      icon: string;
      badge: string;
      title: string;
      body: string;
      // Tag for notification grouping (prevents duplicates in notification area)
      tag: string;
      // Require user interaction to dismiss
      requireInteraction: boolean;
    };
    // Options for web push
    fcmOptions: {
      // URL to open when notification is clicked
      link: string;
    };
    // Custom headers if needed
    headers?: Record<string, string>;
  };

  // Data payload (FCM requires all values as strings)
  data?: Record<string, string>;
}

/**
 * Internal FCM API send response
 */
export interface FCMApiResponse {
  name: string; // Format: "projects/{project_id}/messages/{message_id}"
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Result from sending to individual device
 */
export interface SendResult {
  token: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Final response from send-push-notification function
 */
export interface FCMSendResult {
  // Overall success (true if at least some messages sent or user preferences blocked)
  success: boolean;
  // Human-readable message
  message: string;
  // Number of successful sends
  sentCount: number;
  // Number of failed sends
  failedCount: number;
  // Tokens that were invalid and cleaned up
  invalidTokens: string[];
  // Detailed error information
  errors: Array<{
    token?: string;
    reason: string;
  }>;
}

/**
 * Database subscription record
 */
export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_name: string | null;
  device_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User notification preferences from profiles table
 */
export interface NotificationPreferences {
  ot_requests_new?: boolean;
  ot_requests_approved?: boolean;
  ot_requests_rejected?: boolean;
  ot_pending_confirmation?: boolean;
  ot_supervisor_confirmed?: boolean;
  all_disabled?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * User profile with notification preferences
 */
export interface UserProfile {
  id: string;
  notification_preferences: NotificationPreferences | null;
}

/**
 * Standardized error response
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error: string;
}

/**
 * Success response
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  reason: string;
}

/**
 * Firebase service account credentials
 */
export interface FirebaseServiceAccount {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * JWT token response from Google OAuth2
 */
export interface GoogleAccessTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}
