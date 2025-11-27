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

    // Soft delete: Set deleted_at timestamp
    // This is the primary deletion method - marks employee as deleted while preserving historical data
    const { error: softDeleteError } = await supabaseAdmin
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', employeeId)

    if (softDeleteError) {
      throw new Error(`Failed to mark employee as deleted: ${softDeleteError.message}`)
    }

    // Try hard delete in Auth (optional - if auth deletion fails, the soft delete is still in place)
    let wasHardDeleted = false
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employeeId)

    if (!deleteError) {
      // Hard delete from auth succeeded
      wasHardDeleted = true
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Employee deleted successfully',
        wasHardDeleted,
        deletedAt: new Date().toISOString()
      }),
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
