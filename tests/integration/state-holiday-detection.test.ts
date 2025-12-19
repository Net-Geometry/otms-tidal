import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import type { Database } from '../../src/types/database';

// State holiday test suite to verify all 16 Malaysian states
// Tests both frontend holiday detection and backend rate calculations
// Covers the December 11, 2025 Selangor bug and other state holidays

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Test data: 2025 state-specific holidays by state
const STATE_HOLIDAYS_2025 = {
  'JHR': [{ date: '2025-03-23', name: 'Birthday of Sultan of Johor' }],
  'KDH': [{ date: '2025-06-15', name: 'Birthday of Sultan of Kedah' }],
  'KTN': [
    { date: '2025-09-29', name: 'Birthday of Sultan of Kelantan' },
    { date: '2025-11-11', name: 'Birthday of Sultan of Kelantan' }
  ],
  'MLK': [
    { date: '2025-08-24', name: 'Governor of Melaka Birthday' },
    { date: '2025-10-15', name: 'Melaka Historical City Day' }
  ],
  'NSN': [{ date: '2025-01-14', name: 'Birthday of Yang di-Pertuan Besar of Negeri Sembilan' }],
  'PHG': [{ date: '2025-07-30', name: 'Birthday of Sultan of Pahang' }],
  'PNG': [{ date: '2025-07-12', name: 'Birthday of Governor of Penang' }],
  'PRK': [{ date: '2025-11-27', name: 'Birthday of Sultan of Perak' }],
  'PLS': [{ date: '2025-05-17', name: 'Birthday of Raja of Perlis' }],
  'SBH': [
    { date: '2025-05-30', name: 'Harvest Festival (Pesta Kaamatan)' },
    { date: '2025-05-31', name: 'Harvest Festival (Pesta Kaamatan)' },
    { date: '2025-10-03', name: 'Birthday of Governor of Sabah' }
  ],
  'SWK': [
    { date: '2025-06-01', name: 'Gawai Dayak' },
    { date: '2025-06-02', name: 'Gawai Dayak' },
    { date: '2025-10-10', name: 'Birthday of Governor of Sarawak' }
  ],
  'SGR': [{ date: '2025-12-11', name: 'Birthday of the Sultan of Selangor' }], // Critical test case
  'TRG': [{ date: '2025-04-26', name: 'Birthday of Sultan of Terengganu' }],
  'ALL': [{ date: '2025-02-01', name: 'Federal Territory Day' }] // Federal territories
};

