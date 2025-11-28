/**
 * Send Supervisor OT Notification Edge Function
 *
 * Sends push notifications to supervisors when an employee submits an OT request.
 * Handles supervisor identification, subscription filtering, and notification formatting.
 *
 * @endpoint POST /functions/v1/send-supervisor-ot-notification
 * @payload {OTNotificationPayload} requestId, employeeId
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
    // Create Supabase client with service role (bypasses RLS)
    const { url, serviceKey } = getSupabaseCredentials();
    const supabase = createClient(url, serviceKey);
    // Send notifications to supervisors
    const result = await sendSupervisorNotifications(supabase, payload.requestId, payload.employeeId);
    const executionTime = performance.now() - startTime;
    console.log(`[SupervisorOTNotification] Completed in ${executionTime.toFixed(2)}ms:`, result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const executionTime = performance.now() - startTime;
    console.error(`[SupervisorOTNotification] Error after ${executionTime.toFixed(2)}ms:`, error);
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
 * Main logic for sending supervisor notifications
 */ async function sendSupervisorNotifications(supabase, requestId, employeeId) {
  console.log(`[SupervisorOTNotification] Processing request ${requestId} from employee ${employeeId}`);
  // 1. Fetch OT request details
  const { data: otRequest, error: otError } = await supabase.from('ot_requests').select('id, ot_date, total_hours, reason, supervisor_id').eq('id', requestId).single();
  if (otError || !otRequest) {
    console.error('[SupervisorOTNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    });
    throw new Error('OT request not found');
  }
  // 2. Fetch employee details
  const { data: employee, error: employeeError } = await supabase.from('profiles').select('id, full_name, department_id').eq('id', employeeId).single();
  if (employeeError || !employee) {
    console.error('[SupervisorOTNotification] Failed to fetch employee:', {
      employeeId,
      error: employeeError?.message || 'Employee not found'
    });
    throw new Error('Employee not found');
  }
  // 3. Identify supervisors for this employee's department
  const supervisors = await identifySupervisors(supabase, employee.department_id, otRequest.supervisor_id);
  if (supervisors.length === 0) {
    console.log('[SupervisorOTNotification] No supervisors found with active subscriptions');
    return {
      success: true,
      notificationsSent: 0,
      message: 'No supervisors with active push subscriptions found'
    };
  }
  console.log(`[SupervisorOTNotification] Found ${supervisors.length} supervisor(s) with subscriptions`);
  // 4. Send notifications to each supervisor
  const notificationResults = await Promise.allSettled(supervisors.map((supervisor)=>sendNotificationToSupervisor(supabase, supervisor, employee, otRequest)));
  // 5. Count successful notifications
  const successCount = notificationResults.filter((r)=>r.status === 'fulfilled').length;
  const failureCount = notificationResults.filter((r)=>r.status === 'rejected').length;
  console.log(`[SupervisorOTNotification] Sent ${successCount}/${supervisors.length} notifications successfully`);
  return {
    success: true,
    notificationsSent: successCount,
    supervisorsNotified: supervisors.length,
    failures: failureCount,
    message: `Notifications sent to ${successCount} supervisor(s)`
  };
}
/**
 * Identifies supervisors with active push subscriptions
 */ async function identifySupervisors(supabase, departmentId, assignedSupervisorId) {
  // Start with the assigned supervisor if exists
  const supervisorIds = new Set();
  if (assignedSupervisorId) {
    supervisorIds.add(assignedSupervisorId);
  }
  // Also find other supervisors in the same department (if department_id exists)
  if (departmentId) {
    // Query users with supervisor role in the same department
    const { data: supervisorRoles, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'supervisor');
    if (!roleError && supervisorRoles) {
      const supervisorUserIds = supervisorRoles.map((r)=>r.user_id);
      // Get supervisors in the same department
      const { data: departmentSupervisors, error: deptError } = await supabase.from('profiles').select('id').eq('department_id', departmentId).in('id', supervisorUserIds);
      if (!deptError && departmentSupervisors) {
        departmentSupervisors.forEach((s)=>supervisorIds.add(s.id));
      }
    }
  }
  if (supervisorIds.size === 0) {
    return [];
  }
  // Filter supervisors who have active push subscriptions
  const { data: supervisorsWithSubs, error: subError } = await supabase.from('push_subscriptions').select('user_id, profiles!inner(id, full_name)').in('user_id', Array.from(supervisorIds)).eq('is_active', true);
  if (subError || !supervisorsWithSubs) {
    console.error('[SupervisorOTNotification] Error fetching supervisor subscriptions:', subError);
    return [];
  }
  // Deduplicate by user_id (a supervisor may have multiple subscriptions/devices)
  const uniqueSupervisors = new Map();
  supervisorsWithSubs.forEach((record)=>{
    if (!uniqueSupervisors.has(record.user_id)) {
      const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;
      uniqueSupervisors.set(record.user_id, {
        id: record.user_id,
        fullName: profile.full_name
      });
    }
  });
  return Array.from(uniqueSupervisors.values());
}
/**
 * Sends notification to a single supervisor using the send-push-notification function
 */ async function sendNotificationToSupervisor(_supabase, supervisor, employee, otRequest) {
  // Format notification content
  const title = `New OT Request from ${employee.full_name}`;
  const reasonPreview = otRequest.reason.length > 50 ? `${otRequest.reason.substring(0, 50)}...` : otRequest.reason;
  const body = `${formatDate(otRequest.ot_date)} - ${otRequest.total_hours} hours - ${reasonPreview}`;
  const targetUrl = `/supervisor/verify?request=${otRequest.id}`;
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
      employeeName: employee.full_name
    }
  };
  console.log(`[SupervisorOTNotification] Sending to supervisor ${supervisor.fullName}:`, {
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
  console.log(`[SupervisorOTNotification] ✓ Sent to ${supervisor.fullName}:`, result);
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
