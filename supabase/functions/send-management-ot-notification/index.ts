/**
 * Send Management OT Notification Edge Function
 *
 * Sends push notifications to management users when an OT request is certified by HR.
 * Handles management user identification, subscription filtering, and notification formatting.
 *
 * @endpoint POST /functions/v1/send-management-ot-notification
 * @payload {ManagementOTNotificationPayload} requestId
 * @returns {NotificationResult} success status and notification count
 */ import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
// CORS headers for internal API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
/**
 * Get Supabase service role credentials from environment
 */ function getSupabaseCredentials() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration not found in environment variables');
  }
  return {
    url: supabaseUrl,
    serviceKey: supabaseServiceKey
  };
}
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Only allow POST requests
  if (req.method !== 'POST') {
    const errorResponse = {
      success: false,
      error: 'Method not allowed. Use POST request.'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const startTime = performance.now();
  try {
    // Parse and validate request payload
    const payload = await req.json();
    // Validate required fields
    if (!payload.requestId) {
      const errorResponse = {
        success: false,
        error: 'Missing required field: requestId'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate UUID format for requestId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.requestId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid requestId format. Expected UUID.'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create Supabase client with service role (bypasses RLS)
    const { url, serviceKey } = getSupabaseCredentials();
    const supabase = createClient(url, serviceKey);
    // Send notifications to management users
    const result = await sendManagementNotifications(supabase, payload.requestId);
    const executionTime = performance.now() - startTime;
    console.log(`[ManagementOTNotification] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[ManagementOTNotification] Error after ${executionTime.toFixed(2)}ms:`, error);
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
/**
 * Main logic for sending management notifications
 */ async function sendManagementNotifications(supabase, requestId) {
  console.log(`[ManagementOTNotification] Processing request ${requestId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, ot_date, total_hours, employee_id').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[ManagementOTNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name').eq('id', otRequest.employee_id).single();
  if (employeeError || !employee) {
    console.error('[ManagementOTNotification] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 3. Identify management users with active push subscriptions
  const managementUsers = await identifyManagementUsers(supabase);
  if (managementUsers.length === 0) {
    console.log('[ManagementOTNotification] No management users found with active subscriptions');
    return {
      success: true,
      notificationsSent: 0,
      message: 'No management users with active push subscriptions found'
    };
  }
  console.log(`[ManagementOTNotification] Found ${managementUsers.length} management user(s) with subscriptions`);
  // 4. Send notifications to each management user
  const notificationResults = await Promise.allSettled(managementUsers.map((managementUser)=>sendNotificationToManagementUser(supabase, managementUser, employee, otRequest)));
  // 5. Count successful notifications
  const successCount = notificationResults.filter((r)=>r.status === 'fulfilled').length;
  const failureCount = notificationResults.filter((r)=>r.status === 'rejected').length;
  console.log(`[ManagementOTNotification] Sent ${successCount}/${managementUsers.length} notifications successfully`);
  return {
    success: true,
    notificationsSent: successCount,
    managementUsersNotified: managementUsers.length,
    failures: failureCount,
    message: `Notifications sent to ${successCount} management user(s)`
  };
}
/**
 * Identifies management users with active push subscriptions
 */ async function identifyManagementUsers(supabase) {
  // Get all users with management role
  const { data: managementRoles, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'management');
  if (roleError || !managementRoles || managementRoles.length === 0) {
    console.error('[ManagementOTNotification] Error or no management roles found:', roleError);
    return [];
  }
  const managementUserIds = managementRoles.map((r)=>r.user_id);
  // Filter management users who have active push subscriptions
  const { data: usersWithSubs, error: subError } = await supabase.from('push_subscriptions').select('user_id, profiles!inner(id, full_name)').in('user_id', managementUserIds).eq('is_active', true);
  if (subError || !usersWithSubs) {
    console.error('[ManagementOTNotification] Error fetching management subscriptions:', subError);
    return [];
  }
  // Deduplicate by user_id (a user may have multiple subscriptions/devices)
  const uniqueUsers = new Map();
  usersWithSubs.forEach((record)=>{
    if (!uniqueUsers.has(record.user_id)) {
      uniqueUsers.set(record.user_id, {
        id: record.user_id,
        fullName: record.profiles.full_name
      });
    }
  });
  return Array.from(uniqueUsers.values());
}
/**
 * Sends notification to a single management user
 */ async function sendNotificationToManagementUser(_supabase, managementUser, employee, otRequest) {
  // Format notification content
  const title = `OT Request Ready for Review`;
  const body = `${employee.full_name} - ${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours`;
  const targetUrl = `/management/approve?request=${otRequest.id}`;
  const notificationPayload = {
    user_id: managementUser.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_requests_new',
    data: {
      targetUrl,
      type: 'ot_request_certified',
      requestId: otRequest.id,
      employeeName: employee.full_name
    }
  };
  console.log(`[ManagementOTNotification] Sending to management user ${managementUser.fullName}:`, {
    title,
    targetUrl
  });
  // Call the existing send-push-notification Edge Function
  const { url: supabaseUrl, serviceKey } = getSupabaseCredentials();
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify(notificationPayload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send notification: ${response.status} ${errorText}`);
  }
  const result = await response.json();
  console.log(`[ManagementOTNotification] ✓ Sent to ${managementUser.fullName}:`, result);
}
/**
 * Format date string for display
 */ function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}
