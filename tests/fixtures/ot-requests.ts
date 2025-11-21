/**
 * Test Fixtures for OT Requests
 * Provides reusable test data for unit, integration, and E2E tests
 */

export const TEST_USER_IDS = {
  supervisor1: 'd643dbf1-7568-4ef1-b15c-18a8587a419b', // Syasya (real supervisor)
  supervisor2: '83fc01a8-5501-43a9-8c9f-8d2d57387661', // HR Manager (also supervisor role)
  employee1: '443d8f7b-252e-42f3-9a74-f54d501f7540', // Katy Perry (real employee)
  employee2: '6a3a72b5-591c-482a-bc3a-3256be6cd3fc', // Dira Izliyana
  employee3: '00000000-0000-0000-0000-000000000013',
  hr1: '83fc01a8-5501-43a9-8c9f-8d2d57387661', // HR Manager (real HR)
  hr2: '00000000-0000-0000-0000-000000000022',
  management1: 'ae11fc73-4280-45b1-9538-a07a016a8c13', // System Admin
};

export const TEST_REQUEST_IDS = {
  pendingConfirmation1: '00000000-0000-0000-0000-000000000001', // Real test data
  pendingConfirmation2: '00000000-0000-0000-0000-000000000002', // Real test data
  confirmed1: '10000000-0000-0000-0000-000000000003',
  legacy1: '00000000-0000-0000-0000-000000000004', // Real test data (legacy)
  legacy2: '10000000-0000-0000-0000-000000000005',
  hrCertified1: '00000000-0000-0000-0000-000000000003', // Real test data
};

export const mockOTRequest = {
  pendingConfirmation: {
    id: TEST_REQUEST_IDS.pendingConfirmation1,
    employee_id: TEST_USER_IDS.employee1,
    supervisor_id: TEST_USER_IDS.supervisor1,
    status: 'pending_supervisor_confirmation' as const,
    ot_date: '2025-11-15',
    start_time: '18:00:00',
    end_time: '22:00:00',
    total_hours: 4.0,
    day_type: 'weekday' as const,
    reason: 'Project deadline work',
    orp: 25.50,
    hrp: 25.50,
    ot_amount: 102.00,
    supervisor_verified_at: '2025-11-14T10:00:00Z',
    supervisor_remarks: 'Time verified and approved',
    supervisor_confirmation_at: null,
    supervisor_confirmation_remarks: null,
    hr_id: null,
    hr_approved_at: null,
    hr_remarks: null,
    created_at: '2025-11-14T08:00:00Z',
    updated_at: '2025-11-14T10:00:00Z',
    ticket_number: 'OT-2025-11-001',
  },

  confirmed: {
    id: TEST_REQUEST_IDS.confirmed1,
    employee_id: TEST_USER_IDS.employee2,
    supervisor_id: TEST_USER_IDS.supervisor1,
    status: 'supervisor_confirmed' as const,
    ot_date: '2025-11-13',
    start_time: '19:00:00',
    end_time: '23:00:00',
    total_hours: 4.0,
    day_type: 'weekday' as const,
    reason: 'System maintenance',
    orp: 30.00,
    hrp: 30.00,
    ot_amount: 120.00,
    supervisor_verified_at: '2025-11-13T15:00:00Z',
    supervisor_remarks: 'Verified',
    supervisor_confirmation_at: '2025-11-13T16:00:00Z',
    supervisor_confirmation_remarks: 'Confirmed for critical maintenance work',
    hr_id: null,
    hr_approved_at: null,
    hr_remarks: null,
    created_at: '2025-11-13T12:00:00Z',
    updated_at: '2025-11-13T16:00:00Z',
    ticket_number: 'OT-2025-11-002',
  },

  legacy: {
    id: TEST_REQUEST_IDS.legacy1,
    employee_id: TEST_USER_IDS.employee3,
    supervisor_id: TEST_USER_IDS.supervisor2,
    status: 'supervisor_verified' as const,
    ot_date: '2025-10-15',
    start_time: '18:00:00',
    end_time: '21:00:00',
    total_hours: 3.0,
    day_type: 'saturday' as const,
    reason: 'Legacy request before confirmation workflow',
    orp: 28.00,
    hrp: 28.00,
    ot_amount: 126.00,
    supervisor_verified_at: '2025-10-16T09:00:00Z',
    supervisor_remarks: 'Verified as per old workflow',
    supervisor_confirmation_at: null,
    supervisor_confirmation_remarks: null,
    hr_id: null,
    hr_approved_at: null,
    hr_remarks: null,
    created_at: '2025-10-15T20:00:00Z',
    updated_at: '2025-10-16T09:00:00Z',
    ticket_number: 'OT-2025-10-045',
  },

  hrCertified: {
    id: TEST_REQUEST_IDS.hrCertified1,
    employee_id: TEST_USER_IDS.employee1,
    supervisor_id: TEST_USER_IDS.supervisor1,
    status: 'hr_certified' as const,
    ot_date: '2025-11-10',
    start_time: '18:00:00',
    end_time: '22:00:00',
    total_hours: 4.0,
    day_type: 'weekday' as const,
    reason: 'Client presentation preparation',
    orp: 25.50,
    hrp: 25.50,
    ot_amount: 102.00,
    supervisor_verified_at: '2025-11-11T09:00:00Z',
    supervisor_remarks: 'Verified',
    supervisor_confirmation_at: '2025-11-11T10:00:00Z',
    supervisor_confirmation_remarks: 'Confirmed',
    hr_id: TEST_USER_IDS.hr1,
    hr_approved_at: '2025-11-12T14:00:00Z',
    hr_remarks: 'Certified and processed',
    created_at: '2025-11-10T20:00:00Z',
    updated_at: '2025-11-12T14:00:00Z',
    ticket_number: 'OT-2025-11-003',
  },
};

