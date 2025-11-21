import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      full_name, 
      employee_id,
      ic_no,
      phone_no,
      position,
      position_id,
      company_id,
      department_id, 
      basic_salary,
      epf_no,
      socso_no,
      income_tax_no,
      employment_type,
      joining_date,
      work_location,
      supervisor_id,
      role = 'employee',
      designation,
      state,
      is_ot_eligible = true
    } = await req.json();

    // Generate placeholder email if not provided
    const effectiveEmail = email && email.trim() !== '' 
      ? email 
      : `${employee_id}@internal.company`;

    console.log('Inviting employee:', { 
      email: effectiveEmail, 
      providedEmail: email,
      full_name, 
      employee_id, 
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

    // Create auth user with temporary default password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: effectiveEmail,
      email_confirm: true,
      password: 'Temp@12345',
      user_metadata: {
        full_name,
        employee_id,
      }
    });

    if (authError) throw authError;

    console.log('Auth user created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        employee_id,
        full_name,
        email: email || effectiveEmail,
        ic_no,
        phone_no,
        position,
        position_id,
        company_id,
        department_id,
        basic_salary,
        epf_no,
        socso_no,
        income_tax_no,
        employment_type,
        joining_date,
        work_location,
        supervisor_id,
        designation,
        state,
        is_ot_eligible,
        status: 'pending_setup',
      });

    if (profileError) throw profileError;

    console.log('Profile created');

    // Create user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
      });

    if (roleError) throw roleError;

    console.log('Role assigned');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee added. They can log in using Employee ID with temporary password: Temp@12345',
        user_id: authData.user.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error inviting employee:', error);
    
    let errorMessage = 'Unknown error occurred';
    
    // Check for duplicate email (auth error)
    if (error?.message?.includes('already registered')) {
      errorMessage = 'This email address is already registered';
    }
    // Check for duplicate employee_id (unique constraint violation)
    else if (error?.code === '23505' && error?.message?.includes('employee_id')) {
      errorMessage = 'Employee No already exists. Please use a unique Employee No.';
    }
    // Check for other database constraints
    else if (error?.code === '23505') {
      errorMessage = 'A record with this information already exists';
    }
    // Use the error message if available
    else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});