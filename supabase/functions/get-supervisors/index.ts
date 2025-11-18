import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body to get employeeId
    let employeeId: string | undefined;

    try {
      const body = await req.json();
      employeeId = body.employeeId as string | undefined;
    } catch (parseError) {
      // If JSON parsing fails, continue without employeeId
      console.warn('Failed to parse request body:', parseError);
    }

    // Create a Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // If employeeId is provided, fetch the employee's direct supervisor
    let directSupervisorId: string | null = null;
    if (employeeId) {
      const { data: employee, error: employeeError } = await supabaseAdmin
        .from('profiles')
        .select('supervisor_id')
        .eq('employee_id', employeeId)
        .single();

      if (employeeError && employeeError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is acceptable
        throw new Error(`Failed to fetch employee: ${employeeError.message}`);
      }

      directSupervisorId = employee?.supervisor_id || null;
    }

    // Fetch all active profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_id')
      .eq('status', 'active');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ supervisors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
    }

    // Filter to only include users with supervisor role and exclude direct supervisor
    const supervisors = profiles
      .filter((profile) => {
        // Skip the direct supervisor if provided
        if (directSupervisorId && profile.id === directSupervisorId) {
          return false;
        }

        const userRoles = roles?.filter((r) => r.user_id === profile.id);
        return userRoles?.some((ur) => ur.role === 'supervisor');
      })
      .map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        employee_id: profile.employee_id,
      }));

    return new Response(
      JSON.stringify({ supervisors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
