/**
 * Send Respective Supervisor Denied Notification Edge Function
 *
 * Sends notifications to both the employee and direct supervisor when
 * the respective supervisor denies an OT request. The employee is notified
 * that they can amend and resubmit, while the supervisor is informed of
 * the denial for their records.
 *
 * Workflow (B): Respective SV denies → Employee notified to amend & resubmit → Direct SV notified of denial
 *
 * @endpoint POST /functions/v1/send-respective-supervisor-denied-notification
 * @payload {DeniedNotificationPayload} requestId
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
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.requestId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid UUID format for requestId'
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
    // Send denial notifications
    const result = await sendDenialNotifications(supabase, payload.requestId);
    const executionTime = performance.now() - startTime;
    console.log(`[RespectiveSupervisorDenied] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[RespectiveSupervisorDenied] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending denial notifications
 */
async function sendDenialNotifications(supabase, requestId) {
  console.log(`[RespectiveSupervisorDenied] Processing request ${requestId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, ot_date, total_hours, reason, employee_id, supervisor_id, respective_supervisor_id, respective_supervisor_denied_at, respective_supervisor_denial_remarks, status').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[RespectiveSupervisorDenied] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Verify the request is in rejected status
  if (otRequest.status !== 'rejected') {
    console.warn('[RespectiveSupervisorDenied] Request is not in rejected status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in rejected status',
      message: `Current status: ${otRequest.status}`
    };
  }
  // 3. Verify respective supervisor denied
  if (!otRequest.respective_supervisor_denied_at || !otRequest.respective_supervisor_denial_remarks) {
    console.warn('[RespectiveSupervisorDenied] Request has not been properly denied by respective supervisor:', requestId);
    return {
      success: false,
      error: 'Request has not been properly denied by respective supervisor'
    };
  }
  // 4. Get the direct supervisor
  if (!otRequest.supervisor_id) {
    console.error('[RespectiveSupervisorDenied] No supervisor assigned to request:', requestId);
    return {
      success: false,
      error: 'No supervisor assigned to this OT request'
    };
  }
  // 5. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.employee_id).single();
  if (employeeError || !employee) {
    console.error('[RespectiveSupervisorDenied] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 6. Fetch direct supervisor details
  const { data: directSupervisor, error: supervisorError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.supervisor_id).single();
  if (supervisorError || !directSupervisor) {
    console.error('[RespectiveSupervisorDenied] Failed to fetch direct supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Direct supervisor not found');
  }
  // 7. Fetch respective supervisor details
  let respectiveSupervisor = null;
  if (otRequest.respective_supervisor_id) {
    const { data: respSup } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.respective_supervisor_id).single();
    respectiveSupervisor = respSup;
  }
  console.log(`[RespectiveSupervisorDenied] Sending denial notifications to employee and supervisor`);
  // 8. Send notifications to both employee and direct supervisor
  let notificationsSent = 0;
  let failures = 0;

  // Send notification to employee to amend and resubmit
  try {
    await sendNotificationToEmployee(supabase, employee, respectiveSupervisor, otRequest);
    console.log(`[RespectiveSupervisorDenied] ✓ Notification sent to employee ${employee.full_name}`);
    notificationsSent++;
  } catch (employeeNotifError) {
    console.error('[RespectiveSupervisorDenied] Failed to send notification to employee:', employeeNotifError);
    failures++;
  }

  // Send notification to direct supervisor
  try {
    await sendNotificationToDirectSupervisor(supabase, directSupervisor, employee, respectiveSupervisor, otRequest);
    console.log(`[RespectiveSupervisorDenied] ✓ Notification sent to supervisor ${directSupervisor.full_name}`);
    notificationsSent++;
  } catch (supervisorNotifError) {
    console.error('[RespectiveSupervisorDenied] Failed to send notification to supervisor:', supervisorNotifError);
    failures++;
  }

  if (notificationsSent === 2) {
    return {
      success: true,
      notificationsSent: 2,
      supervisorsNotified: 1,
      employeesNotified: 1,
      failures: 0,
      message: `Denial notification sent to ${employee.full_name} and ${directSupervisor.full_name}`
    };
  } else if (notificationsSent === 1) {
    return {
      success: true,
      notificationsSent: 1,
      supervisorsNotified: notificationsSent === 2 ? 1 : (failures === 1 ? 1 : 0),
      employeesNotified: notificationsSent === 2 || (notificationsSent === 1 && failures === 1) ? 1 : 0,
      failures: failures,
      message: `Partial notification sent (${notificationsSent} of 2 recipients)`
    };
  } else {
    return {
      success: false,
      notificationsSent: 0,
      supervisorsNotified: 0,
      employeesNotified: 0,
      failures: 2,
      error: 'Failed to send notifications to both recipients'
    };
  }
}

/**
 * Sends denial notification to employee with amend and resubmit instructions
 */
async function sendNotificationToEmployee(_supabase, employee, respectiveSupervisor, otRequest) {
  // Format notification content
  const respectiveSupervisorName = respectiveSupervisor?.full_name || 'Respective Supervisor';
  const title = `OT Request Denied - Please Amend`;
  const body = `Your OT request (Ticket #${otRequest.id.substring(0, 8).toUpperCase()}) for ${formatDate(otRequest.ot_date)} was denied by ${respectiveSupervisorName}.`;
  // Link to amend the request
  const targetUrl = `/employee/amend-ot?request=${otRequest.id}`;
  const notificationPayload = {
    user_id: employee.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_denied_amend_needed',
    data: {
      targetUrl,
      type: 'ot_denied_amend_needed',
      requestId: otRequest.id,
      respectiveSupervisorName,
      otDate: otRequest.ot_date,
      totalHours: otRequest.total_hours,
      denialRemarks: otRequest.respective_supervisor_denial_remarks || ''
    }
  };
  console.log(`[RespectiveSupervisorDenied] Sending to employee ${employee.full_name}:`, {
    title,
    targetUrl,
    notificationType: 'ot_denied_amend_needed'
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
  console.log(`[RespectiveSupervisorDenied] ✓ Sent to employee ${employee.full_name}:`, result);
}

/**
 * Sends denial notification to direct supervisor for their records
 */
async function sendNotificationToDirectSupervisor(_supabase, directSupervisor, employee, respectiveSupervisor, otRequest) {
  // Format notification content
  const respectiveSupervisorName = respectiveSupervisor?.full_name || 'Respective Supervisor';
  const title = `OT Request Denied by ${respectiveSupervisorName}`;
  const body = `${respectiveSupervisorName} denied OT for ${employee.full_name} on ${formatDate(otRequest.ot_date)} (${otRequest.total_hours}h). Employee may amend and resubmit.`;
  // Link for records/reference
  const targetUrl = `/supervisor/verify-ot?request=${otRequest.id}`;
  const notificationPayload = {
    user_id: directSupervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_respective_supervisor_denied',
    data: {
      targetUrl,
      type: 'ot_denial_notification',
      requestId: otRequest.id,
      employeeName: employee.full_name,
      employeeId: employee.employee_id,
      respectiveSupervisorName,
      otDate: otRequest.ot_date,
      totalHours: otRequest.total_hours,
      denialRemarks: otRequest.respective_supervisor_denial_remarks || ''
    }
  };
  console.log(`[RespectiveSupervisorDenied] Sending to supervisor ${directSupervisor.full_name}:`, {
    title,
    targetUrl,
    notificationType: 'ot_respective_supervisor_denied'
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
  console.log(`[RespectiveSupervisorDenied] ✓ Sent to supervisor ${directSupervisor.full_name}:`, result);
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
