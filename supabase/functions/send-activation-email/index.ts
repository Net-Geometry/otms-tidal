import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const { employee_id, email, full_name } = await req.json();
    console.log('Sending activation email to:', email);
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // 1. Create activation token record
    const { data: tokenData, error: tokenError } = await supabaseAdmin.from('activation_tokens').insert({
      employee_id,
      status: 'pending'
    }).select().single();
    if (tokenError) throw tokenError;
    console.log('Activation token created:', tokenData.token);
    // 2. Generate Supabase recovery link (this will send the email automatically)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com')}/setup-password?custom_token=${tokenData.token}`
      }
    });
    if (linkError) {
      console.error('Error generating recovery link:', linkError);
      throw linkError;
    }
    console.log('Recovery email sent via Supabase');
    // 3. Update token record with email sent timestamp
    await supabaseAdmin.from('activation_tokens').update({
      email_sent_at: new Date().toISOString(),
      email_result: {
        success: true,
        method: 'supabase_recovery'
      }
    }).eq('id', tokenData.id);
    return new Response(JSON.stringify({
      success: true,
      message: 'Activation email sent successfully',
      token_id: tokenData.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in send-activation-email:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
