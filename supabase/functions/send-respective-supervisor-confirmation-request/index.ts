/**
 * Send Respective Supervisor Confirmation Request Notification Edge Function
 *
 * Sends notifications to respective supervisors when a direct supervisor requests
 * confirmation for an OT request. This happens after the direct supervisor verifies
 * the OT and needs the instructing supervisor to confirm.
 *
 * @endpoint POST /functions/v1/send-respective-supervisor-confirmation-request
 * @payload {RequestNotificationPayload} requestId
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
    // Send confirmation request notifications
    const result = await sendConfirmationRequestNotifications(supabase, payload.requestId);
    const executionTime = performance.now() - startTime;
    console.log(`[RespectiveSupervisorConfirmationRequest] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[RespectiveSupervisorConfirmationRequest] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 */ async function sendConfirmationRequestNotifications(supabase, requestId) {
  console.log(`[RespectiveSupervisorConfirmationRequest] Processing request ${requestId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, ot_date, total_hours, reason, employee_id, supervisor_id, respective_supervisor_id, supervisor_remarks, status').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[RespectiveSupervisorConfirmationRequest] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Verify the request is in pending_respective_supervisor_confirmation status
  if (otRequest.status !== 'pending_respective_supervisor_confirmation') {
    console.warn('[RespectiveSupervisorConfirmationRequest] Request is not in pending_respective_supervisor_confirmation status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in pending_respective_supervisor_confirmation status',
      message: `Current status: ${otRequest.status}`
    };
  }
  // 3. Verify respective supervisor is assigned
  if (!otRequest.respective_supervisor_id) {
    console.error('[RespectiveSupervisorConfirmationRequest] No respective supervisor assigned to request:', requestId);
    return {
      success: false,
      error: 'No respective supervisor assigned to this OT request'
    };
  }
  // 4. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.employee_id).single();
  if (employeeError || !employee) {
    console.error('[RespectiveSupervisorConfirmationRequest] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 5. Fetch direct supervisor details
  const { data: directSupervisor, error: supervisorError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.supervisor_id).single();
  if (supervisorError || !directSupervisor) {
    console.error('[RespectiveSupervisorConfirmationRequest] Failed to fetch direct supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Direct supervisor not found');
  }
  // 6. Fetch respective supervisor details
  const { data: respectiveSupervisor, error: respectiveSupervisorError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.respective_supervisor_id).single();
  if (respectiveSupervisorError || !respectiveSupervisor) {
    console.error('[RespectiveSupervisorConfirmationRequest] Failed to fetch respective supervisor:', {
      respectiveSupervisorId: otRequest.respective_supervisor_id,
      error: respectiveSupervisorError?.message || 'Respective supervisor not found'
    });
    throw new Error('Respective supervisor not found');
  }
  console.log(`[RespectiveSupervisorConfirmationRequest] Sending confirmation request to ${respectiveSupervisor.full_name}`);
  // 7. Send notification to respective supervisor
  try {
    await sendNotificationToRespectiveSupervisor(supabase, respectiveSupervisor, employee, directSupervisor, otRequest);
    console.log(`[RespectiveSupervisorConfirmationRequest] ✓ Notification sent successfully`);
    return {
      success: true,
      notificationsSent: 1,
      supervisorsNotified: 1,
      failures: 0,
      message: `Confirmation request sent to ${respectiveSupervisor.full_name}`
    };
  } catch (notifError) {
    console.error('[RespectiveSupervisorConfirmationRequest] Failed to send notification:', notifError);
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
 * Sends confirmation request notification to respective supervisor using send-push-notification function
 */ async function sendNotificationToRespectiveSupervisor(_supabase, respectiveSupervisor, employee, directSupervisor, otRequest) {
  // Format notification content
  const title = `OT Confirmation Needed: ${employee.full_name}`;
  const body = `${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours - Requested by ${directSupervisor.full_name}`;
  // Link to verify/confirm the request
  const targetUrl = `/supervisor/verify-ot?request=${otRequest.id}`;
  const notificationPayload = {
    user_id: respectiveSupervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_request_respective_supervisor_confirmation',
    data: {
      targetUrl,
      type: 'ot_confirmation_request',
      requestId: otRequest.id,
      employeeName: employee.full_name,
      employeeId: employee.employee_id,
      directSupervisorName: directSupervisor.full_name,
      otDate: otRequest.ot_date,
      totalHours: otRequest.total_hours,
      reason: otRequest.reason,
      supervisorRemarks: otRequest.supervisor_remarks || ''
    }
  };
  console.log(`[RespectiveSupervisorConfirmationRequest] Sending to ${respectiveSupervisor.full_name}:`, {
    title,
    targetUrl,
    notificationType: 'ot_request_respective_supervisor_confirmation'
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
  console.log(`[RespectiveSupervisorConfirmationRequest] ✓ Sent to ${respectiveSupervisor.full_name}:`, result);
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
