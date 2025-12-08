/**
 * Send Supervisor OT Notification Edge Function - v2
 *
 * Sends notifications to supervisors when an employee submits an OT request.
 * Uses dual-channel delivery:
 * 1. Primary: FCM push notification (for users with active devices)
 * 2. Fallback: In-app notification (for users without FCM subscriptions)
 *
 * Routes notification based on workflow:
 * - Route B: If respectiveSupervisorId provided → notifies respective supervisor
 * - Route A: Otherwise → notifies direct supervisor
 *
 * @endpoint POST /functions/v1/send-supervisor-ot-notification
 * @payload {OTNotificationPayload} requestId, employeeId, respectiveSupervisorId (optional)
 * @returns {NotificationResult} success status, notification methods used, and details
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

// CORS headers for internal API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Get Supabase service role credentials from environment
 * Throws if credentials are not configured
 */
function getSupabaseCredentials() {
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

Deno.serve(async (req) => {
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
    if (!payload.requestId || !payload.employeeId) {
      const errorResponse = {
        success: false,
        error: 'Missing required fields: requestId, employeeId'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Validate UUID format for requestId and employeeId
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

    if (!uuidRegex.test(payload.employeeId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid employeeId format. Expected UUID.'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Validate respectiveSupervisorId if provided
    if (payload.respectiveSupervisorId && !uuidRegex.test(payload.respectiveSupervisorId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid respectiveSupervisorId format. Expected UUID.'
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

    // Send notifications to supervisors
    const result = await sendSupervisorNotifications(supabase, payload.requestId, payload.employeeId, payload.respectiveSupervisorId);

    const executionTime = performance.now() - startTime;
    console.log(`[SupervisorOTNotification-v2] Completed in ${executionTime.toFixed(2)}ms:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[SupervisorOTNotification-v2] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending supervisor notifications with dual-channel delivery
 */
async function sendSupervisorNotifications(supabase, requestId, employeeId, respectiveSupervisorId) {
  console.log(`[SupervisorOTNotification-v2] Processing request ${requestId} from employee ${employeeId}${respectiveSupervisorId ? ` with respective supervisor ${respectiveSupervisorId}` : ''}`);

  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase
    .from('ot_requests')
    .select('id, ot_date, total_hours, reason, supervisor_id, respective_supervisor_id, ticket_number')
    .eq('id', requestId)
    .single();

  if (otError || !otRequest) {
    console.error('[SupervisorOTNotification-v2] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }

  // 2. Fetch employee details
  const { data: employee, error: employeeError } = await supabase
    .from('profiles')
    .select('id, full_name, department_id')
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) {
    console.error('[SupervisorOTNotification-v2] Failed to fetch employee:', {
      employeeId,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }

  // 3. Determine which supervisor(s) to notify based on workflow
  // Route B: If respectiveSupervisorId provided → notifies BOTH respective AND direct supervisors
  //   - Respective supervisor: "OT Request Requires Your Confirmation"
  //   - Direct supervisor: "OT Request Awaiting Confirmation" (for awareness)
  // Route A: Otherwise → notifies direct supervisor only
  const respectiveSvId = respectiveSupervisorId || otRequest.respective_supervisor_id;
  const directSvId = otRequest.supervisor_id;

  const supervisorIds = [];
  if (respectiveSvId) {
    // Route B: notify both supervisors
    supervisorIds.push(respectiveSvId);
    if (directSvId && directSvId !== respectiveSvId) {
      supervisorIds.push(directSvId);
    }
  } else if (directSvId) {
    // Route A: notify direct supervisor only
    supervisorIds.push(directSvId);
  }

  // Get supervisor details
  const { data: supervisorDetails, error: supervisorError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', supervisorIds);

  if (supervisorError) {
    console.error('[SupervisorOTNotification-v2] Failed to fetch supervisor details:', supervisorError);
    throw new Error('Failed to fetch supervisor details');
  }

  if (!supervisorDetails || supervisorDetails.length === 0) {
    console.log('[SupervisorOTNotification-v2] No supervisors found for notification');
    return {
      success: true,
      notificationsSent: 0,
      message: 'No supervisors found'
    };
  }

  // 4. Send notifications with dual-channel delivery (FCM + Database)
  const notificationResults = await Promise.allSettled(
    supervisorDetails.map((supervisor) => {
      const isRespectiveSupervisor = supervisor.id === respectiveSvId;
      return sendNotificationToSupervisor(supabase, supervisor, employee, otRequest, isRespectiveSupervisor);
    })
  );

  // 5. Summarize results
  const successResults = notificationResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<any>).value);

  const failureCount = notificationResults.filter((r) => r.status === 'rejected').length;

  // Count delivery methods
  // Note: all notifications have database entry (in_app), some also have FCM
  const fcmCount = successResults.filter((r) => r.notificationMethod === 'both').length;
  const inAppCount = successResults.length; // All successful notifications have database entry

  console.log(`[SupervisorOTNotification-v2] Delivery summary: FCM+DB (${fcmCount}), DB Only (${inAppCount - fcmCount}), Failures=${failureCount}`);

  return {
    success: true,
    notificationsSent: successResults.length,
    supervisorsNotified: supervisorDetails.length,
    failures: failureCount,
    deliveryMethods: {
      database_and_fcm: fcmCount,
      database_only: inAppCount - fcmCount
    },
    message: `Notifications sent to ${inAppCount} supervisor(s): ${fcmCount} with FCM push + ${inAppCount - fcmCount} database only`
  };
}

/**
 * Sends notification to a single supervisor with dual-channel delivery
 * Always inserts into database for audit trail + sends FCM if token available
 */
async function sendNotificationToSupervisor(supabase, supervisor, employee, otRequest, isRespectiveSupervisor) {
  console.log(`[SupervisorOTNotification-v2] Notifying ${supervisor.full_name} (${isRespectiveSupervisor ? 'respective' : 'direct'} supervisor)...`);

  // Format notification content based on supervisor type
  const reasonPreview = otRequest.reason.length > 50 ? `${otRequest.reason.substring(0, 50)}...` : otRequest.reason;
  const dateStr = `${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours`;

  let title, body, targetUrl;
  if (isRespectiveSupervisor) {
    // Respective supervisor needs to CONFIRM the OT request
    title = `OT Request Requires Your Confirmation`;
    body = `${employee.full_name} - ${dateStr} - ${reasonPreview}`;
    targetUrl = `/supervisor/verify?request=${otRequest.id}`;
  } else {
    // Direct supervisor is notified for transparency (pending respective supervisor)
    title = `OT Request Awaiting Confirmation`;
    body = `${employee.full_name} - ${dateStr} - Pending respective supervisor confirmation`;
    targetUrl = `/supervisor/verify?request=${otRequest.id}`;
  }

  // Step 1: Always insert into notifications table (audit trail + backup delivery)
  try {
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: supervisor.id,
        title,
        message: body,
        link: targetUrl,
        notification_type: 'ot_requests_new',
        is_read: false
      });

    if (notifError) {
      console.error(`[SupervisorOTNotification-v2] Failed to create database notification for ${supervisor.full_name}:`, notifError);
      throw new Error(`Database notification failed: ${notifError.message}`);
    }

    console.log(`[SupervisorOTNotification-v2] ✓ Database notification created for ${supervisor.full_name}`);
  } catch (error) {
    console.error(`[SupervisorOTNotification-v2] Failed to insert into notifications table:`, error);
    throw error;
  }

  // Step 2: Check if supervisor has active FCM subscriptions and send push if available
  let fcmSent = false;
  try {
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('user_id', supervisor.id)
      .eq('is_active', true);

    if (subError) {
      console.warn(`[SupervisorOTNotification-v2] Error checking FCM subscriptions for ${supervisor.full_name}:`, subError);
    } else if (subscriptions && subscriptions.length > 0) {
      try {
        await sendFcmNotification(supervisor, title, body, targetUrl, otRequest, employee);
        console.log(`[SupervisorOTNotification-v2] ✓ FCM push sent to ${supervisor.full_name}`);
        fcmSent = true;
      } catch (fcmError) {
        console.warn(`[SupervisorOTNotification-v2] FCM push failed for ${supervisor.full_name}:`, fcmError);
        // Continue - database notification was already sent
      }
    } else {
      console.log(`[SupervisorOTNotification-v2] No active FCM subscription for ${supervisor.full_name}`);
    }
  } catch (error) {
    console.warn(`[SupervisorOTNotification-v2] Error attempting FCM for ${supervisor.full_name}:`, error);
    // Continue - database notification was already sent
  }

  return {
    supervisorId: supervisor.id,
    supervisorName: supervisor.full_name,
    notificationMethod: fcmSent ? 'both' : 'in_app'
  };
}

/**
 * Sends FCM push notification via the send-push-notification edge function
 */
async function sendFcmNotification(supervisor, title, body, targetUrl, otRequest, employee) {
  const notificationPayload = {
    user_id: supervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_requests_new',
    data: {
      targetUrl,
      type: 'ot_request_submitted',
      requestId: otRequest.id,
      employeeName: employee.full_name,
      ticketNumber: otRequest.ticket_number
    }
  };

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
    throw new Error(`FCM notification failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Format date string for display
 */
function formatDate(dateString) {
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
