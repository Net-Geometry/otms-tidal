import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildXLSXBlob } from '../xlsxExport';

describe('buildXLSXBlob', () => {
  it('creates an xlsx workbook with metadata, headers, and escaped values', async () => {
    const blob = await buildXLSXBlob(
      [{ employee: 'Ali & Siti', amount: 123.45 }],
      [
        { key: 'employee', label: 'Employee' },
        { key: 'amount', label: 'Amount (RM)' },
      ],
      {
        reportName: 'OT Report',
        period: 'All Periods',
        generatedDate: '21/05/2026 20:00',
      }
    );

    const zip = await JSZip.loadAsync(blob);
    const sheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
    const sharedStrings = await zip.file('xl/sharedStrings.xml')?.async('string');

    expect(sheet).toContain('<sheetData>');
    expect(sharedStrings).toContain('OT Report');
    expect(sharedStrings).toContain('All Periods');
    expect(sharedStrings).toContain('Employee');
    expect(sharedStrings).toContain('Ali &amp; Siti');
    expect(sharedStrings).toContain('Amount (RM)');
    expect(sheet).toContain('<v>123.45</v>');
  });
});
