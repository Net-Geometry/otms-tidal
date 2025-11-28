import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { user_id, email } = await req.json();
    if (!email) {
      throw new Error('Email is required');
    }
    console.log('Resending invite to:', email);
    // Create Supabase admin client
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Get employee name
    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single();
    // Mark old tokens as expired
    await supabaseAdmin.from('activation_tokens').update({
      status: 'expired'
    }).eq('employee_id', user_id).eq('status', 'pending');
    // Call send-activation-email to generate new token and send email
    const { error: emailError } = await supabaseAdmin.functions.invoke('send-activation-email', {
      body: {
        employee_id: user_id,
        email: email,
        full_name: profile?.full_name || 'Employee'
      }
    });
    if (emailError) throw emailError;
    console.log('New activation email sent successfully');
    return new Response(JSON.stringify({
      success: true,
      message: 'Activation email sent'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in resend-invite function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
