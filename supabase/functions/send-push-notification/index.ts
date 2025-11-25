// @ts-nocheck
/**
 * Send Push Notification Edge Function (FCM)
 *
 * Backend service for sending push notifications to subscribed users via Firebase Cloud Messaging.
 * Handles multi-device support, subscription cleanup, and FCM authentication.
 *
 * @endpoint POST /functions/v1/send-push-notification
 * @payload {NotificationPayload} user_id, title, body, icon, data
 * @returns {PushResult} success/failed/expired counts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'
import { initializeApp, cert } from 'npm:firebase-admin@12.0.0/app'
import { getMessaging } from 'npm:firebase-admin@12.0.0/messaging'
import type {
  NotificationPayload,
  PushResult,
  FCMSubscriptionRecord,
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

// Firebase Admin SDK singleton
let firebaseApp: any = null

function initializeFirebase() {
  if (firebaseApp) return firebaseApp

  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const storageBucket = Deno.env.get('FIREBASE_STORAGE_BUCKET')

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Firebase credentials not configured in environment variables')
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: 'key-id',
    private_key: privateKey,
    client_email: clientEmail,
    client_id: 'client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${clientEmail}`
  }

  firebaseApp = initializeApp({
    credential: cert(serviceAccount as any),
    projectId
  })

  return firebaseApp
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
 * Sends push notification to all active subscriptions for a user via FCM
 */
async function sendPushNotification(payload: NotificationPayload): Promise<PushResult> {
  // Initialize Firebase Admin SDK
  const app = initializeFirebase()
  const messaging = getMessaging(app)

  console.log('[Push] Firebase initialized for project')

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

  // Query all active FCM subscriptions for the user
  console.log(`[Push] Querying FCM subscriptions for user: ${payload.user_id}`)

  const { data: subscriptions, error: queryError } = await supabase
    .from('push_subscriptions_fcm')
    .select('*')
    .eq('user_id', payload.user_id)
    .eq('is_active', true)

  if (queryError) {
    console.error('[Push] Database query error:', queryError)
    throw new Error(`Failed to query subscriptions: ${queryError.message}`)
  }

  // Handle no active subscriptions
  if (!subscriptions || subscriptions.length === 0) {
    console.log(`[Push] No active FCM subscriptions found for user: ${payload.user_id}`)
    return {
      success: 0,
      failed: 0,
      expired: 0,
      message: 'No active subscriptions for user'
    }
  }

  console.log(`[Push] Found ${subscriptions.length} active FCM subscription(s)`)

  // Send notifications to all subscriptions in parallel
  const results = await Promise.allSettled(
    subscriptions.map((sub: FCMSubscriptionRecord) =>
      sendToSubscriptionFCM(sub, payload, messaging, supabase)
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
      console.log(`[Push] ✓ Sent to FCM token ${subscription.id}`)
    } else {
      failedCount++
      const error = result.reason

      // Check if token is invalid/expired
      if (isExpiredToken(error)) {
        expiredIds.push(subscription.id)
        console.log(`[Push] ✗ FCM token ${subscription.id} expired or invalid`)
      } else {
        console.error(`[Push] ✗ Failed to send to FCM token ${subscription.id}:`, error)
      }
    }
  })

  // Clean up expired/invalid tokens
  if (expiredIds.length > 0) {
    console.log(`[Push] Removing ${expiredIds.length} expired/invalid token(s)`)

    const { error: deleteError } = await supabase
      .from('push_subscriptions_fcm')
      .delete()
      .in('id', expiredIds)

    if (deleteError) {
      console.error('[Push] Failed to delete expired tokens:', deleteError)
      // Don't throw - continue with result reporting
    } else {
      console.log(`[Push] ✓ Cleaned up ${expiredIds.length} expired token(s)`)
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
 * Checks if an error indicates an expired or invalid FCM token
 */
function isExpiredToken(error: any): boolean {
  const errorCode = error?.code || error?.errorCode || ''
  const message = error?.message || ''

  return (
    errorCode === 'messaging/registration-token-not-registered' ||
    errorCode === 'messaging/mismatched-credential' ||
    errorCode === 'messaging/invalid-registration-token' ||
    message.includes('registration token') ||
    message.includes('invalid token')
  )
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
 * Sends notification to a single FCM subscription
 */
async function sendToSubscriptionFCM(
  subscription: FCMSubscriptionRecord,
  payload: NotificationPayload,
  messaging: any,
  supabase: any
): Promise<void> {
  // Build FCM message
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.icon || '/icons/icon-192x192.png'
    },
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        actions: [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        tag: 'otms-notification',
        requireInteraction: false,
        vibrate: [200, 100, 200]
      },
      data: payload.data ? {
        targetUrl: payload.data.targetUrl || '/',
        ...payload.data
      } : {
        targetUrl: '/'
      }
    },
    data: payload.data ? {
      targetUrl: payload.data.targetUrl || '/',
      ...payload.data
    } : {
      targetUrl: '/'
    }
  }

  console.log('[Push] Sending to FCM token:', subscription.fcm_token.substring(0, 50) + '...')

  try {
    // Send message via Firebase Cloud Messaging
    const response = await messaging.send({
      token: subscription.fcm_token,
      ...message
    })

    console.log('[Push] FCM message sent successfully to token:', subscription.id, 'Response:', response)
  } catch (error) {
    console.error('[Push] Error sending to FCM token:', subscription.id, error)
    throw error // Re-throw to be caught by Promise.allSettled
  }
}
