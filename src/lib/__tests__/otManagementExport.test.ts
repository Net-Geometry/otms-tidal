import { describe, expect, it } from 'vitest';

import { buildOTManagementExportRows, getOTManagementStatusLabel } from '../otManagementExport';

describe('getOTManagementStatusLabel', () => {
  it('keeps pending_verification as Awaiting Verification', () => {
    expect(getOTManagementStatusLabel('pending_verification')).toBe('Awaiting Verification');
  });

  it('maps approved status to Approved', () => {
    expect(getOTManagementStatusLabel('management_approved')).toBe('Approved');
  });
});

describe('buildOTManagementExportRows', () => {
  it('marks only management approved submissions as included in claim amount', () => {
    const rows = buildOTManagementExportRows([
      {
        ticket_number: 'OT-001',
        ot_date: '2026-02-10',
        status: 'management_approved',
        total_hours: 3,
        ot_amount: 120,
        profiles: {
          employee_id: 'E001',
          full_name: 'Ali Ahmad',
          departments: { name: 'Ops' },
          companies: { name: 'Tidal Venture Sdn Bhd', code: 'TVSB' },
        },
        sessions: [
          { start_time: '18:00:00', end_time: '21:00:00', total_hours: 3 },
        ],
      },
      {
        ticket_number: 'OT-002',
        ot_date: '2026-02-11',
        status: 'hr_certified',
        total_hours: 2,
        ot_amount: 80,
        profiles: {
          employee_id: 'E002',
          full_name: 'Siti Aminah',
          departments: { name: 'Finance' },
          companies: { name: 'Janamurni Sdn Bhd', code: 'JMSB' },
        },
        sessions: [
          { start_time: '17:30:00', end_time: '19:30:00', total_hours: 2 },
        ],
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        ticket_number: 'OT-001',
        current_status: 'Approved',
        included_in_claim: 'Yes',
        claim_amount: 120,
      }),
      expect.objectContaining({
        ticket_number: 'OT-002',
        current_status: 'Certified',
        included_in_claim: 'No',
        claim_amount: 0,
      }),
    ]);
  });
});
