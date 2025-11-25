import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      throw new Error('Token and newPassword are required');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
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

    // Find the reset token
    const { data: resetToken, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token.toUpperCase())
      .single();

    if (tokenError || !resetToken) {
      throw new Error('Invalid or expired reset code');
    }

    // Check if token is still valid
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);

    if (resetToken.status !== 'pending') {
      throw new Error('This reset code has already been used or is invalid');
    }

    if (now > expiresAt) {
      // Mark as expired
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ status: 'expired' })
        .eq('id', resetToken.id);
      throw new Error('This reset code has expired');
    }

    // Get employee details - the id column IS the user_id from auth
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', resetToken.employee_id)
      .single();

    if (employeeError || !employee?.id) {
      console.error('Error finding employee:', employeeError);
      throw new Error('Employee not found');
    }

    // Verify that the auth user exists in auth.users table
    const { data: { users }, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    if (authListError || !users) {
      console.error('Error retrieving auth users:', authListError);
      throw new Error('Failed to verify user authentication status');
    }

    const authUserExists = users.some(u => u.id === employee.id);
    if (!authUserExists) {
      console.error('Auth user not found for employee:', employee.id);
      throw new Error('User does not exist in authentication system. Please contact your administrator.');
    }

    // Update the user's password using the id as user_id
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      employee.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password');
    }

    // Update profile status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'active',
        password_change_required: false
      })
      .eq('id', resetToken.employee_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Mark token as used
    const { error: markUsedError } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('id', resetToken.id);

    if (markUsedError) {
      console.error('Error marking token as used:', markUsedError);
      throw markUsedError;
    }

    // Log the action for audit purposes
    await supabaseAdmin
      .from('password_reset_audit')
      .insert({
        employee_id: resetToken.employee_id,
        reset_by_hr_id: resetToken.reset_by_hr_id,
        action: 'reset_used'
      });

    console.log('Password reset completed for employee:', resetToken.employee_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password has been reset successfully'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in use-password-reset-token function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});