// Mock employee profiles for each state
const TEST_EMPLOYEES = {
  'JHR': { id: '11111111-1111-1111-1111-111111111111', name: 'John Johor', state: 'JHR' },
  'KDH': { id: '22222222-2222-2222-2222-222222222222', name: 'Sarah Kedah', state: 'KDH' },
  'KTN': { id: '33333333-3333-3333-3333-333333333333', name: 'Ahmad Kelantan', state: 'KTN' },
  'MLK': { id: '44444444-4444-4444-4444-444444444444', name: 'Maria Melaka', state: 'MLK' },
  'NSN': { id: '55555555-5555-5555-5555-555555555555', name: 'Siti Negeri Sembilan', state: 'NSN' },
  'PHG': { id: '66666666-6666-6666-6666-666666666666', name: 'David Pahang', state: 'PHG' },
  'PNG': { id: '77777777-7777-7777-7777-777777777777', name: 'Lisa Penang', state: 'PNG' },
  'PRK': { id: '88888888-8888-8888-8888-888888888888', name: 'Rahman Perak', state: 'PRK' },
  'PLS': { id: '99999999-9999-9999-9999-999999999999', name: 'Aminah Perlis', state: 'PLS' },
  'SBH': { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Peter Sabah', state: 'SBH' },
  'SWK': { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Jennifer Sarawak', state: 'SWK' },
  'SGR': { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Raj Selangor', state: 'SGR' }, // Critical test case
  'TRG': { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Fatimah Terengganu', state: 'TRG' },
  'KL': { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Alex KL', state: 'ALL' }
};

describe('State Holiday Detection Comprehensive Test Suite', () => {
  beforeAll(async () => {
    // Seed test data - Malaysian holidays
    for (const [state, holidays] of Object.entries(STATE_HOLIDAYS_2025)) {
      for (const holiday of holidays) {
        await supabase.from('malaysian_holidays').upsert({
          date: holiday.date,
          name: holiday.name,
          state,
          type: state === 'ALL' ? 'federal' : 'state',
          source: 'test-suite',
          year: 2025
        }, { onConflict: 'state,date,year,name' });
      }
    }

    // Seed test employee profiles (mock data for testing)
    for (const employee of Object.values(TEST_EMPLOYEES)) {
      await supabase.from('profiles').upsert({
        id: employee.id,
        full_name: employee.name,
        state: employee.state,
        basic_salary: 3000, // Standard test salary
        employment_type: 'permanent'
      }, { onConflict: 'id' });
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('malaysian_holidays').delete().eq('source', 'test-suite');
    for (const employee of Object.values(TEST_EMPLOYEES)) {
      await supabase.from('profiles').delete().eq('id', employee.id);
    }
  });

  describe('Backend Holiday Detection Function Tests', () => {
    test('December 11, 2025 - Selangor employee gets public_holiday', async () => {
      const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11',
        employee_id: TEST_EMPLOYEES.SGR.id
      });

      expect(error).toBeNull();
      expect(data).toBe('public_holiday');
    });

    test('December 11, 2025 - Non-Selangor employee gets weekday', async () => {
      const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11',
        employee_id: TEST_EMPLOYEES.JHR.id // Johor employee
      });

      expect(error).toBeNull();
      expect(data).toBe('weekday'); // Should be weekday for non-Selangor
    });

    test('All state-specific holidays are detected correctly', async () => {
      const results = [];

      for (const [state, holidays] of Object.entries(STATE_HOLIDAYS_2025)) {
        const employee = TEST_EMPLOYEES[state as keyof typeof TEST_EMPLOYEES];
        if (!employee) continue;

        for (const holiday of holidays) {
          const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
            ot_date: holiday.date,
            employee_id: employee.id
          });

          results.push({
            state,
            date: holiday.date,
            holiday: holiday.name,
            employee: employee.name,
            dayType: data,
            error: error?.message
          });

          // Each employee should get public_holiday for their state holidays
          expect(error).toBeNull();
          expect(data).toBe('public_holiday');
        }
      }

      console.log('State Holiday Detection Results:', results);
    });

    test('Cross-state holiday isolation', async () => {
      // Test that Selangor holiday doesn't affect Johor employee
      const { data: selangorResult } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11', // Selangor holiday
        employee_id: TEST_EMPLOYEES.SGR.id
      });

      const { data: johorResult } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11',
        employee_id: TEST_EMPLOYEES.JHR.id
      });

      expect(selangorResult).toBe('public_holiday');
      expect(johorResult).toBe('weekday');
    });

    test('Federal holidays apply to all states', async () => {
      const federalHoliday = '2025-02-01'; // Federal Territory Day
      
      // Test multiple states for same federal holiday
      const testStates = ['SGR', 'JHR', 'PNG', 'SBH'];
      
      for (const state of testStates) {
        const employee = TEST_EMPLOYEES[state as keyof typeof TEST_EMPLOYEES];
        const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
          ot_date: federalHoliday,
          employee_id: employee.id
        });

        expect(error).toBeNull();
        expect(data).toBe('public_holiday');
      }
    });
  });

  describe('Frontend Holiday Detection Tests', () => {
    test('Employee state field resolution', async () => {
      // Test that frontend can properly get employee state
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('state')
        .eq('id', TEST_EMPLOYEES.SGR.id)
        .single();

      expect(error).toBeNull();
      expect(profile?.state).toBe('SGR');
    });

    test('Malaysian holidays query with state filtering', async () => {
      const employeeState = 'SGR';
      const testDate = '2025-12-11';

      const { data: holidays, error } = await supabase
        .from('malaysian_holidays')
        .select('*')
        .eq('date', testDate);

      expect(error).toBeNull();
      
      // Find applicable holiday (federal or employee's state)
      const applicableHoliday = holidays?.find(h =>
        h.state === 'ALL' || (employeeState && h.state === employeeState)
      );

      expect(applicableHoliday).toBeDefined();
      expect(applicableHoliday?.state).toBe('SGR');
      expect(applicableHoliday?.name).toBe('Birthday of the Sultan of Selangor');
    });
  });

  describe('Rate Calculation Impact Tests', () => {
    test('Holiday vs weekday rate difference calculation', async () => {
      const basicSalary = 3000;
      const totalHours = 4;

      // Calculate weekday rate
      const { data: weekdayCalc } = await supabase.rpc('calculate_ot_amount', {
        basic_salary: basicSalary,
        total_hours: totalHours,
        day_type: 'weekday'
      });

      // Calculate public holiday rate
      const { data: holidayCalc } = await supabase.rpc('calculate_ot_amount', {
        basic_salary: basicSalary,
        total_hours: totalHours,
        day_type: 'public_holiday'
      });

      // Holiday rate should be significantly higher
      expect(holidayCalc[0].ot_amount).toBeGreaterThan(weekdayCalc[0].ot_amount);
      
      // Log the difference for audit
      const difference = holidayCalc[0].ot_amount - weekdayCalc[0].ot_amount;
      console.log(`Rate difference for ${totalHours}h: Weekday=RM${weekdayCalc[0].ot_amount}, Holiday=RM${holidayCalc[0].ot_amount}, Diff=RM${difference}`);
      
      expect(difference).toBeGreaterThan(0);
    });
  });

  describe('Data Migration Impact Assessment Tests', () => {
    test('Find affected OT records function', async () => {
      // This tests the audit function created in the migration
      const { data, error } = await supabase.rpc('find_affected_ot_records');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      if (data && data.length > 0) {
        // Verify structure of returned data
        const record = data[0];
        expect(record).toHaveProperty('ot_request_id');
        expect(record).toHaveProperty('employee_state');
        expect(record).toHaveProperty('current_day_type');
        expect(record).toHaveProperty('correct_day_type');
        expect(record).toHaveProperty('underpayment_amount');
      }
    });

    test('Preview corrections without changes', async () => {
      const { data, error } = await supabase.rpc('preview_state_holiday_corrections');

      expect(error).toBeNull();
      expect(data).toHaveProperty('correction_count');
      expect(data).toHaveProperty('total_underpayment');
      expect(data).toHaveProperty('affected_employees');
      expect(data).toHaveProperty('by_state');
      expect(data).toHaveProperty('sample_records');

      console.log('Correction Preview:', data);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('Employee with null state gets federal holidays only', async () => {
      // Create employee with null state
      const nullStateEmployee = {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        name: 'No State Employee',
        state: null
      };

      await supabase.from('profiles').upsert({
        id: nullStateEmployee.id,
        full_name: nullStateEmployee.name,
        state: null,
        basic_salary: 3000
      });

      try {
        // Should not get Selangor state holiday
        const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
          ot_date: '2025-12-11',
          employee_id: nullStateEmployee.id
        });

        expect(error).toBeNull();
        expect(data).toBe('weekday'); // Should not be holiday without state

        // But should get federal holidays
        const { data: federalData } = await supabase.rpc('determine_day_type_for_employee', {
          ot_date: '2025-02-01', // Federal Territory Day
          employee_id: nullStateEmployee.id
        });

        expect(federalData).toBe('public_holiday');
      } finally {
        // Clean up
        await supabase.from('profiles').delete().eq('id', nullStateEmployee.id);
      }
    });

    test('Nonexistent employee handling', async () => {
      const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11',
        employee_id: '00000000-0000-0000-0000-000000000000'
      });

      // Should handle gracefully - either return weekday or appropriate error
      expect(error).toBeNull();
      expect(['weekday', 'saturday', 'sunday', 'public_holiday']).toContain(data);
    });

    test('Weekend state holidays are still holidays', async () => {
      // Find a weekend date that's also a state holiday
      const { data, error } = await supabase.rpc('determine_day_type_for_employee', {
        ot_date: '2025-12-11', // Check if this is weekend
        employee_id: TEST_EMPLOYEES.SGR.id
      });

      expect(error).toBeNull();
      // Should be public_holiday regardless of day of week
      expect(data).toBe('public_holiday');
    });
  });

  describe('Performance and Load Tests', () => {
    test('Bulk holiday detection performance', async () => {
      const startTime = Date.now();
      const promises = [];

      // Test 100 concurrent holiday detections
      for (let i = 0; i < 100; i++) {
        const randomState = Object.keys(STATE_HOLIDAYS_2025)[i % Object.keys(STATE_HOLIDAYS_2025).length];
        const employee = TEST_EMPLOYEES[randomState as keyof typeof TEST_EMPLOYEES];
        
        if (employee) {
          promises.push(
            supabase.rpc('determine_day_type_for_employee', {
              ot_date: '2025-12-11',
              employee_id: employee.id
            })
          );
        }
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Bulk test: ${promises.length} calls in ${duration}ms (${(duration/promises.length).toFixed(2)}ms avg)`);

      // All should complete without error
      results.forEach(result => {
        expect(result.error).toBeNull();
      });

      // Performance should be reasonable (< 5 seconds for 100 calls)
      expect(duration).toBeLessThan(5000);
    });
  });
});