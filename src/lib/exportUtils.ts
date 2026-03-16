export function exportToCSV(
  data: any[],
  filename: string,
  headers: { key: string; label: string }[],
  metadata?: { reportName?: string; period?: string; generatedDate?: string }
) {
  const csvEscape = (value: unknown): string => {
    if (value == null) return '';
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows: string[] = [];

  // Add metadata rows if provided — each value in its own first cell
  if (metadata) {
    if (metadata.reportName) {
      rows.push(`${csvEscape('Report')},${csvEscape(metadata.reportName)}`);
    }
    if (metadata.period) {
      rows.push(`${csvEscape('Period')},${csvEscape(metadata.period)}`);
    }
    if (metadata.generatedDate) {
      rows.push(`${csvEscape('Generated')},${csvEscape(metadata.generatedDate)}`);
    }
    rows.push(''); // Empty row separator
  }

  // Create CSV header row
  const headerRow = headers.map(h => csvEscape(h.label)).join(',');
  rows.push(headerRow);

  // Create CSV data rows
  const dataRows = data.map(row =>
    headers.map(h => csvEscape(row[h.key])).join(',')
  );
  
  rows.push(...dataRows);
  const csv = rows.join('\n');
  
  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF() {
  // Use browser's native print functionality
  // User can save as PDF from the print dialog
  window.print();
}

export function downloadTxtFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
