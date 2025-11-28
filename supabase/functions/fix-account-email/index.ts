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
    const { user_id, new_email } = await req.json();
    if (!user_id || !new_email) {
      throw new Error('user_id and new_email are required');
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      throw new Error('Invalid email format');
    }
    console.log(`Fixing account email for user: ${user_id} -> ${new_email}`);
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Update the auth user email
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: new_email
    });
    if (updateError) {
      console.error('Failed to update auth user email:', updateError);
      throw updateError;
    }
    console.log(`Successfully updated auth user email to: ${new_email}`);
    return new Response(JSON.stringify({
      success: true,
      message: `Account email updated successfully to: ${new_email}`,
      user_id,
      new_email,
      note: 'Profile email was already updated in previous migration'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fixing account email:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
