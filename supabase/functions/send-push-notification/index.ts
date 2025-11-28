import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
// Cache for Firebase access token (expires in 1 hour)
let cachedAccessToken = null;
/**
 * Validate the incoming notification payload
 */ function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'payload',
          reason: 'Payload must be a JSON object'
        }
      ]
    };
  }
  const p = payload;
  const errors = [];
  // Validate user_id (UUID format)
  if (!p.user_id || typeof p.user_id !== 'string') {
    errors.push({
      field: 'user_id',
      reason: 'user_id is required and must be a string'
    });
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.user_id)) {
    errors.push({
      field: 'user_id',
      reason: 'user_id must be a valid UUID'
    });
  }
  // Validate title
  if (!p.title || typeof p.title !== 'string') {
    errors.push({
      field: 'title',
      reason: 'title is required and must be a string'
    });
  } else if (p.title.length > 256) {
    errors.push({
      field: 'title',
      reason: 'title must be 256 characters or less'
    });
  } else if (p.title.length === 0) {
    errors.push({
      field: 'title',
      reason: 'title cannot be empty'
    });
  }
  // Validate body
  if (!p.body || typeof p.body !== 'string') {
    errors.push({
      field: 'body',
      reason: 'body is required and must be a string'
    });
  } else if (p.body.length > 4096) {
    errors.push({
      field: 'body',
      reason: 'body must be 4096 characters or less'
    });
  } else if (p.body.length === 0) {
    errors.push({
      field: 'body',
      reason: 'body cannot be empty'
    });
  }
  // Optional: validate notification_type if provided
  if (p.notification_type) {
    const validTypes = [
      'ot_requests_new',
      'ot_requests_approved',
      'ot_requests_rejected',
      'ot_pending_confirmation',
      'ot_supervisor_confirmed',
      'ot_respective_supervisor_confirmed',
      'ot_request_respective_supervisor_confirmation',
      'ot_respective_supervisor_denied'
    ];
    if (!validTypes.includes(p.notification_type)) {
      errors.push({
        field: 'notification_type',
        reason: `notification_type must be one of: ${validTypes.join(', ')}`
      });
    }
  }
  // Optional: validate data object
  if (p.data && typeof p.data === 'object') {
    const data = p.data;
    if (data.targetUrl && typeof data.targetUrl !== 'string') {
      errors.push({
        field: 'data.targetUrl',
        reason: 'data.targetUrl must be a string'
      });
    }
    // Validate data keys (alphanumeric + underscore only)
    for (const key of Object.keys(data)){
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        errors.push({
          field: `data.${key}`,
          reason: 'Data keys must contain only alphanumeric characters and underscores'
        });
      }
    }
  }
  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }
  return {
    valid: true,
    payload: p
  };
}
/**
 * Create Supabase client for database operations
 */ function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
