import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Get the authorization header to verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has admin or hr role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAdminAccess = roles?.some(r => ['admin', 'hr'].includes(r.role));
    if (!hasAdminAccess) {
      throw new Error('Insufficient permissions. Admin or HR role required.');
    }

    // Get request body
    const { employee_id } = await req.json();

    if (!employee_id) {
      throw new Error('Employee ID is required');
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get employee details
    const { data: employee } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', employee_id)
      .single();

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get the auth user's email directly from auth.users
    const { data: { users }, error: authLookupError } = await supabaseAdmin.auth.admin.listUsers();

    if (authLookupError || !users) {
      throw new Error('Failed to retrieve user information');
    }

    const authUser = users.find(u => u.id === employee_id);
    if (!authUser || !authUser.email) {
      throw new Error('User with this ID not found in authentication system');
    }

    console.log('Admin password reset requested for:', authUser.email, 'by:', user.email);

    // Generate a random reset token (6-8 character alphanumeric code for user-friendly sharing)
    const resetToken = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Calculate expiration time (48 hours from now as per the use-password-reset-token function)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Create a password reset token record
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        employee_id: employee_id,
        token: resetToken,
        reset_by_hr_id: user.id,
        expires_at: expiresAt,
        status: 'pending',
        created_by_role: roles?.[0]?.role || 'admin'
      });

    if (insertError) {
      console.error('Error creating reset token:', insertError);
      throw insertError;
    }

    console.log('Password reset token created for employee:', employee_id);

    // Log the action for audit purposes
    await supabaseAdmin
      .from('role_change_audit')
      .insert({
        user_id: employee_id,
        changed_by: user.id,
        reason: 'Admin initiated password reset',
      });

    return new Response(
      JSON.stringify({
        resetCode: resetToken,
        expiresAt: expiresAt,
        message: 'Password reset code generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-employee-password function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error instanceof Error && error.message.includes('permissions') ? 403 : 400
      }
    );
  }
});
