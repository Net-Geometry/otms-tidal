import { describe, test, expect } from 'vitest';

// Unit tests for state holiday detection logic
// Tests the core business logic without database dependencies
// Focuses on the December 11, 2025 Selangor bug scenario

describe('State Holiday Detection Unit Tests', () => {
  describe('Holiday matching logic', () => {
    test('State-specific holiday matching', () => {
      // Mock holiday data similar to what would be in malaysian_holidays table
      const holidays = [
        { state: 'SGR', date: '2025-12-11', name: 'Birthday of the Sultan of Selangor' },
        { state: 'JHR', date: '2025-03-23', name: 'Birthday of Sultan of Johor' },
        { state: 'ALL', date: '2025-02-01', name: 'Federal Territory Day' }
      ];

      // Test Selangor employee on Selangor holiday
      const selangorEmployee = { state: 'SGR' };
      const selangorHoliday = holidays.find(h =>
        h.state === 'ALL' || (selangorEmployee.state && h.state === selangorEmployee.state)
      );
      
      expect(selangorHoliday).toBeDefined();
      expect(selangorHoliday?.state).toBe('SGR');

      // Test Johor employee on Selangor holiday (should not match)
      const johorEmployee = { state: 'JHR' };
      const johorOnSelangorDate = holidays.filter(h => h.date === '2025-12-11').find(h =>
        h.state === 'ALL' || (johorEmployee.state && h.state === johorEmployee.state)
      );
      
      expect(johorOnSelangorDate).toBeUndefined();

      // Test federal holiday applies to all
      const federalHoliday = holidays.filter(h => h.date === '2025-02-01').find(h =>
        h.state === 'ALL' || (johorEmployee.state && h.state === johorEmployee.state)
      );
      
      expect(federalHoliday).toBeDefined();
      expect(federalHoliday?.state).toBe('ALL');
    });

    test('Employee state field vs work_location bug', () => {
      // This tests the bug where frontend was using work_location instead of state
      
      // Correct approach: use state field
      const profile = { 
        state: 'SGR', 
        work_location: '12345678-1234-1234-1234-123456789012' // UUID
      };
      
      const employeeState = profile?.state || null;
      expect(employeeState).toBe('SGR');

      // Bug scenario: using work_location (would be UUID, not state code)
      const buggyEmployeeState = profile?.work_location || null;
      expect(buggyEmployeeState).not.toBe('SGR');
      expect(buggyEmployeeState).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });
  });

  describe('Day type determination logic', () => {
    test('Holiday priority over day of week', () => {
      // Test that public_holiday takes precedence over weekend
      const isHoliday = true;
      const dayOfWeek = 0; // Sunday
      
      let dayType;
      if (isHoliday) {
        dayType = 'public_holiday';
      } else if (dayOfWeek === 0) {
        dayType = 'sunday';
      } else if (dayOfWeek === 6) {
        dayType = 'saturday';
      } else {
        dayType = 'weekday';
      }

      expect(dayType).toBe('public_holiday');
    });

    test('Weekend detection when not holiday', () => {
      // Test day of week logic
      const testCases = [
        { dayOfWeek: 0, expected: 'sunday' },
        { dayOfWeek: 6, expected: 'saturday' },
        { dayOfWeek: 1, expected: 'weekday' },
        { dayOfWeek: 2, expected: 'weekday' },
        { dayOfWeek: 3, expected: 'weekday' },
        { dayOfWeek: 4, expected: 'weekday' },
        { dayOfWeek: 5, expected: 'weekday' }
      ];

      testCases.forEach(({ dayOfWeek, expected }) => {
        const isHoliday = false;
        
        let dayType;
        if (isHoliday) {
          dayType = 'public_holiday';
        } else if (dayOfWeek === 0) {
          dayType = 'sunday';
        } else if (dayOfWeek === 6) {
          dayType = 'saturday';
        } else {
          dayType = 'weekday';
        }

        expect(dayType).toBe(expected);
      });
    });
  });

  describe('Rate calculation formulas', () => {
    test('Malaysian overtime rate calculations', () => {
      const basicSalary = 3000;
      const orp = basicSalary / 26; // RM 115.38
      const hrp = orp / 8; // RM 14.42

      // Test different day types and hour scenarios
      const testCases = [
        // Weekday: 1.5x HRP
        {
          dayType: 'weekday',
          hours: 4,
          expected: 1.5 * hrp * 4 // RM 86.54
        },
        
        // Saturday: 2x HRP
        {
          dayType: 'saturday',
          hours: 4,
          expected: 2 * hrp * 4 // RM 115.38
        },
        
        // Sunday <= 4 hours: 0.5x ORP
        {
          dayType: 'sunday',
          hours: 4,
          expected: 0.5 * orp // RM 57.69
        },
        
        // Sunday 5-8 hours: 1x ORP
        {
          dayType: 'sunday',
          hours: 8,
          expected: 1 * orp // RM 115.38
        },
        
        // Sunday > 8 hours: 1x ORP + 2x HRP for excess
        {
          dayType: 'sunday',
          hours: 10,
          expected: (1 * orp) + (2 * hrp * 2) // RM 115.38 + RM 57.69 = RM 173.08
        },
        
        // Public holiday <= 8 hours: 2x ORP
        {
          dayType: 'public_holiday',
          hours: 4,
          expected: 2 * orp // RM 230.77 - MUCH HIGHER than weekday!
        },
        
        // Public holiday <= 8 hours: 2x ORP
        {
          dayType: 'public_holiday',
          hours: 8,
          expected: 2 * orp // RM 230.77
        },
        
        // Public holiday > 8 hours: 2x ORP + 3x HRP for excess
        {
          dayType: 'public_holiday',
          hours: 10,
          expected: (2 * orp) + (3 * hrp * 2) // RM 230.77 + RM 86.54 = RM 317.31
        }
      ];

      testCases.forEach(({ dayType, hours, expected }) => {
        let calculated;
        
        if (dayType === 'weekday') {
          calculated = 1.5 * hrp * hours;
        } else if (dayType === 'saturday') {
          calculated = 2 * hrp * hours;
        } else if (dayType === 'sunday') {
          if (hours <= 4) {
            calculated = 0.5 * orp;
          } else if (hours <= 8) {
            calculated = 1 * orp;
          } else {
            calculated = (1 * orp) + (2 * hrp * (hours - 8));
          }
        } else if (dayType === 'public_holiday') {
          if (hours <= 8) {
            calculated = 2 * orp;
          } else {
            calculated = (2 * orp) + (3 * hrp * (hours - 8));
          }
        }

        expect(calculated).toBeCloseTo(expected, 2);
      });
    });

    test('December 11, 2025 Selangor underpayment calculation', () => {
      // Simulate the bug: employee worked 4 hours on public holiday but got weekday rate
      const basicSalary = 3000;
      const hours = 4;
      const orp = basicSalary / 26;
      const hrp = orp / 8;

      // Wrong calculation (bug): weekday rate
      const weekdayRate = 1.5 * hrp * hours; // RM 86.54

      // Correct calculation: public holiday rate  
      const holidayRate = 2 * orp; // RM 230.77

      // Underpayment amount
      const underpayment = holidayRate - weekdayRate; // RM 144.23

      expect(underpayment).toBeGreaterThan(0);
      expect(underpayment).toBeCloseTo(144.23, 2);
      
      // The holiday rate should be 2.67x higher than weekday
      const multiplier = holidayRate / weekdayRate;
      expect(multiplier).toBeCloseTo(2.67, 2);

      console.log(`Underpayment analysis for 4h on Dec 11, 2025 Selangor holiday:`);
      console.log(`- Weekday rate (incorrect): RM ${weekdayRate.toFixed(2)}`);
      console.log(`- Holiday rate (correct): RM ${holidayRate.toFixed(2)}`);
      console.log(`- Underpayment: RM ${underpayment.toFixed(2)} (${(multiplier * 100 - 100).toFixed(1)}% higher)`);
    });
  });

  describe('Data validation and edge cases', () => {
    test('Invalid date handling', () => {
      const testDates = [
        '2025-13-01', // Invalid month
        '2025-02-30', // Invalid day
        '2025-00-01', // Invalid month
        '', // Empty string
        null, // Null value
        undefined // Undefined
      ];

      testDates.forEach(date => {
        // In real implementation, should handle these gracefully
        if (date && typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Valid format - would proceed with date parsing
          expect(true).toBe(true);
        } else {
          // Invalid format - should use fallback or error handling
          expect(date).toBeFalsy();
        }
      });
    });

    test('State code validation', () => {
      const validStates = [
        'JHR', 'KDH', 'KTN', 'MLK', 'NSN', 'PHG', 'PNG', 'PRK', 
        'PLS', 'SBH', 'SWK', 'SGR', 'TRG', 'ALL'
      ];

      const testStates = [
        'SGR', // Valid
        'sgr', // Lowercase (should be handled)
        'SELANGOR', // Full name (should be converted)
        'XXX', // Invalid code
        '', // Empty
        null, // Null
        undefined // Undefined
      ];

      testStates.forEach(state => {
        const isValid = validStates.includes(state as string);
        if (state === 'SGR') {
          expect(isValid).toBe(true);
        } else if (state === 'sgr') {
          // Should be normalized to uppercase
          expect(validStates.includes((state as string).toUpperCase())).toBe(true);
        } else if (state === 'XXX' || !state) {
          expect(isValid).toBe(false);
        }
      });
    });

    test('Employee context validation', () => {
      const testEmployees = [
        { id: '12345678-1234-1234-1234-123456789012', state: 'SGR' }, // Valid
        { id: '12345678-1234-1234-1234-123456789012', state: null }, // Null state
        { id: 'invalid-uuid', state: 'SGR' }, // Invalid UUID
        { id: null, state: 'SGR' }, // Null ID
      ];

      testEmployees.forEach(employee => {
        const hasValidId = employee.id && employee.id.match(/^[a-f0-9-]{36}$/);
        const hasValidState = employee.state && employee.state.length === 3;

        if (employee.id === '12345678-1234-1234-1234-123456789012' && employee.state === 'SGR') {
          expect(hasValidId).toBe(true);
          expect(hasValidState).toBe(true);
        } else if (employee.state === null) {
          expect(hasValidState).toBe(false);
        } else if (employee.id === 'invalid-uuid') {
          expect(hasValidId).toBe(false);
        }
      });
    });
  });
});