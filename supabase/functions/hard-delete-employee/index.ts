import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    const token = match?.[1]

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has ADMIN role ONLY (not HR)
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isAdmin = roles?.some(r => r.role === 'admin')

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required for permanent deletion' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { employeeId } = await req.json()

    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: 'Employee ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (employeeId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot permanently delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pre-cleanup: Delete all related OT requests (foreign key constraints)
    try {
      const { error: otReqErr } = await supabaseAdmin
        .from('ot_requests')
        .delete()
        .or(`employee_id.eq.${employeeId},supervisor_id.eq.${employeeId},respective_supervisor_id.eq.${employeeId},hr_id.eq.${employeeId}`)
      if (otReqErr) console.warn('Pre-cleanup ot_requests failed:', otReqErr)
    } catch (pcErr) {
      console.warn('Pre-cleanup ot_requests error (non-fatal):', pcErr)
    }

    // Hard delete: Remove from profiles table
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', employeeId)

    if (deleteError) {
      throw new Error(`Failed to permanently delete employee: ${deleteError.message}`)
    }

    // Hard delete from auth as well
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(employeeId)
    // Don't throw if auth deletion fails - the main deletion already succeeded

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Employee permanently deleted',
        authDeleteSucceeded: !authDeleteError
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
