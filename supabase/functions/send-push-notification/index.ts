// @ts-nocheck
/**
 * Send Push Notification Edge Function
 *
 * Backend service for sending push notifications to subscribed users.
 * Handles multi-device support, subscription cleanup, and VAPID authentication.
 *
 * @endpoint POST /functions/v1/send-push-notification
 * @payload {NotificationPayload} user_id, title, body, icon, data
 * @returns {PushResult} success/failed/expired counts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'
import webpush from 'https://esm.sh/web-push@3.6.7'
import type {
  NotificationPayload,
  PushResult,
  PushSubscriptionRecord,
  WebPushSubscription,
  ErrorResponse,
  NotificationPreferences
} from './types.ts'

// CORS headers for internal API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  console.log(`[Request] ${req.method} ${req.url}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling preflight request')
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Method not allowed. Use POST request.'
    }
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  const startTime = performance.now()

  try {
    // Parse and validate request payload
    const payload: NotificationPayload = await req.json()

    // Validate required fields
    if (!payload.user_id || !payload.title || !payload.body) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Missing required fields: user_id, title, body'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate user_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(payload.user_id)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid user_id format. Expected UUID.'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Sanitize and validate payload size
    const sanitizedPayload = sanitizePayload(payload)
    const payloadSize = JSON.stringify(sanitizedPayload).length
    if (payloadSize > 4096) { // 4KB limit
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Payload too large. Maximum 4KB allowed.'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Send push notification
    const result = await sendPushNotification(sanitizedPayload)

    const executionTime = performance.now() - startTime
    console.log(`[Push] Notification sent in ${executionTime.toFixed(2)}ms:`, result)

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const executionTime = performance.now() - startTime
    console.error(`[Push] Error after ${executionTime.toFixed(2)}ms:`, error)

    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Sanitizes notification payload to prevent XSS and injection attacks
 */
function sanitizePayload(payload: NotificationPayload): NotificationPayload {
  return {
    user_id: payload.user_id,
    title: payload.title.substring(0, 100), // Limit title length
    body: payload.body.substring(0, 300), // Limit body length
    icon: payload.icon?.substring(0, 500),
    badge: payload.badge?.substring(0, 500),
    data: payload.data ? {
      ...payload.data,
      targetUrl: payload.data.targetUrl?.substring(0, 500) || '/'
    } : undefined,
    notification_type: payload.notification_type
  }
}

/**
 * Sends push notification to all active subscriptions for a user
 */
