/**
 * Send Supervisor Confirmation Request Notification Edge Function
 *
 * Sends notifications to supervisors when their verified OT requests need confirmation.
 * This is the second step in the workflow after initial verification.
 *
 * @endpoint POST /functions/v1/send-supervisor-confirmation-notification
 * @payload {ConfirmationNotificationPayload} requestId, employeeId
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
 * Throws if credentials are not configured
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
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.requestId) || !uuidRegex.test(payload.employeeId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid UUID format for requestId or employeeId'
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
    // Send confirmation request notifications
    const result = await sendConfirmationNotifications(supabase, payload.requestId, payload.employeeId);
    const executionTime = performance.now() - startTime;
    console.log(`[SupervisorConfirmationNotification] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[SupervisorConfirmationNotification] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending confirmation request notifications
 */ async function sendConfirmationNotifications(supabase, requestId, employeeId) {
  console.log(`[SupervisorConfirmationNotification] Processing request ${requestId} from employee ${employeeId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, ot_date, total_hours, reason, supervisor_id, status').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[SupervisorConfirmationNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Verify the request is in pending_supervisor_confirmation status
  if (otRequest.status !== 'pending_supervisor_confirmation') {
    console.warn('[SupervisorConfirmationNotification] Request is not in pending_confirmation status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in pending_supervisor_confirmation status',
      message: `Current status: ${otRequest.status}`
    };
  }
  // 3. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name, department_id').eq('id', employeeId).single();
  if (employeeError || !employee) {
    console.error('[SupervisorConfirmationNotification] Failed to fetch employee:', {
      employeeId,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 4. Get the assigned supervisor
  if (!otRequest.supervisor_id) {
    console.error('[SupervisorConfirmationNotification] No supervisor assigned to request:', requestId);
    return {
      success: false,
      error: 'No supervisor assigned to this OT request'
    };
  }
  // 5. Fetch supervisor details
  const { data: supervisor, error: supervisorError } = await supabase.from('profiles').select('id, full_name').eq('id', otRequest.supervisor_id).single();
  if (supervisorError || !supervisor) {
    console.error('[SupervisorConfirmationNotification] Failed to fetch supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Supervisor not found');
  }
  console.log(`[SupervisorConfirmationNotification] Sending confirmation request to ${supervisor.full_name}`);
  // 6. Send notification to supervisor
  try {
    await sendNotificationToSupervisor(supabase, {
      id: supervisor.id,
      fullName: supervisor.full_name
    }, employee, otRequest);
    console.log(`[SupervisorConfirmationNotification] ✓ Notification sent successfully`);
    return {
      success: true,
      notificationsSent: 1,
      supervisorsNotified: 1,
      failures: 0,
      message: `Confirmation request notification sent to ${supervisor.full_name}`
    };
  } catch (notifError) {
    console.error('[SupervisorConfirmationNotification] Failed to send notification:', notifError);
    return {
      success: false,
      notificationsSent: 0,
      supervisorsNotified: 0,
      failures: 1,
      error: 'Failed to send notification',
      details: notifError instanceof Error ? notifError.message : 'Unknown error'
    };
  }
}
/**
 * Sends confirmation request notification to supervisor using send-push-notification function
 */ async function sendNotificationToSupervisor(_supabase, supervisor, employee, otRequest) {
  // Format notification content for confirmation request
  const title = `Confirmation Required: ${employee.full_name}'s OT Request`;
  const reasonPreview = otRequest.reason.length > 50 ? `${otRequest.reason.substring(0, 50)}...` : otRequest.reason;
  const body = `${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours - ${reasonPreview}`;
  // Link to confirmation dialog/page
  const targetUrl = `/supervisor/confirm?request=${otRequest.id}`;
  const notificationPayload = {
    user_id: supervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_pending_confirmation',
    data: {
      targetUrl,
      type: 'ot_confirmation_required',
      requestId: otRequest.id,
      employeeName: employee.full_name
    }
  };
  console.log(`[SupervisorConfirmationNotification] Sending to supervisor ${supervisor.fullName}:`, {
    title,
    targetUrl,
    notificationType: 'ot_pending_confirmation'
  });
  // Call the send-push-notification Edge Function
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
  console.log(`[SupervisorConfirmationNotification] ✓ Sent to ${supervisor.fullName}:`, result);
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