/**
 * Get Firebase access token (with caching)
 */ async function getFirebaseAccessToken() {
  // Return cached token if still valid
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  // Create JWT for service account
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };
  const headerEncoded = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadEncoded = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  // Sign JWT with private key
  const message = `${headerEncoded}.${payloadEncoded}`;
  const keyData = serviceAccount.private_key.replace(/\\n/g, '\n');
  // Use Web Crypto API for signing
  const encoder = new TextEncoder();
  const keyObject = await crypto.subtle.importKey('pkcs8', pem2ab(keyData), {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyObject, encoder.encode(message));
  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${message}.${signatureEncoded}`;
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get Firebase access token: ${await tokenResponse.text()}`);
  }
  const tokenData = await tokenResponse.json();
  // Cache token (with 5-minute buffer before expiry)
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 300) * 1000
  };
  return tokenData.access_token;
}
/**
 * Convert PEM string to ArrayBuffer
 */ function pem2ab(pem) {
  const lines = pem.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/\s/g, '');
  const binary = atob(lines);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++){
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
/**
 * Check if user allows this notification type
 */ async function checkUserNotificationPreference(supabase, userId, notificationType) {
  const { data: profile, error } = await supabase.from('profiles').select('notification_preferences').eq('id', userId).single();
  if (error) {
    console.warn(`[SendPushNotification] Failed to fetch user preferences: ${error.message}`);
    // Default to allowing notifications if fetch fails
    return true;
  }
  if (!profile) {
    // User doesn't exist - allow send (will fail at other validation)
    return true;
  }
  const prefs = profile.notification_preferences || {};
  // Check global disable flag
  if (prefs.all_disabled === true) {
    console.log(`[SendPushNotification] User ${userId} has all notifications disabled`);
    return false;
  }
  // Check specific notification type
  if (notificationType && prefs[notificationType] === false) {
    console.log(`[SendPushNotification] User ${userId} has disabled ${notificationType}`);
    return false;
  }
  return true;
}
/**
 * Fetch all active FCM tokens for a user
 */ async function fetchUserFCMTokens(supabase, userId) {
  const { data, error } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId).eq('is_active', true);
  if (error) {
    console.error(`[SendPushNotification] Failed to fetch FCM tokens: ${error.message}`);
    return [];
  }
  return data || [];
}
/**
 * Build FCM message from notification payload
 */ function buildFCMMessage(token, payload) {
  const targetUrl = payload.data?.targetUrl || '/';
  const tag = `${payload.notification_type || 'notification'}-${Date.now()}`;
  const message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body
    },
    webpush: {
      notification: {
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/badge-72x72.png',
        title: payload.title,
        body: payload.body,
        tag,
        requireInteraction: false
      },
      fcmOptions: {
        link: targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`
      }
    }
  };
  // Add data payload if provided (convert all values to strings for FCM)
  if (payload.data) {
    const dataPayload = {};
    for (const [key, value] of Object.entries(payload.data)){
      if (key !== 'targetUrl') {
        dataPayload[key] = String(value);
      }
    }
    if (Object.keys(dataPayload).length > 0) {
      message.data = dataPayload;
    }
  }
  return message;
}
/**
 * Send message via FCM REST API
 */ async function sendViaFCM(projectId, accessToken, message) {
  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message
      })
    });
    const responseData = await response.json();
    if (!response.ok) {
      const errorCode = responseData.error?.status || 'unknown_error';
      const errorMessage = responseData.error?.message || 'Unknown FCM error';
      console.warn(`[SendPushNotification] FCM error for token ${message.token}: ${errorCode} - ${errorMessage}`);
      return {
        token: message.token,
        success: false,
        error: `${errorCode}: ${errorMessage}`
      };
    }
    return {
      token: message.token,
      success: true,
      messageId: responseData.name
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SendPushNotification] Failed to send to token ${message.token}: ${errorMsg}`);
    return {
      token: message.token,
      success: false,
      error: errorMsg
    };
  }
}
/**
 * Mark invalid tokens as inactive
 */ async function cleanupInvalidTokens(supabase, invalidTokens) {
  if (invalidTokens.length === 0) return;
  const { error } = await supabase.from('push_subscriptions').update({
    is_active: false
  }).in('fcm_token', invalidTokens);
  if (error) {
    console.error(`[SendPushNotification] Failed to cleanup invalid tokens: ${error.message}`);
  } else {
    console.log(`[SendPushNotification] Marked ${invalidTokens.length} invalid tokens as inactive`);
  }
}
/**
 * Main handler
 */ Deno.serve(async (req)=>{
  const startTime = Date.now();
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      message: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    // Parse and validate payload
    const bodyText = await req.text();
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch  {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const notificationPayload = validation.payload;
    console.log(`[SendPushNotification] Processing notification for user ${notificationPayload.user_id}`);
    // Initialize Supabase client
    const supabase = getSupabaseClient();
    // Check user notification preferences
    const preferencesAllowed = await checkUserNotificationPreference(supabase, notificationPayload.user_id, notificationPayload.notification_type);
    if (!preferencesAllowed) {
      const duration = Date.now() - startTime;
      console.log(`[SendPushNotification] ✓ Preferences blocked notification in ${duration}ms`);
      return new Response(JSON.stringify({
        success: true,
        message: 'User notification preferences disabled this notification type',
        sentCount: 0,
        failedCount: 0,
        invalidTokens: [],
        errors: []
      }), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Fetch user's FCM tokens
    const subscriptions = await fetchUserFCMTokens(supabase, notificationPayload.user_id);
    if (subscriptions.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`[SendPushNotification] ✓ No active subscriptions for user in ${duration}ms`);
      return new Response(JSON.stringify({
        success: true,
        message: 'User has no active FCM subscriptions',
        sentCount: 0,
        failedCount: 0,
        invalidTokens: [],
        errors: []
      }), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Get Firebase access token
    let accessToken;
    try {
      accessToken = await getFirebaseAccessToken();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SendPushNotification] Failed to get Firebase access token: ${errorMsg}`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to authenticate with Firebase',
        errors: [
          {
            reason: errorMsg
          }
        ]
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Get Firebase project ID
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    const projectId = serviceAccount.project_id;
    // Send to all tokens in parallel
    const sendPromises = subscriptions.map((sub)=>{
      const message = buildFCMMessage(sub.fcm_token, notificationPayload);
      return sendViaFCM(projectId, accessToken, message);
    });
    const results = await Promise.allSettled(sendPromises);
    // Process results
    const invalidTokens = [];
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];
    for (const result of results){
      if (result.status === 'fulfilled') {
        const sendResult = result.value;
        if (sendResult.success) {
          sentCount++;
          console.log(`[SendPushNotification] ✓ Sent to device ${sendResult.token.substring(0, 20)}...`);
        } else {
          failedCount++;
          errors.push({
            token: sendResult.token,
            reason: sendResult.error || 'Unknown error'
          });
          // Mark invalid tokens for cleanup
          if (sendResult.error?.includes('invalid-registration-token')) {
            invalidTokens.push(sendResult.token);
          }
        }
      } else {
        failedCount++;
        const error = result.reason;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          reason: errorMsg
        });
      }
    }
    // Cleanup invalid tokens
    if (invalidTokens.length > 0) {
      await cleanupInvalidTokens(supabase, invalidTokens);
    }
    const duration = Date.now() - startTime;
    const successRate = sentCount > 0 ? Math.round(sentCount / subscriptions.length * 100) : 0;
    console.log(`[SendPushNotification] ✓ Sent ${sentCount}/${subscriptions.length} (${successRate}%) in ${duration}ms`);
    return new Response(JSON.stringify({
      success: true,
      message: `Notification sent to ${sentCount} device(s)`,
      sentCount,
      failedCount,
      invalidTokens,
      errors
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SendPushNotification] Unexpected error: ${errorMsg}`, error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error',
      error: errorMsg
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
