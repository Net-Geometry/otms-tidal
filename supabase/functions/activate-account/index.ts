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
    const { token, password } = await req.json();
    console.log('Activating account with custom token');
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // 1. Validate custom token from activation_tokens table
    const { data: tokenData, error: tokenError } = await supabaseAdmin.from('activation_tokens').select('id, employee_id, status, expires_at').eq('token', token).single();
    if (tokenError || !tokenData) {
      throw new Error('Invalid or expired activation token');
    }
    if (tokenData.status !== 'pending') {
      throw new Error('This activation link has already been used');
    }
    if (new Date(tokenData.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin.from('activation_tokens').update({
        status: 'expired'
      }).eq('id', tokenData.id);
      throw new Error('This activation link has expired');
    }
    // 2. Update user password in auth.users
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(tokenData.employee_id, {
      password: password
    });
    if (updateError) throw updateError;
    console.log('Password updated for user:', tokenData.employee_id);
    // 3. Mark token as completed
    await supabaseAdmin.from('activation_tokens').update({
      status: 'completed',
      used_at: new Date().toISOString()
    }).eq('id', tokenData.id);
    // 4. Update profile status to active
    await supabaseAdmin.from('profiles').update({
      status: 'active'
    }).eq('id', tokenData.employee_id);
    console.log('Account activated successfully');
    return new Response(JSON.stringify({
      success: true,
      message: 'Account activated successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error activating account:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
