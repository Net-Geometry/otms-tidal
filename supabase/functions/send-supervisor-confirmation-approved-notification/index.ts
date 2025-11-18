/**
 * Send Supervisor Confirmation Approved Notification Edge Function
 *
 * Sends notifications to supervisors when their OT verification has been confirmed
 * by the respective supervisor. This is the final confirmation step in the workflow.
 *
 * @endpoint POST /functions/v1/send-supervisor-confirmation-approved-notification
 * @payload {ApprovedNotificationPayload} requestId
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
interface ApprovedNotificationPayload {
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
  supervisor_id: string;
  respective_supervisor_id: string;
  respective_supervisor_remarks?: string;
  status: string;
}

interface Employee {
  id: string;
  full_name: string;
  department_id: string;
}

interface Supervisor {
  id: string;
  fullName: string;
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
    const payload: ApprovedNotificationPayload = await req.json();

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

    // Send confirmation approved notifications
    const result = await sendConfirmationApprovedNotifications(
      supabase,
      payload.requestId
    );

    const executionTime = performance.now() - startTime;
    console.log(`[SupervisorConfirmationApprovedNotification] Completed in ${executionTime.toFixed(2)}ms:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[SupervisorConfirmationApprovedNotification] Error after ${executionTime.toFixed(2)}ms:`, error);

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
 * Main logic for sending confirmation approved notifications
 */
async function sendConfirmationApprovedNotifications(
  supabase: any,
  requestId: string
): Promise<NotificationResult> {
  console.log(`[SupervisorConfirmationApprovedNotification] Processing request ${requestId}`);

  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase
    .from('ot_requests')
    .select('id, ot_date, total_hours, reason, supervisor_id, respective_supervisor_id, respective_supervisor_remarks, status')
    .eq('id', requestId)
    .single();

  if (otError || !otRequest) {
    console.error('[SupervisorConfirmationApprovedNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }

  // 2. Verify the request is in respective_supervisor_confirmed status
  if (otRequest.status !== 'respective_supervisor_confirmed') {
    console.warn('[SupervisorConfirmationApprovedNotification] Request is not in respective_supervisor_confirmed status:', {
      requestId,
      status: otRequest.status
    });
    return {
      success: false,
      error: 'Request is not in respective_supervisor_confirmed status',
      message: `Current status: ${otRequest.status}`
    };
  }

  // 3. Get the assigned supervisor
  if (!otRequest.supervisor_id) {
    console.error('[SupervisorConfirmationApprovedNotification] No supervisor assigned to request:', requestId);
    return {
      success: false,
      error: 'No supervisor assigned to this OT request'
    };
  }

  // 4. Fetch supervisor details
  const { data: supervisor, error: supervisorError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', otRequest.supervisor_id)
    .single();

  if (supervisorError || !supervisor) {
    console.error('[SupervisorConfirmationApprovedNotification] Failed to fetch supervisor:', {
      supervisorId: otRequest.supervisor_id,
      error: supervisorError?.message || 'Supervisor not found'
    });
    throw new Error('Supervisor not found');
  }

  // 5. Fetch respective supervisor details for context
  let respectiveSupervisor = null;
  if (otRequest.respective_supervisor_id) {
    const { data: respSup } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', otRequest.respective_supervisor_id)
      .single();
    respectiveSupervisor = respSup;
  }

  console.log(`[SupervisorConfirmationApprovedNotification] Sending confirmation approved notification to ${supervisor.full_name}`);

  // 6. Send notification to supervisor
  try {
    await sendNotificationToSupervisor(
      supabase,
      { id: supervisor.id, fullName: supervisor.full_name },
      respectiveSupervisor,
      otRequest
    );

    console.log(`[SupervisorConfirmationApprovedNotification] ✓ Notification sent successfully`);

    return {
      success: true,
      notificationsSent: 1,
      supervisorsNotified: 1,
      failures: 0,
      message: `Confirmation approved notification sent to ${supervisor.full_name}`
    };

  } catch (notifError) {
    console.error('[SupervisorConfirmationApprovedNotification] Failed to send notification:', notifError);

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
 * Sends confirmation approved notification to supervisor using send-push-notification function
 */
async function sendNotificationToSupervisor(
  _supabase: any,
  supervisor: Supervisor,
  respectiveSupervisor: any,
  otRequest: OTRequest
): Promise<void> {
  // Format notification content for confirmation approved
  const title = `OT Confirmation Approved: ${supervisor.fullName}`;
  const reasonPreview = otRequest.reason.length > 50
    ? `${otRequest.reason.substring(0, 50)}...`
    : otRequest.reason;
  const managerName = respectiveSupervisor?.full_name || 'Your Manager';
  const body = `${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours - Confirmed by ${managerName}`;

  // Link to view details
  const targetUrl = `/supervisor/ot-requests?request=${otRequest.id}`;

  const notificationPayload = {
    user_id: supervisor.id,
    title,
    body,
    icon: '/icons/icon-192x192.png',
    notification_type: 'ot_respective_supervisor_confirmed',
    data: {
      targetUrl,
      type: 'ot_confirmation_approved',
      requestId: otRequest.id,
      managerName,
      remarks: otRequest.respective_supervisor_remarks || ''
    }
  };

  console.log(`[SupervisorConfirmationApprovedNotification] Sending to supervisor ${supervisor.fullName}:`, {
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
  console.log(`[SupervisorConfirmationApprovedNotification] ✓ Sent to ${supervisor.fullName}:`, result);
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
