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
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('Creating test users...');
    // Create departments first
    const { data: deptData, error: deptError } = await supabaseAdmin.from('departments').upsert([
      {
        code: 'IT',
        name: 'Information Technology'
      },
      {
        code: 'HR',
        name: 'Human Resources'
      },
      {
        code: 'OPS',
        name: 'Operations'
      }
    ], {
      onConflict: 'code'
    }).select();
    if (deptError) throw deptError;
    console.log('Departments created:', deptData);
    const itDept = deptData.find((d)=>d.code === 'IT');
    const hrDept = deptData.find((d)=>d.code === 'HR');
    const opsDept = deptData.find((d)=>d.code === 'OPS');
    const users = [
      {
        email: 'hr@test.com',
        password: 'password123',
        full_name: 'HR Manager',
        employee_id: 'HR001',
        role: 'hr',
        department: hrDept,
        basic_salary: 5000
      },
      {
        email: 'supervisor@test.com',
        password: 'password123',
        full_name: 'Supervisor One',
        employee_id: 'SUP001',
        role: 'supervisor',
        department: itDept,
        basic_salary: 4500
      },
      {
        email: 'bod@test.com',
        password: 'password123',
        full_name: 'BOD Member',
        employee_id: 'BOD001',
        role: 'bod',
        department: hrDept,
        basic_salary: 8000
      },
      {
        email: 'admin@test.com',
        password: 'password123',
        full_name: 'System Admin',
        employee_id: 'ADM001',
        role: 'admin',
        department: itDept,
        basic_salary: 6000
      },
      {
        email: 'employee1@test.com',
        password: 'password123',
        full_name: 'Employee One',
        employee_id: 'EMP001',
        role: 'employee',
        department: itDept,
        basic_salary: 3000
      },
      {
        email: 'employee2@test.com',
        password: 'password123',
        full_name: 'Employee Two',
        employee_id: 'EMP002',
        role: 'employee',
        department: opsDept,
        basic_salary: 3500
      },
      {
        email: 'employee3@test.com',
        password: 'password123',
        full_name: 'Employee Three',
        employee_id: 'EMP003',
        role: 'employee',
        department: itDept,
        basic_salary: 2800
      }
    ];
    const results = [];
    for (const user of users){
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });
      if (authError) {
        console.error(`Error creating user ${user.email}:`, authError);
        continue;
      }
      console.log(`Created auth user: ${user.email}`);
      // Find supervisor for employees
      let supervisorId = null;
      if (user.role === 'employee') {
        const supervisorEmail = 'supervisor@test.com';
        const { data: supData } = await supabaseAdmin.auth.admin.listUsers();
        const supervisor = supData.users.find((u)=>u.email === supervisorEmail);
        supervisorId = supervisor?.id || null;
      }
      // Create profile
      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        employee_id: user.employee_id,
        full_name: user.full_name,
        email: user.email,
        department_id: user.department?.id,
        basic_salary: user.basic_salary,
        supervisor_id: supervisorId,
        status: 'active'
      });
      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError);
        continue;
      }
      console.log(`Created profile for: ${user.email}`);
      // Create user role
      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
        user_id: authData.user.id,
        role: user.role
      });
      if (roleError) {
        console.error(`Error creating role for ${user.email}:`, roleError);
        continue;
      }
      console.log(`Created role for: ${user.email}`);
      results.push({
        email: user.email,
        role: user.role,
        success: true
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Test users created successfully',
      results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
