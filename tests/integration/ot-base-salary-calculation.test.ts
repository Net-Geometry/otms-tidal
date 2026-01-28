import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Integration test with actual database
// Requires test database with .env.test credentials

describe('OT Base Salary Database Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  let testEmployeeId: string;
  let originalBasicSalary: number;
  let originalOtBase: number | null;

  beforeAll(async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Skipping integration tests: missing Supabase credentials');
      return;
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    // Find an existing active employee to use for testing
    const { data: employee, error: fetchError } = await supabase
      .from('profiles')
      .select('id, basic_salary, ot_base')
      .eq('status', 'active')
      .eq('is_ot_eligible', true)
      .limit(1)
      .single();

    if (fetchError || !employee) {
      console.warn('No active OT-eligible employee found for testing. Skipping integration tests.');
      return;
    }

    testEmployeeId = employee.id;
    originalBasicSalary = employee.basic_salary;
    originalOtBase = employee.ot_base;
  });

  afterAll(async () => {
    if (!supabase || !testEmployeeId) return;

    // Clean up: Delete test OT requests
    await supabase
      .from('ot_requests')
      .delete()
      .eq('employee_id', testEmployeeId)
      .like('reason', 'Test%');

    // Restore original values
    await supabase
      .from('profiles')
      .update({
        basic_salary: originalBasicSalary,
        ot_base: originalOtBase,
      })
      .eq('id', testEmployeeId);
  });

  it('should store ot_base value in profiles table', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Update employee with ot_base
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ ot_base: 5000 })
      .eq('id', testEmployeeId);

    expect(updateError).toBeNull();

    // Verify stored value
    const { data, error: selectError } = await supabase
      .from('profiles')
      .select('basic_salary, ot_base')
      .eq('id', testEmployeeId)
      .single();

    expect(selectError).toBeNull();
    expect(data?.basic_salary).toBe(3000);
    expect(data?.ot_base).toBe(5000);
  });

  it('should use ot_base in OT calculation when set', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Set employee ot_base to different value than basic_salary
    await supabase
      .from('profiles')
      .update({ basic_salary: 3000, ot_base: 5200 })
      .eq('id', testEmployeeId);

    // Create OT request - trigger should calculate using ot_base
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: new Date().toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT with ot_base override',
        status: 'pending_verification',
      })
      .select('orp, hrp, ot_amount')
      .single();

    expect(error).toBeNull();

    // Verify calculations used ot_base (5200) not basic_salary (3000)
    // ORP = 5200 / 26 = 200
    // HRP = 200 / 8 = 25
    // OT Amount (weekday) = 1.5 * 25 * 2 = 75
    expect(otRequest?.orp).toBe(200);
    expect(otRequest?.hrp).toBe(25);
    expect(otRequest?.ot_amount).toBe(75);
  });

  it('should use basic_salary when ot_base is null', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Clear ot_base
    await supabase
      .from('profiles')
      .update({ basic_salary: 3900, ot_base: null })
      .eq('id', testEmployeeId);

    // Create OT request
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: new Date().toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT without ot_base',
        status: 'pending_verification',
      })
      .select('orp, hrp, ot_amount')
      .single();

    expect(error).toBeNull();

    // Verify calculations used basic_salary (3900)
    // ORP = 3900 / 26 = 150
    // HRP = 150 / 8 = 18.75
    // OT Amount (weekday) = 1.5 * 18.75 * 2 = 56.25
    expect(otRequest?.orp).toBe(150);
    expect(otRequest?.hrp).toBe(18.75);
    expect(otRequest?.ot_amount).toBe(56.25);
  });

  it('should calculate saturday OT correctly with ot_base', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Set ot_base
    await supabase
      .from('profiles')
      .update({ basic_salary: 3000, ot_base: 5200 })
      .eq('id', testEmployeeId);

    // Create saturday OT request
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-01-11', // Saturday
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'saturday',
        reason: 'Test Saturday OT with ot_base',
        status: 'pending_verification',
      })
      .select('orp, hrp, ot_amount')
      .single();

    expect(error).toBeNull();

    // Saturday: 2 x HRP x hours = 2 * 25 * 2 = 100
    expect(otRequest?.orp).toBe(200);
    expect(otRequest?.hrp).toBe(25);
    expect(otRequest?.ot_amount).toBe(100);
  });

  it('should calculate sunday OT correctly with ot_base', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Set ot_base
    await supabase
      .from('profiles')
      .update({ basic_salary: 3000, ot_base: 5200 })
      .eq('id', testEmployeeId);

    // Create sunday OT request (3 hours, should be 0.5 x ORP)
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-01-12', // Sunday
        start_time: '09:00',
        end_time: '12:00',
        total_hours: 3,
        day_type: 'sunday',
        reason: 'Test Sunday OT with ot_base',
        status: 'pending_verification',
      })
      .select('orp, hrp, ot_amount')
      .single();

    expect(error).toBeNull();

    // Sunday <= 4 hours: 0.5 x ORP = 0.5 * 200 = 100
    expect(otRequest?.orp).toBe(200);
    expect(otRequest?.hrp).toBe(25);
    expect(otRequest?.ot_amount).toBe(100);
  });

  it('should update calculation when ot_base is changed from null to value', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Start with null ot_base
    await supabase
      .from('profiles')
      .update({ basic_salary: 3000, ot_base: null })
      .eq('id', testEmployeeId);

    // Create OT request with null ot_base
    const { data: otRequest1, error: error1 } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: new Date().toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT before ot_base set',
        status: 'pending_verification',
      })
      .select('id, orp, hrp, ot_amount')
      .single();

    expect(error1).toBeNull();
    const orp_before = otRequest1?.orp;
    const ot_amount_before = otRequest1?.ot_amount;

    // Now set ot_base
    await supabase
      .from('profiles')
      .update({ ot_base: 5200 })
      .eq('id', testEmployeeId);

    // Create another OT request with ot_base set
    const { data: otRequest2, error: error2 } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: new Date().toISOString().split('T')[0],
        start_time: '20:00',
        end_time: '22:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT after ot_base set',
        status: 'pending_verification',
      })
      .select('id, orp, hrp, ot_amount')
      .single();

    expect(error2).toBeNull();
    const orp_after = otRequest2?.orp;
    const ot_amount_after = otRequest2?.ot_amount;

    // Verify ot_base caused higher calculation
    expect(orp_after).toBeGreaterThan(orp_before!);
    expect(ot_amount_after).toBeGreaterThan(ot_amount_before!);

    // Specific values
    expect(orp_before).toBe(115.38); // 3000 / 26
    expect(orp_after).toBe(200); // 5200 / 26
  });
});
