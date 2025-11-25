import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

// TypeScript interfaces
interface FCMSubscriptionRequest {
  action: 'subscribe' | 'unsubscribe';
  fcm_token?: string;
  device_name?: string;
  device_type?: string;
}

interface PushSubscriptionResponse {
  success: boolean;
  message: string;
  subscriptionId?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: {
          persistSession: false,
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const requestData: FCMSubscriptionRequest = await req.json()

    if (requestData.action === 'subscribe') {
      // Subscribe action - register FCM token
      if (!requestData.fcm_token) {
        return new Response(
          JSON.stringify({ success: false, message: 'Missing FCM token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fcmToken = requestData.fcm_token
      const deviceName = requestData.device_name || `Device ${new Date().toLocaleDateString()}`
      const deviceType = requestData.device_type || 'web'

      // Validate token format (basic check - FCM tokens are typically 150+ characters)
      if (fcmToken.length < 50) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid FCM token format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Upsert FCM subscription
      const { data, error } = await supabase
        .from('push_subscriptions_fcm')
        .upsert({
          user_id: user.id,
          fcm_token,
          device_name,
          device_type,
          is_active: true
        }, {
          onConflict: 'user_id,fcm_token'
        })
        .select('id')
        .single()

      if (error) {
        console.error('FCM subscription insert error:', error)
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to save FCM subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'FCM subscription registered',
          subscriptionId: data.id
        } as PushSubscriptionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (requestData.action === 'unsubscribe') {
      // Unsubscribe action - remove FCM token
      if (!requestData.fcm_token) {
        return new Response(
          JSON.stringify({ success: false, message: 'Missing FCM token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabase
        .from('push_subscriptions_fcm')
        .delete()
        .eq('user_id', user.id)
        .eq('fcm_token', requestData.fcm_token)

      if (error) {
        console.error('FCM subscription delete error:', error)
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to delete FCM subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'FCM subscription removed' } as PushSubscriptionResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid action (must be subscribe or unsubscribe)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
