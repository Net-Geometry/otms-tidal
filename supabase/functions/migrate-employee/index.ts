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
    const { employee_id, email, password = 'Temp@12345', role = 'employee' } = await req.json();

    if (!employee_id) {
      throw new Error('employee_id is required');
    }

    if (!email) {
      throw new Error('email is required for migration');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    console.log('Migrating employee:', {
      employee_id,
      email,
      role
    });

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

    // STEP 1: Check if profile exists with this employee_id
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('employee_id', employee_id)
      .maybeSingle();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      throw profileCheckError;
    }

    if (!existingProfile) {
      throw new Error(`Profile not found for Employee No ${employee_id}. Please ensure the employee record exists before migrating.`);
    }

    console.log('Found existing profile:', {
      id: existingProfile.id,
      employee_id: existingProfile.employee_id,
      full_name: existingProfile.full_name,
      email: existingProfile.email,
      status: existingProfile.status
    });

    // STEP 2: Check if profile already has a user_id (already migrated)
    if (existingProfile.id) {
      // Check if this auth user actually exists
      const { data: authUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);

      if (!authCheckError && authUser) {
        // Auth user exists, already migrated
        throw new Error(`Employee ${employee_id} is already migrated. Auth user already exists.`);
      }
    }

    // STEP 3: Check if auth user exists with this email
    const { data: authUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
    }

    const existingAuthUser = authUsersData?.users?.find((u) => u.email === email);
    if (existingAuthUser) {
      console.log('Found existing auth user for email:', email, 'ID:', existingAuthUser.id);

      // Check if this auth user has a profile
      const { data: authUserProfile, error: authUserProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, employee_id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();

      if (authUserProfileError && authUserProfileError.code !== 'PGRST116') {
        throw authUserProfileError;
      }

      if (authUserProfile) {
        throw new Error(`Email ${email} is already in use by Employee ${authUserProfile.employee_id}. Please use a different email.`);
      }

      // Orphaned auth user - we can reuse it
      console.log('Found orphaned auth user (no profile), will link to existing profile');
    }

    let authUserId: string;
    let createdNewAuthUser = false;

    // STEP 4: Create or reuse auth user
    if (existingAuthUser && !existingAuthUser.user_metadata?.employee_id) {
      // Use the orphaned auth user
      authUserId = existingAuthUser.id;
      console.log('Using existing auth user:', authUserId);
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: {
          full_name: existingProfile.full_name,
          employee_id
        }
      });

      if (authError) {
        if (authError.message?.includes('already registered') || authError.message?.includes('email_exists')) {
          throw new Error(`Email ${email} is already registered in auth system. Please use a different email.`);
        }
        throw authError;
      }

      authUserId = authData.user.id;
      createdNewAuthUser = true;
      console.log('Auth user created:', authUserId);
    }

    // STEP 5: Update profile to link to auth user
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ id: authUserId })
      .eq('employee_id', employee_id);

    if (profileUpdateError) {
      // If we created a new auth user, clean it up
      if (createdNewAuthUser) {
        console.error('Profile update failed, cleaning up auth user:', profileUpdateError);
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw profileUpdateError;
    }

    console.log('Profile updated with user_id:', authUserId);

    // STEP 6: Create or update user role
    const { data: existingRole, error: roleCheckError } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (roleCheckError && roleCheckError.code !== 'PGRST116') {
      // Clean up if needed
      if (createdNewAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw roleCheckError;
    }

    if (!existingRole) {
      // Create new role assignment
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authUserId,
          role: role
        });

      if (roleError) {
        // Clean up if we created the auth user
        if (createdNewAuthUser) {
          console.error('Role creation failed, cleaning up:', roleError);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        }
        throw roleError;
      }

      console.log('Role assigned:', role);
    } else {
      console.log('Role already exists for this user:', existingRole.role);
    }

    // Success!
    return new Response(
      JSON.stringify({
        success: true,
        message: `Employee ${employee_id} successfully migrated and linked to auth user.`,
        user_id: authUserId,
        employee_id,
        email,
        role,
        auth_user_created: createdNewAuthUser
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error migrating employee:', error);
    let errorMessage = 'Unknown error occurred';

    if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }

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
