/**
 * Submit OT Request Edge Function
 *
 * Handles OT request submission with proper status assignment based on workflow route.
 * Route A: Direct supervisor verification
 * Route B: Respective supervisor confirmation first
 *
 * @endpoint POST /functions/v1/submit-ot-request
 * @payload {OTSubmissionPayload} ot_date, ot_location_state, start_time, end_time, total_hours, day_type, reason, respective_supervisor_id, attachment_urls
 * @returns {OTRequest} Created OT request with ticket number
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getSupabaseCredentials() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration not found');
  }
  return { url: supabaseUrl, serviceKey: supabaseServiceKey };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { url, serviceKey } = getSupabaseCredentials();
    const supabase = createClient(url, serviceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const payload = await req.json();

    // Determine initial status based on workflow route
    // Route A (no respective SV): pending_verification
    // Route B (with respective SV): pending_respective_supervisor_confirmation
    const initialStatus = payload.respective_supervisor_id
      ? 'pending_respective_supervisor_confirmation'
      : 'pending_verification';

    // Generate ticket number
    const dateStr = new Date(payload.ot_date).toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketNumber = `OT-${dateStr}-${randomSuffix}`;

    // Get employee profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('supervisor_id, is_ot_eligible')
      .eq('id', user.id)
      .limit(1)
      .single();

    if (profileError || !profile) {
      throw new Error('Employee profile not found');
    }

    if (!profile.is_ot_eligible) {
      throw new Error('You are not eligible to submit OT requests');
    }

    // Insert OT request
    const { data: otRequest, error: insertError } = await supabase
      .from('ot_requests')
      .insert([{
        ticket_number: ticketNumber,
        employee_id: user.id,
        supervisor_id: profile.supervisor_id || null,
        ot_date: payload.ot_date,
        ot_location_state: payload.ot_location_state,
        start_time: payload.start_time,
        end_time: payload.end_time,
        total_hours: payload.total_hours,
        day_type: payload.day_type,
        reason: payload.reason,
        respective_supervisor_id: payload.respective_supervisor_id || null,
        attachment_urls: payload.attachment_urls || [],
        status: initialStatus,
      }])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, data: otRequest }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OT Submission Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
