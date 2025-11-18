/**
 * Send Respective Supervisor Confirmed Notification Edge Function
 *
 * Sends notifications to direct supervisors when the respective supervisor
 * confirms an OT request. This allows the direct supervisor to proceed with
 * their final confirmation.
 *
 * @endpoint POST /functions/v1/send-respective-supervisor-confirmed-notification
 * @payload {ConfirmedNotificationPayload} requestId
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
 * Type definitions
 */
interface ConfirmedNotificationPayload {
  requestId: string;
}

interface NotificationResult {
  success: boolean;
  notificationsSent?: number;
  supervisorsNotified?: number;
  failures?: number;
  message?: string;
  error?: string;
  details?: string;
}

interface OTRequest {
  id: string;
  ot_date: string;
  total_hours: number;
  reason: string;
  employee_id: string;
  supervisor_id: string;
  respective_supervisor_id: string;
  respective_supervisor_confirmed_at?: string;
  respective_supervisor_remarks?: string;
  status: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

interface Supervisor {
  id: string;
  full_name: string;
  employee_id: string;
}

/**
 * Get Supabase service role credentials from environment
 * Throws if credentials are not configured
 */
function getSupabaseCredentials(): { url: string; serviceKey: string } {
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
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    const errorResponse: NotificationResult = {
      success: false,
      error: 'Method not allowed. Use POST request.'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const startTime = performance.now();

  try {
    // Parse and validate request payload
    const payload: ConfirmedNotificationPayload = await req.json();

    // Validate required fields
    if (!payload.requestId) {
      const errorResponse: NotificationResult = {
        success: false,
        error: 'Missing required field: requestId'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.requestId)) {
      const errorResponse: NotificationResult = {
        success: false,
        error: 'Invalid UUID format for requestId'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role (bypasses RLS)
    const { url, serviceKey } = getSupabaseCredentials();
    const supabase = createClient(url, serviceKey);

    // Send confirmation notifications
    const result = await sendConfirmationNotifications(
      supabase,
      payload.requestId
    );

    const executionTime = performance.now() - startTime;
    console.log(`[RespectiveSupervisorConfirmed] Completed in ${executionTime.toFixed(2)}ms:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[RespectiveSupervisorConfirmed] Error after ${executionTime.toFixed(2)}ms:`, error);

    const errorResponse: NotificationResult = {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Main logic for sending confirmation notifications
 */
async function sendConfirmationNotifications(
  supabase: any,
  requestId: string
): Promise<NotificationResult> {
  console.log(`[RespectiveSupervisorConfirmed] Processing request ${requestId}`);

  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase
    .from('ot_requests')
    .select('id, ot_date, total_hours, reason, employee_id, supervisor_id, respective_supervisor_id, respective_supervisor_confirmed_at, respective_supervisor_remarks, status')
    .eq('id', requestId)
    .single();

  if (otError || !otRequest) {
    console.error('[RespectiveSupervisorConfirmed] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }

  // 2. Verify the request is in pending_supervisor_confirmation status (after respective supervisor confirmed)
  if (otRequest.status !== 'pending_supervisor_confirmation') {
    console.warn('[RespectiveSupervisorConfirmed] Request is not in pending_supervisor_confirmation status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in pending_supervisor_confirmation status after respective supervisor confirmation',
      message: `Current status: ${otRequest.status}`
    };
  }

  // 3. Verify respective supervisor confirmed
  if (!otRequest.respective_supervisor_confirmed_at) {
    console.warn('[RespectiveSupervisorConfirmed] Request has not been confirmed by respective supervisor:', requestId);
    return {
      success: false,
      error: 'Request has not been confirmed by respective supervisor'
    };
  }

  // 4. Get the direct supervisor
  if (!otRequest.supervisor_id) {
    console.error('[RespectiveSupervisorConfirmed] No supervisor assigned to request:', requestId);
    return {
      success: false,
      error: 'No supervisor assigned to this OT request'
    };
  }

  // 5. Fetch employee details
  const { data: employee, error: employeeError } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('id', otRequest.employee_id)
    .single();

  if (employeeError || !employee) {
    console.error('[RespectiveSupervisorConfirmed] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }

  // 6. Fetch direct supervisor details
  const { data: directSupervisor, error: supervisorError } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('id', otRequest.supervisor_id)
    .single();

  if (supervisorError || !directSupervisor) {
    console.error('[RespectiveSupervisorConfirmed] Failed to fetch direct supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Direct supervisor not found');
  }

  // 7. Fetch respective supervisor details
  let respectiveSupervisor = null;
  if (otRequest.respective_supervisor_id) {
    const { data: respSup } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id')
      .eq('id', otRequest.respective_supervisor_id)
      .single();
    respectiveSupervisor = respSup;
  }

  console.log(`[RespectiveSupervisorConfirmed] Sending confirmation notification to ${directSupervisor.full_name}`);

  // 8. Send notification to direct supervisor
  try {
    await sendNotificationToDirectSupervisor(
      supabase,
      directSupervisor,
      employee,
      respectiveSupervisor,
      otRequest
    );

    console.log(`[RespectiveSupervisorConfirmed] ✓ Notification sent successfully`);

    return {
      success: true,
      notificationsSent: 1,
      supervisorsNotified: 1,
      failures: 0,
      message: `Confirmation notification sent to ${directSupervisor.full_name}`
    };

  } catch (notifError) {
    console.error('[RespectiveSupervisorConfirmed] Failed to send notification:', notifError);

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
 * Sends confirmation notification to direct supervisor using send-push-notification function
 */
async function sendNotificationToDirectSupervisor(
  _supabase: any,
  directSupervisor: Supervisor,
  employee: Employee,
  respectiveSupervisor: Supervisor | null,
  otRequest: OTRequest
): Promise<void> {
  // Format notification content
  const respectiveSupervisorName = respectiveSupervisor?.full_name || 'Respective Supervisor';
  const title = `OT Confirmed by ${respectiveSupervisorName}`;
  const body = `${employee.full_name} - ${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours - Ready for your final confirmation`;

  // Link to confirm the request
  const targetUrl = `/supervisor/verify-ot?request=${otRequest.id}`;

  const notificationPayload = {
    user_id: directSupervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_respective_supervisor_confirmed',
    data: {
      targetUrl,
      type: 'ot_confirmation_approved',
      requestId: otRequest.id,
      employeeName: employee.full_name,
      employeeId: employee.employee_id,
      respectiveSupervisorName,
      otDate: otRequest.ot_date,
      totalHours: otRequest.total_hours,
      remarks: otRequest.respective_supervisor_remarks || ''
    }
  };

  console.log(`[RespectiveSupervisorConfirmed] Sending to ${directSupervisor.full_name}:`, {
    title,
    targetUrl,
    notificationType: 'ot_respective_supervisor_confirmed'
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
  console.log(`[RespectiveSupervisorConfirmed] ✓ Sent to ${directSupervisor.full_name}:`, result);
}

/**
 * Format date string for display
 */
function formatDate(dateString: string): string {
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
