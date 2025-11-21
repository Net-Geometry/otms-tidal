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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

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
      console.error('Missing or malformed Authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const hasPermission = roles?.some(r => r.role === 'hr' || r.role === 'admin')
    
    if (!hasPermission) {
      console.error('Permission denied for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
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
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting employee:', employeeId)

    // Pre-cleanup: remove references that could block deletion
    try {
      // Remove roles (will also log via trigger)
      const { error: urErr } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', employeeId)
      if (urErr) console.warn('Pre-cleanup user_roles failed:', urErr)

      // Remove push subscriptions
      const { error: psErr } = await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', employeeId)
      if (psErr) console.warn('Pre-cleanup push_subscriptions failed:', psErr)

      // Detach as supervisor in profiles and requests
      const { error: profDetachErr } = await supabaseAdmin
        .from('profiles')
        .update({ supervisor_id: null })
        .eq('supervisor_id', employeeId)
      if (profDetachErr) console.warn('Pre-cleanup profiles(supervisor_id) failed:', profDetachErr)

      const { error: reqDetachErr } = await supabaseAdmin
        .from('ot_requests')
        .update({ supervisor_id: null })
        .eq('supervisor_id', employeeId)
      if (reqDetachErr) console.warn('Pre-cleanup ot_requests(supervisor_id) failed:', reqDetachErr)
    } catch (pcErr) {
      console.warn('Pre-cleanup step error (non-fatal):', pcErr)
    }

    // Try hard delete in Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employeeId)

    if (deleteError) {
      console.error('Delete error:', deleteError)

      // Fallback: Soft-deactivate the user so the UI can proceed without 500s
      console.log('Falling back to soft delete (deactivate user)')
      try {
        // Mark profile inactive
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .update({ status: 'inactive' })
          .eq('id', employeeId)
        if (profErr) console.warn('Soft delete: update profile status failed:', profErr)

        // Ensure no roles remain
        const { error: rolesErr } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', employeeId)
        if (rolesErr) console.warn('Soft delete: remove roles failed:', rolesErr)

        return new Response(
          JSON.stringify({ message: 'Employee deactivated successfully', wasDeactivated: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (softErr) {
        console.error('Soft delete failed:', softErr)
        throw deleteError
      }
    }

    console.log('Employee deleted successfully:', employeeId)
    return new Response(
      JSON.stringify({ message: 'Employee deleted successfully', wasDeactivated: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error deleting employee:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