export const mockBatchConfirmationRequests = [
  {
    ...mockOTRequest.pendingConfirmation,
    id: TEST_REQUEST_IDS.pendingConfirmation1,
    employee_id: TEST_USER_IDS.employee1,
    ot_date: '2025-11-15',
    reason: 'Batch test 1',
  },
  {
    ...mockOTRequest.pendingConfirmation,
    id: TEST_REQUEST_IDS.pendingConfirmation2,
    employee_id: TEST_USER_IDS.employee2,
    ot_date: '2025-11-16',
    reason: 'Batch test 2',
  },
];

export const mockConfirmationInput = {
  valid: {
    singleRequest: {
      requestIds: [TEST_REQUEST_IDS.pendingConfirmation1],
      remarks: 'Confirmed for project completion',
    },
    batchRequest: {
      requestIds: [
        TEST_REQUEST_IDS.pendingConfirmation1,
        TEST_REQUEST_IDS.pendingConfirmation2,
      ],
      remarks: 'Batch confirmed for critical project work',
    },
    noRemarks: {
      requestIds: [TEST_REQUEST_IDS.pendingConfirmation1],
    },
    maxLengthRemarks: {
      requestIds: [TEST_REQUEST_IDS.pendingConfirmation1],
      remarks: 'x'.repeat(500),
    },
  },
  invalid: {
    tooLongRemarks: {
      requestIds: [TEST_REQUEST_IDS.pendingConfirmation1],
      remarks: 'x'.repeat(501),
    },
    emptyRequestIds: {
      requestIds: [],
      remarks: 'Should fail',
    },
    invalidRequestId: {
      requestIds: ['invalid-uuid-format'],
      remarks: 'Should fail',
    },
  },
};

export const mockValidationErrors = {
  invalidStatus: 'Request must be in pending_confirmation status. Current status: hr_certified',
  unauthorized: 'You are not authorized to confirm this request',
  remarksLength: 'Remarks must not exceed 500 characters',
  noRequestIds: 'At least one request ID is required',
  alreadyConfirmed: 'Request has already been confirmed',
  legacyRequest: 'Legacy request detected - confirmation not required',
};

/**
 * Helper function to create mock OT request with custom properties
 */
export const createMockOTRequest = (overrides?: Partial<typeof mockOTRequest.pendingConfirmation>) => {
  return {
    ...mockOTRequest.pendingConfirmation,
    ...overrides,
  };
};

/**
 * Helper function to generate multiple mock requests
 */
export const generateMockRequests = (count: number, baseStatus: string = 'pending_supervisor_confirmation') => {
  return Array.from({ length: count }, (_, i) => ({
    ...mockOTRequest.pendingConfirmation,
    id: `generated-${i}-${Date.now()}`,
    status: baseStatus,
    ot_date: new Date(2025, 10, 15 + i).toISOString().split('T')[0],
    ticket_number: `OT-2025-11-${String(100 + i).padStart(3, '0')}`,
  }));
};
