import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmt(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function createHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(subtitle, 14, 24);
  }
}

export async function generateProjectCostSummaryPdf(input: {
  startDate: string;
  endDate: string;
  companyName?: string;
  rows: Array<{
    project_code: string;
    project_name: string;
    company_name: string;
    categories: {
      labor: number;
      materials: number;
      subcontractor: number;
      equipment: number;
      overhead: number;
      travel: number;
      other: number;
    };
    total: number;
  }>;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'Project Cost Summary',
    `${input.startDate} to ${input.endDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  autoTable(doc, {
    startY: 30,
    head: [[
      'Project',
      'Company',
      'Labor',
      'Materials',
      'Subcontractor',
      'Equipment',
      'Overhead',
      'Travel',
      'Other',
      'Total',
    ]],
    body: input.rows.map((row) => [
      `${row.project_code} - ${row.project_name}`,
      row.company_name,
      fmt(row.categories.labor),
      fmt(row.categories.materials),
      fmt(row.categories.subcontractor),
      fmt(row.categories.equipment),
      fmt(row.categories.overhead),
      fmt(row.categories.travel),
      fmt(row.categories.other),
      fmt(row.total),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
  });

  doc.save(`project-cost-summary-${input.startDate}-to-${input.endDate}.pdf`);
}

export async function generateClaimsReportPdf(input: {
  startDate: string;
  endDate: string;
  rows: Array<{
    ticket_number: string;
    claim_date: string;
    employee_name: string;
    claim_type: string;
    status: string;
    amount: number;
  }>;
  totalsByType: Array<{ type: string; amount: number }>;
  grandTotal: number;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(doc, 'Claims Report', `${input.startDate} to ${input.endDate}`);

  autoTable(doc, {
    startY: 30,
    head: [['Ticket', 'Date', 'Employee', 'Type', 'Status', 'Amount (RM)']],
    body: input.rows.map((row) => [
      row.ticket_number,
      row.claim_date,
      row.employee_name,
      row.claim_type,
      row.status,
      fmt(row.amount),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [2, 132, 199] },
  });

  const summaryStartY = ((doc as any).lastAutoTable?.finalY || 30) + 8;
  autoTable(doc, {
    startY: summaryStartY,
    head: [['Claim Type', 'Subtotal (RM)']],
    body: [
      ...input.totalsByType.map((row) => [row.type, fmt(row.amount)]),
      ['Grand Total', fmt(input.grandTotal)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 1: { halign: 'right' } },
  });

  doc.save(`claims-report-${input.startDate}-to-${input.endDate}.pdf`);
}

export async function generatePettyCashStatementPdf(input: {
  periodLabel: string;
  openingBalance: number;
  closingBalance: number;
  rows: Array<{
    txn_number: string;
    txn_date: string;
    description: string;
    txn_type: string;
    status: string;
    amount: number;
  }>;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(doc, 'Petty Cash Statement', input.periodLabel);

  doc.setFontSize(10);
  doc.text(`Opening Balance: RM ${fmt(input.openingBalance)}`, 14, 32);
  doc.text(`Closing Balance: RM ${fmt(input.closingBalance)}`, 14, 38);

  autoTable(doc, {
    startY: 44,
    head: [['Txn #', 'Date', 'Description', 'Type', 'Status', 'Amount (RM)']],
    body: input.rows.map((row) => [
      row.txn_number,
      row.txn_date,
      row.description,
      row.txn_type,
      row.status,
      fmt(row.amount),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [217, 119, 6] },
  });

  doc.save(`petty-cash-statement-${input.periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export async function generatePaymentRegisterPdf(input: {
  startDate: string;
  endDate: string;
  rows: Array<{
    source: string;
    reference_no: string;
    posting_reference: string | null;
    posted_at: string;
    description: string;
    amount: number;
  }>;
  totalAmount: number;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(doc, 'Payment Register', `${input.startDate} to ${input.endDate}`);

  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Source', 'Reference', 'Posting Ref', 'Description', 'Amount (RM)']],
    body: [
      ...input.rows.map((row) => [
        row.posted_at,
        row.source,
        row.reference_no,
        row.posting_reference || '-',
        row.description,
        fmt(row.amount),
      ]),
      ['', '', '', '', 'Grand Total', fmt(input.totalAmount)],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 5: { halign: 'right' } },
  });

  doc.save(`payment-register-${input.startDate}-to-${input.endDate}.pdf`);
}