async function sendPushNotification(payload: NotificationPayload): Promise<PushResult> {
  // Get VAPID configuration from environment
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@otms.com'
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured in environment variables')
  }

  console.log('[Push] VAPID configured:', {
    subject: vapidSubject,
    hasPublicKey: !!vapidPublicKey,
    hasPrivateKey: !!vapidPrivateKey
  })

  // Configure VAPID with web-push library
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  )

  // Create Supabase client with service role (bypasses RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration not found in environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check user notification preferences before sending
  const shouldSend = await shouldSendNotification(supabase, payload.user_id, payload.notification_type)

  if (!shouldSend) {
    console.log(`[Push] Notification blocked by user preferences for user: ${payload.user_id}, type: ${payload.notification_type}`)
    return {
      success: 0,
      failed: 0,
      expired: 0,
      message: 'Notification blocked by user preferences'
    }
  }

  // Query all active subscriptions for the user
  console.log(`[Push] Querying subscriptions for user: ${payload.user_id}`)

  const { data: subscriptions, error: queryError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', payload.user_id)
    .eq('is_active', true)

  if (queryError) {
    console.error('[Push] Database query error:', queryError)
    throw new Error(`Failed to query subscriptions: ${queryError.message}`)
  }

  // Handle no active subscriptions
  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[Push] No active subscriptions found for user: ${payload.user_id}`)
    return {
      success: 0,
      failed: 0,
      expired: 0,
      message: 'No active subscriptions for user'
    }
  }

  console.log(`[Push] Found ${subscriptions.length} active subscription(s)`)

  // Send notifications to all subscriptions in parallel
  const results = await Promise.allSettled(
    subscriptions.map((sub: PushSubscriptionRecord) =>
      sendToSubscription(sub, payload)
    )
  )

  // Process results and track expired subscriptions
  let successCount = 0
  let failedCount = 0
  const expiredIds: string[] = []

  results.forEach((result, index) => {
    const subscription = subscriptions[index]

    if (result.status === 'fulfilled') {
      successCount++
      console.log(`[Push] ✓ Sent to subscription ${subscription.id}`)
    } else {
      failedCount++
      const error = result.reason

      // Check if subscription expired (HTTP 410 Gone)
      if (error?.statusCode === 410 || error?.code === 410) {
        expiredIds.push(subscription.id)
        console.log(`[Push] ✗ Subscription ${subscription.id} expired (410)`)
      } else {
        console.error(`[Push] ✗ Failed to send to subscription ${subscription.id}:`, error)
      }
    }
  })

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    console.log(`[Push] Removing ${expiredIds.length} expired subscription(s)`)

    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)

    if (deleteError) {
      console.error('[Push] Failed to delete expired subscriptions:', deleteError)
      // Don't throw - continue with result reporting
    } else {
      console.log(`[Push] ✓ Cleaned up ${expiredIds.length} expired subscription(s)`)
    }
  }

  const result: PushResult = {
    success: successCount,
    failed: failedCount,
    expired: expiredIds.length
  }

  console.log(`[Push] Final result:`, result)
  return result
}

/**
 * Checks if a notification should be sent based on user preferences
 * @param supabase - Supabase client instance
 * @param userId - Target user ID
 * @param notificationType - Type of notification (e.g., 'ot_requests_new')
 * @returns true if notification should be sent, false otherwise
 */
async function shouldSendNotification(
  supabase: any,
  userId: string,
  notificationType?: string
): Promise<boolean> {
  try {
    // If no notification type specified, allow by default (backwards compatible)
    if (!notificationType) {
      console.log('[Push] No notification_type specified, allowing notification')
      return true
    }

    // Fetch user preferences from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Push] Error fetching notification preferences:', {
        userId,
        notificationType,
        error: error.message,
        code: error.code,
        details: error.details
      })
      // On error, allow notification (fail open)
      return true
    }

    const preferences = profile?.notification_preferences as NotificationPreferences | null

    // If no preferences set, allow all notifications (default behavior)
    if (!preferences) {
      console.log('[Push] No preferences found, allowing notification')
      return true
    }

    // Check global disable flag first
    if (preferences.all_disabled === true) {
      console.log('[Push] All notifications disabled for user')
      return false
    }

    // Check specific notification type preference
    const preferenceKey = notificationType as keyof NotificationPreferences
    if (preferenceKey in preferences) {
      const isEnabled = preferences[preferenceKey]
      console.log(`[Push] Preference for ${notificationType}: ${isEnabled}`)
      return isEnabled !== false // Default to true if not explicitly false
    }

    // Unknown notification type, allow by default
    console.log(`[Push] Unknown notification type '${notificationType}', allowing notification`)
    return true

  } catch (err) {
    console.error('[Push] Unexpected error checking preferences:', {
      userId,
      notificationType,
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined
    })
    // On unexpected error, allow notification (fail open)
    return true
  }
}

/**
 * Sends notification to a single subscription
 */
async function sendToSubscription(
  subscription: PushSubscriptionRecord,
  payload: NotificationPayload
): Promise<void> {
  // Convert database subscription to web-push format
  const pushSubscription: WebPushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh_key,
      auth: subscription.auth_key
    }
  }

  // Build notification options
  const notificationOptions = {
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    data: payload.data || { targetUrl: '/' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: 'otms-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200]
  }

  console.log('[Push] Sending to endpoint:', subscription.endpoint.substring(0, 50) + '...')

  try {
    // Send notification via npm:web-push
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(notificationOptions)
    )

    console.log('[Push] Notification sent successfully to subscription:', subscription.id)
  } catch (error) {
    console.error('[Push] Error sending to subscription:', subscription.id, error)
    throw error // Re-throw to be caught by Promise.allSettled
  }
}
