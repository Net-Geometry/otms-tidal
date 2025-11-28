import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Validate required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing required environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceRoleKey: !!supabaseServiceRoleKey
      });
      return new Response(JSON.stringify({
        success: false,
        message: 'Server configuration error: Missing Supabase credentials'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false
      }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const requestData = await req.json();
    if (requestData.action === 'subscribe') {
      // Subscribe action - register FCM token
      if (!requestData.fcm_token) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Missing FCM token'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const fcmToken = requestData.fcm_token;
      const deviceName = requestData.device_name || `Device ${new Date().toLocaleDateString()}`;
      const deviceType = requestData.device_type || 'web';
      // Validate token format (basic check - FCM tokens are typically 150+ characters)
      if (fcmToken.length < 50) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid FCM token format'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Delete any existing subscription with this token, then insert fresh
      // This avoids complex upsert logic
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('fcm_token', fcmToken);
      // Insert new subscription
      const { data, error } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        fcm_token: fcmToken,
        device_name: deviceName,
        device_type: deviceType,
        is_active: true
      }).select('id').single();
      if (error) {
        console.error('FCM subscription error:', error);
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to save FCM subscription'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'FCM subscription registered',
        subscriptionId: data.id
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (requestData.action === 'unsubscribe') {
      // Unsubscribe action - remove FCM token
      if (!requestData.fcm_token) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Missing FCM token'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('fcm_token', requestData.fcm_token);
      if (error) {
        console.error('FCM subscription delete error:', error);
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to delete FCM subscription'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'FCM subscription removed'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid action (must be subscribe or unsubscribe)'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Edge function error:', {
      message: errorMessage,
      stack: errorStack,
      error
    });
    return new Response(JSON.stringify({
      success: false,
      message: `Internal server error: ${errorMessage}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
