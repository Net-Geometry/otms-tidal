import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration tests for OT Location State Holiday Detection
 *
 * Tests the database-level holiday detection logic that uses
 * ot_location_state to determine if a date is a state-specific holiday.
 *
 * Requires test database with .env.test credentials
 */
describe('OT Location State Holiday Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  let testEmployeeId: string;
  let testHolidayId: string | null = null;

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
      .select('id, state')
      .eq('status', 'active')
      .eq('is_ot_eligible', true)
      .limit(1)
      .single();

    if (fetchError || !employee) {
      console.warn('No active OT-eligible employee found for testing.');
      return;
    }

    testEmployeeId = employee.id;

    // Create a test state holiday for JHR on a future date
    const testDate = '2026-12-25';
    const { data: holiday, error: holidayError } = await supabase
      .from('malaysian_holidays')
      .insert({
        date: testDate,
        name: 'Test JHR State Holiday',
        state: 'JHR',
        type: 'state',
        year: 2026,
      })
      .select('id')
      .single();

    if (!holidayError && holiday) {
      testHolidayId = holiday.id;
    }
  });

  afterAll(async () => {
    if (!supabase) return;

    // Clean up test OT requests
    if (testEmployeeId) {
      await supabase
        .from('ot_requests')
        .delete()
        .eq('employee_id', testEmployeeId)
        .like('reason', 'Test OT location%');
    }

    // Clean up test holiday
    if (testHolidayId) {
      await supabase.from('malaysian_holidays').delete().eq('id', testHolidayId);
    }
  });

  it('should store ot_location_state with OT request', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-01-15',
        ot_location_state: 'JHR',
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT location state storage',
        status: 'pending_verification',
      })
      .select('ot_location_state')
      .single();

    expect(error).toBeNull();
    expect(otRequest?.ot_location_state).toBe('JHR');
  });

  it('should detect state holiday when ot_location_state matches holiday state', async () => {
    if (!supabase || !testEmployeeId || !testHolidayId) {
      console.warn('Skipping test: Supabase not configured or test data missing');
      return;
    }

    // Create OT request on JHR state holiday with JHR location
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-12-25', // JHR state holiday
        ot_location_state: 'JHR',
        start_time: '09:00',
        end_time: '12:00',
        total_hours: 3,
        day_type: 'weekday', // Will be overridden by trigger
        reason: 'Test OT location JHR holiday detection',
        status: 'pending_verification',
      })
      .select('day_type, ot_location_state')
      .single();

    expect(error).toBeNull();
    expect(otRequest?.ot_location_state).toBe('JHR');
    // Trigger should detect this as a public_holiday (state holidays are stored as public_holiday)
    expect(otRequest?.day_type).toBe('public_holiday');
  });

  it('should NOT detect state holiday when ot_location_state differs from holiday state', async () => {
    if (!supabase || !testEmployeeId || !testHolidayId) {
      console.warn('Skipping test: Supabase not configured or test data missing');
      return;
    }

    // Create OT request on JHR state holiday but with SGR location
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-12-25', // JHR state holiday, but employee is in SGR
        ot_location_state: 'SGR',
        start_time: '09:00',
        end_time: '12:00',
        total_hours: 3,
        day_type: 'weekday',
        reason: 'Test OT location SGR no holiday',
        status: 'pending_verification',
      })
      .select('day_type, ot_location_state')
      .single();

    expect(error).toBeNull();
    expect(otRequest?.ot_location_state).toBe('SGR');
    // Should NOT be detected as holiday since SGR has no holiday on this date
    // Dec 25, 2026 is a Friday, so should be weekday
    expect(otRequest?.day_type).toBe('weekday');
  });

  it('should default ot_location_state to employee profile state when not provided', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    // Get employee's profile state
    const { data: profile } = await supabase
      .from('profiles')
      .select('state')
      .eq('id', testEmployeeId)
      .single();

    // Create OT request without specifying ot_location_state
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-01-16',
        // ot_location_state not provided - should default to profile state
        start_time: '18:00',
        end_time: '20:00',
        total_hours: 2,
        day_type: 'weekday',
        reason: 'Test OT location default to profile',
        status: 'pending_verification',
      })
      .select('ot_location_state')
      .single();

    expect(error).toBeNull();
    // Should default to employee's profile state
    expect(otRequest?.ot_location_state).toBe(profile?.state);
  });

  it('should enforce single ot_location_state per employee per date', async () => {
    if (!supabase || !testEmployeeId) {
      console.warn('Skipping test: Supabase not configured or no test employee');
      return;
    }

    const testDate = '2026-01-20';

    // First OT request with JHR location
    const { error: error1 } = await supabase.from('ot_requests').insert({
      employee_id: testEmployeeId,
      ot_date: testDate,
      ot_location_state: 'JHR',
      start_time: '18:00',
      end_time: '19:00',
      total_hours: 1,
      day_type: 'weekday',
      reason: 'Test OT location consistency first',
      status: 'pending_verification',
    });

    expect(error1).toBeNull();

    // Second OT request on same date with DIFFERENT location should fail
    const { error: error2 } = await supabase.from('ot_requests').insert({
      employee_id: testEmployeeId,
      ot_date: testDate,
      ot_location_state: 'SGR', // Different state
      start_time: '19:00',
      end_time: '20:00',
      total_hours: 1,
      day_type: 'weekday',
      reason: 'Test OT location consistency second',
      status: 'pending_verification',
    });

    // Should fail due to location consistency enforcement
    expect(error2).not.toBeNull();
    expect(error2?.message).toContain('OT Location');
  });

  it('should use determine_day_type_for_state function correctly', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }

    // Test the RPC function directly
    const { data: dayTypeJHR, error: error1 } = await supabase.rpc(
      'determine_day_type_for_state',
      {
        ot_date: '2026-12-25',
        location_state: 'JHR',
      }
    );

    expect(error1).toBeNull();
    expect(dayTypeJHR).toBe('public_holiday'); // JHR holiday on this date

    const { data: dayTypeSGR, error: error2 } = await supabase.rpc(
      'determine_day_type_for_state',
      {
        ot_date: '2026-12-25',
        location_state: 'SGR',
      }
    );

    expect(error2).toBeNull();
    expect(dayTypeSGR).toBe('weekday'); // SGR has no holiday on this date
  });

  it('should calculate OT amount correctly for state holiday', async () => {
    if (!supabase || !testEmployeeId || !testHolidayId) {
      console.warn('Skipping test: Supabase not configured or test data missing');
      return;
    }

    // Set employee salary for predictable calculation
    await supabase
      .from('profiles')
      .update({ basic_salary: 2600, ot_base: null })
      .eq('id', testEmployeeId);

    // Create OT request on state holiday
    const { data: otRequest, error } = await supabase
      .from('ot_requests')
      .insert({
        employee_id: testEmployeeId,
        ot_date: '2026-12-25', // JHR state holiday
        ot_location_state: 'JHR',
        start_time: '09:00',
        end_time: '11:00',
        total_hours: 2,
        day_type: 'weekday', // Will be overridden
        reason: 'Test OT location holiday rate calculation',
        status: 'pending_verification',
      })
      .select('day_type, orp, hrp, ot_amount')
      .single();

    expect(error).toBeNull();
    expect(otRequest?.day_type).toBe('public_holiday');

    // ORP = 2600 / 26 = 100
    // HRP = 100 / 8 = 12.5
    // Public holiday rate = 2 x HRP x hours = 2 * 12.5 * 2 = 50
    expect(otRequest?.orp).toBe(100);
    expect(otRequest?.hrp).toBe(12.5);
    expect(otRequest?.ot_amount).toBe(50);
  });
});
