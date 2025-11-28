/**
 * Send Employee Confirmation Success Notification Edge Function
 *
 * Sends notifications to employees when their OT request has been confirmed by supervisor.
 * This is triggered after the supervisor confirms the request in the confirmation workflow.
 *
 * @endpoint POST /functions/v1/send-employee-confirmation-notification
 * @payload {ConfirmationNotificationPayload} requestId
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
    // Send confirmation success notification
    const result = await sendConfirmationSuccessNotification(supabase, payload.requestId);
    const executionTime = performance.now() - startTime;
    console.log(`[EmployeeConfirmationNotification] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[EmployeeConfirmationNotification] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending confirmation success notifications
 */ async function sendConfirmationSuccessNotification(supabase, requestId) {
  console.log(`[EmployeeConfirmationNotification] Processing confirmation notification for request ${requestId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, employee_id, ot_date, total_hours, status, supervisor_id, supervisor_confirmation_remarks').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[EmployeeConfirmationNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Verify the request is in supervisor_confirmed status
  if (otRequest.status !== 'supervisor_confirmed') {
    console.warn('[EmployeeConfirmationNotification] Request is not in confirmed status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in supervisor_confirmed status',
      message: `Current status: ${otRequest.status}`
    };
  }
  // 3. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name, employee_id').eq('id', otRequest.employee_id).single();
  if (employeeError || !employee) {
    console.error('[EmployeeConfirmationNotification] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 4. Check if employee has active push subscriptions
  const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('id').eq('user_id', employee.id).eq('is_active', true);
  if (subError) {
    console.error('[EmployeeConfirmationNotification] Error checking push subscriptions:', subError);
    throw new Error('Failed to check push subscriptions');
  }
  if (!subscriptions || subscriptions.length === 0) {
    console.log('[EmployeeConfirmationNotification] No active push subscriptions found for employee');
    return {
      success: true,
      notificationsSent: 0,
      message: 'Employee has no active push subscriptions'
    };
  }
  // 5. Fetch supervisor details for context
  let supervisorName = 'your supervisor'; // Default fallback
  if (otRequest.supervisor_id) {
    const { data: supervisor, error: supervisorError } = await supabase.from('profiles').select('id, full_name').eq('id', otRequest.supervisor_id).single();
    if (!supervisorError && supervisor) {
      supervisorName = supervisor.full_name;
    }
  }
  // 6. Build notification content
  const formattedDate = formatDate(otRequest.ot_date);
  const targetUrl = `/ot/history?request=${otRequest.id}`;
  const title = 'OT Request Confirmed';
  const bodyText = `Your OT request for ${formattedDate} has been confirmed by ${supervisorName}`;
  const notificationPayload = {
    user_id: employee.id,
    title,
    body: bodyText,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-confirmed.svg',
    notification_type: 'ot_supervisor_confirmed',
    data: {
      targetUrl,
      type: 'ot_request_confirmed',
      requestId: otRequest.id,
      supervisorName,
      confirmationRemarks: otRequest.supervisor_confirmation_remarks || undefined
    }
  };
  console.log(`[EmployeeConfirmationNotification] Sending confirmation to employee ${employee.full_name}`);
  // 7. Send notification via send-push-notification function
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
  console.log(`[EmployeeConfirmationNotification] ✓ Sent to ${employee.full_name}:`, result);
  return {
    success: true,
    notificationsSent: 1,
    message: `Confirmation notification sent successfully to ${employee.full_name}`,
    details: JSON.stringify(result)
  };
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
