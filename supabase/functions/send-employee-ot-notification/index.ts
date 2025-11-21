/**
 * Send Employee OT Notification Edge Function
 *
 * Sends push notifications to employees when their OT request is approved or rejected.
 * Handles employee targeting, rejection reason formatting, and status-specific messaging.
 *
 * @endpoint POST /functions/v1/send-employee-ot-notification
 * @payload {EmployeeOTNotificationPayload} requestId, notificationType
 * @returns {NotificationResult} success status and notification count
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'
import type {
  EmployeeOTNotificationPayload,
  NotificationResult,
  OTRequestDetails,
  EmployeeProfile,
  ApproverInfo,
  ErrorResponse
} from './types.ts'

// CORS headers for internal API calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Get Supabase service role credentials from environment
 * Throws if credentials are not configured
 */
function getSupabaseCredentials(): { url: string; serviceKey: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration not found in environment variables')
  }

  return { url: supabaseUrl, serviceKey: supabaseServiceKey }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Method not allowed. Use POST request.'
    }
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  const startTime = performance.now()

  try {
    // Parse and validate request payload
    const payload: EmployeeOTNotificationPayload = await req.json()

    // Validate required fields
    if (!payload.requestId || !payload.notificationType) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Missing required fields: requestId, notificationType'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate notification type
    if (payload.notificationType !== 'approved' && payload.notificationType !== 'rejected') {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid notificationType. Expected "approved" or "rejected".'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate UUID format for requestId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(payload.requestId)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Invalid requestId format. Expected UUID.'
      }
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role (bypasses RLS)
    const { url, serviceKey } = getSupabaseCredentials()
    const supabase = createClient(url, serviceKey)

    // Send notification to employee
    const result = await sendEmployeeNotification(
      supabase,
      payload.requestId,
      payload.notificationType
    )

    const executionTime = performance.now() - startTime
    console.log(`[EmployeeOTNotification] Completed in ${executionTime.toFixed(2)}ms:`, result)

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const executionTime = performance.now() - startTime
    console.error(`[EmployeeOTNotification] Error after ${executionTime.toFixed(2)}ms:`, error)

    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Main logic for sending employee notifications
 */
async function sendEmployeeNotification(
  supabase: SupabaseClient,
  requestId: string,
  notificationType: 'approved' | 'rejected'
): Promise<NotificationResult> {
  console.log(`[EmployeeOTNotification] Processing ${notificationType} notification for request ${requestId}`)

  // 1. Fetch OT request details with approver information
  const { data: otRequest, error: otError } = await supabase
    .from('ot_requests')
    .select('id, employee_id, ot_date, total_hours, status, supervisor_id, hr_id, supervisor_remarks, hr_remarks, management_remarks')
    .eq('id', requestId)
    .single()

  if (otError || !otRequest) {
    console.error('[EmployeeOTNotification] Failed to fetch OT request:', {
      requestId,
      error: otError?.message || 'OT request not found'
    })
    throw new Error('OT request not found')
  }

  // 2. Fetch employee details
  const { data: employee, error: employeeError } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('id', otRequest.employee_id)
    .single()

  if (employeeError || !employee) {
    console.error('[EmployeeOTNotification] Failed to fetch employee:', {
      employeeId: otRequest.employee_id,
      error: employeeError?.message || 'Employee not found'
    })
    throw new Error('Employee not found')
  }

  // 3. Check if employee has active push subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', employee.id)
    .eq('is_active', true)

  if (subError) {
    console.error('[EmployeeOTNotification] Error checking push subscriptions:', subError)
    throw new Error('Failed to check push subscriptions')
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[EmployeeOTNotification] No active push subscriptions found for employee')
    return {
      success: true,
      notificationsSent: 0,
      message: 'Employee has no active push subscriptions'
    }
  }

  // 4. Determine approver for notification context
  const approverId = determineApproverId(otRequest)
  let approverName = 'Supervisor' // Default fallback

  if (approverId) {
    const { data: approver, error: approverError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', approverId)
      .single()

    if (!approverError && approver) {
      approverName = approver.full_name
    }
  }

  // 5. Build notification content based on type
  const notificationPayload = buildNotificationPayload(
    otRequest,
    notificationType,
    approverName
  )

  console.log(`[EmployeeOTNotification] Sending ${notificationType} notification to employee ${employee.full_name}`)

  // 6. Send notification via send-push-notification function
  const { url: supabaseUrl, serviceKey } = getSupabaseCredentials()

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-push-notification`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(notificationPayload)
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send notification: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  console.log(`[EmployeeOTNotification] ✓ Sent to ${employee.full_name}:`, result)

  return {
    success: true,
    notificationsSent: result.success || 0,
    message: `Notification sent successfully to ${employee.full_name}`,
    details: JSON.stringify(result)
  }
}

/**
 * Determines the approver ID based on OT request status
 * Priority: HR ID > Supervisor ID
 */
function determineApproverId(otRequest: OTRequestDetails): string | null {
  // HR approval takes precedence
  if (otRequest.hr_id) {
    return otRequest.hr_id
  }

  // Fallback to supervisor
  if (otRequest.supervisor_id) {
    return otRequest.supervisor_id
  }

  return null
}

/**
 * Builds notification payload based on approval/rejection type
 */
function buildNotificationPayload(
  otRequest: OTRequestDetails,
  notificationType: 'approved' | 'rejected',
  approverName: string
): Record<string, unknown> {
  const formattedDate = formatDate(otRequest.ot_date)
  const targetUrl = `/ot/history?request=${otRequest.id}`

  if (notificationType === 'approved') {
    // Approval notification (AC 1-4)
    return {
      user_id: otRequest.employee_id,
      title: 'OT Request Approved',
      body: `${formattedDate} - ${otRequest.total_hours} hours approved by ${approverName}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-approved.svg', // Checkmark icon
      notification_type: 'ot_requests_approved', // For preference filtering
      data: {
        targetUrl,
        type: 'ot_request_approved',
        requestId: otRequest.id,
        supervisorName: approverName
      }
    }
  } else {
    // Rejection notification (AC 5-6)
    const rejectionReason = getRejectionReason(otRequest)
    const bodyText = rejectionReason
      ? `${formattedDate} - ${otRequest.total_hours} hours request rejected: ${rejectionReason}`
      : `${formattedDate} - ${otRequest.total_hours} hours request rejected`

    return {
      user_id: otRequest.employee_id,
      title: 'OT Request Rejected',
      body: bodyText,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-rejected.svg', // X mark icon
      notification_type: 'ot_requests_rejected', // For preference filtering
      data: {
        targetUrl,
        type: 'ot_request_rejected',
        requestId: otRequest.id,
        rejectionReason: rejectionReason || undefined
      }
    }
  }
}

/**
 * Gets rejection reason from remarks fields
 * Priority: management_remarks > hr_remarks > supervisor_remarks
 */
function getRejectionReason(otRequest: OTRequestDetails): string | null {
  // Check remarks in reverse priority order
  if (otRequest.management_remarks) {
    return otRequest.management_remarks
  }

  if (otRequest.hr_remarks) {
    return otRequest.hr_remarks
  }

  if (otRequest.supervisor_remarks) {
    return otRequest.supervisor_remarks
  }

  return null
}

/**
 * Format date string for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return dateString
  }
}
