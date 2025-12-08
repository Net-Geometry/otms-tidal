/**
 * Send Supervisor Verified Notification Edge Function
 *
 * Sends notification to HR when the direct supervisor verifies an OT request
 * in the Route B workflow (after respective supervisor confirms). This notifies
 * HR that the request is ready for final certification.
 *
 * Workflow (B): Respective SV confirms → Direct SV verifies → HR notified for certification
 *
 * @endpoint POST /functions/v1/send-supervisor-verified-notification
 * @payload {VerifiedNotificationPayload} requestId
 * @returns {NotificationResult} success status and notification count
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

    // Send verification notifications
    const result = await sendVerificationNotifications(supabase, payload.requestId);

    const executionTime = performance.now() - startTime;
    console.log(`[SupervisorVerified] Completed in ${executionTime.toFixed(2)}ms:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[SupervisorVerified] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending verification notifications
 */
async function sendVerificationNotifications(supabase, requestId) {
  console.log(`[SupervisorVerified] Processing request ${requestId}`);

  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase
    .from('ot_requests')
    .select('id, ticket_number, ot_date, total_hours, reason, employee_id, supervisor_id, supervisor_verified_at, status')
    .eq('id', requestId)
    .single();

  if (otError || !otRequest) {
    console.error('[SupervisorVerified] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }

  // 2. Verify the request is in supervisor_confirmed status
  if (otRequest.status !== 'supervisor_confirmed') {
    console.warn('[SupervisorVerified] Request is not in supervisor_confirmed status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in supervisor_confirmed status',
      message: `Current status: ${otRequest.status}`
    };
  }

  // 3. Verify supervisor verified
  if (!otRequest.supervisor_verified_at) {
    console.warn('[SupervisorVerified] Request has not been verified by supervisor:', requestId);
    return {
      success: false,
      error: 'Request has not been verified by supervisor'
    };
  }

  // 4. Fetch employee details
  const { data: employee, error: employeeError } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('id', otRequest.employee_id)
    .single();

  if (employeeError || !employee) {
    console.error('[SupervisorVerified] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }

  // 5. Fetch direct supervisor details
  const { data: directSupervisor, error: supervisorError } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('id', otRequest.supervisor_id)
    .single();

  if (supervisorError || !directSupervisor) {
    console.error('[SupervisorVerified] Failed to fetch supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Supervisor not found');
  }

  console.log(`[SupervisorVerified] Sending verification notification for request ${otRequest.ticket_number}`);

  // 6. Send notification to HR for certification
  try {
    await sendNotificationToHR(supabase, employee, directSupervisor, otRequest);
    console.log(`[SupervisorVerified] ✓ Notification sent successfully`);
    return {
      success: true,
      notificationsSent: 1,
      hrNotified: 1,
      failures: 0,
      message: `Verification notification sent to HR for Ticket #${otRequest.ticket_number}`
    };
  } catch (notifError) {
    console.error('[SupervisorVerified] Failed to send notification:', notifError);
    return {
      success: false,
      notificationsSent: 0,
      hrNotified: 0,
      failures: 1,
      error: 'Failed to send notification to HR',
      details: notifError instanceof Error ? notifError.message : 'Unknown error'
    };
  }
}

/**
 * Sends verification notification to HR for certification using send-push-notification function
 */
async function sendNotificationToHR(supabase, employee, directSupervisor, otRequest) {
  // Format notification content
  const title = `OT Request Ready for Certification`;
  const body = `${employee.full_name}'s OT for ${formatDate(otRequest.ot_date)} (${otRequest.total_hours}h) verified by ${directSupervisor.full_name}. Ready for certification.`;

  // Link to certify the request
  const targetUrl = `/hr/certify?request=${otRequest.id}`;

  const notificationPayload = {
    // HR users should be identified by their role, but we'll use a generic notification
    // The notification system should route this to all HR users
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_ready_for_certification',
    data: {
      targetUrl,
      type: 'ot_ready_for_certification',
      requestId: otRequest.id,
      ticketNumber: otRequest.ticket_number,
      employeeName: employee.full_name,
      employeeId: employee.employee_id,
      supervisorName: directSupervisor.full_name,
      otDate: otRequest.ot_date,
      totalHours: otRequest.total_hours,
      reason: otRequest.reason
    }
  };

  console.log(`[SupervisorVerified] Sending notification to HR:`, {
    title,
    targetUrl,
    notificationType: 'ot_ready_for_certification',
    ticketNumber: otRequest.ticket_number
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
  console.log(`[SupervisorVerified] ✓ Notification sent to HR:`, result);
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
