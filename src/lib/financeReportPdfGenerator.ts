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
    head: [['Ticket', 'Receipt Date', 'Employee', 'Type', 'Status', 'Amount (RM)']],
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

// ---------------------------------------------------------------------------
// P&L PDF
// ---------------------------------------------------------------------------

interface PdfReportSection {
  account_code: string;
  account_name: string;
  level: number;
  amount: number;
  children: PdfReportSection[];
}

function flattenSections(sections: PdfReportSection[], rows: string[][], depth: number = 0) {
  for (const section of sections) {
    const indent = '  '.repeat(depth);
    if (section.children.length > 0) {
      // Group header
      rows.push([`${indent}${section.account_name}`, '']);
      flattenSections(section.children, rows, depth + 1);
      // Group subtotal
      rows.push([`${indent}Total ${section.account_name}`, fmt(section.amount)]);
    } else {
      // Leaf account
      rows.push([`${indent}${section.account_code} ${section.account_name}`, fmt(section.amount)]);
    }
  }
}

export async function generateProfitLossPdf(input: {
  startDate: string;
  endDate: string;
  companyName?: string;
  revenue: PdfReportSection[];
  expenses: PdfReportSection[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'Profit & Loss Statement',
    `${input.startDate} to ${input.endDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  const body: string[][] = [];

  // Revenue
  body.push(['REVENUE', '']);
  flattenSections(input.revenue, body, 1);
  body.push(['TOTAL REVENUE', fmt(input.totalRevenue)]);
  body.push(['', '']);

  // Expenses
  body.push(['EXPENSES', '']);
  flattenSections(input.expenses, body, 1);
  body.push(['TOTAL EXPENSES', fmt(input.totalExpenses)]);
  body.push(['', '']);

  // Net profit
  body.push([
    input.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS',
    fmt(Math.abs(input.netProfit)),
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Description', 'Amount (RM)']],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const text = String(data.cell.raw || '');
      if (
        text.startsWith('REVENUE') ||
        text.startsWith('EXPENSES') ||
        text.startsWith('TOTAL') ||
        text.startsWith('NET')
      ) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (text.startsWith('  Total')) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`profit-loss-${input.startDate}-to-${input.endDate}.pdf`);
}

// ---------------------------------------------------------------------------
// Balance Sheet PDF
// ---------------------------------------------------------------------------

export async function generateBalanceSheetPdf(input: {
  asOfDate: string;
  companyName?: string;
  assets: PdfReportSection[];
  liabilities: PdfReportSection[];
  equity: PdfReportSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
  isBalanced: boolean;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'Balance Sheet',
    `As at ${input.asOfDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  const body: string[][] = [];

  // Assets
  body.push(['ASSETS', '']);
  flattenSections(input.assets, body, 1);
  body.push(['TOTAL ASSETS', fmt(input.totalAssets)]);
  body.push(['', '']);

  // Liabilities
  body.push(['LIABILITIES', '']);
  flattenSections(input.liabilities, body, 1);
  body.push(['TOTAL LIABILITIES', fmt(input.totalLiabilities)]);
  body.push(['', '']);

  // Equity
  body.push(['EQUITY', '']);
  flattenSections(input.equity, body, 1);
  if (input.retainedEarnings !== 0) {
    body.push([`  Retained Earnings`, fmt(input.retainedEarnings)]);
  }
  body.push(['TOTAL EQUITY', fmt(input.totalEquity)]);
  body.push(['', '']);

  body.push(['TOTAL LIABILITIES + EQUITY', fmt(input.totalLiabilities + input.totalEquity)]);

  if (!input.isBalanced) {
    body.push(['*** BALANCE CHECK FAILED ***', '']);
  }

  autoTable(doc, {
    startY: 30,
    head: [['Description', 'Amount (RM)']],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const text = String(data.cell.raw || '');
      if (
        text.startsWith('ASSETS') ||
        text.startsWith('LIABILITIES') ||
        text.startsWith('EQUITY') ||
        text.startsWith('TOTAL') ||
        text.startsWith('NET') ||
        text.startsWith('***')
      ) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (text.startsWith('  Total')) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (text.startsWith('***')) {
        data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  doc.save(`balance-sheet-${input.asOfDate}.pdf`);
}

// ---------------------------------------------------------------------------
// Cash Book PDF
// ---------------------------------------------------------------------------

export async function generateCashBookPdf(input: {
  bankAccountLabel: string;
  dateRange: string;
  rows: Array<{
    entry_date: string;
    entry_number: string;
    description: string;
    reference_type: string;
    debit_amount: number;
    credit_amount: number;
    running_balance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'Cash Book Statement',
    `${input.bankAccountLabel} | ${input.dateRange}`,
  );

  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Entry #', 'Description', 'Ref Type', 'Debit (RM)', 'Credit (RM)', 'Balance (RM)']],
    body: [
      ...input.rows.map((row) => [
        row.entry_date,
        row.entry_number,
        row.description,
        row.reference_type,
        row.debit_amount > 0 ? fmt(row.debit_amount) : '-',
        row.credit_amount > 0 ? fmt(row.credit_amount) : '-',
        fmt(row.running_balance),
      ]),
      ['', '', '', 'Totals', fmt(input.totalDebit), fmt(input.totalCredit), fmt(input.closingBalance)],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      // Bold the totals row (last row)
      if (data.row.index === input.rows.length) {
        data.cell.styles.fontStyle = 'bold';
      }
      // Red for negative balance
      if (data.column.index === 6 && data.section === 'body') {
        const raw = String(data.cell.raw || '');
        if (raw.startsWith('-') || raw.startsWith('(')) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
  });

  const safeName = input.bankAccountLabel.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
  doc.save(`cash-book-${safeName}.pdf`);
}

// ---------------------------------------------------------------------------
// AP Aging PDF
// ---------------------------------------------------------------------------

export async function generateApAgingPdf(input: {
  asOfDate: string;
  companyName?: string;
  rows: Array<{
    supplier_code: string;
    supplier_name: string;
    invoice_number: string;
    status: 'outstanding' | 'partially_paid' | 'paid';
    original_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    payment_date: string | null;
    payment_ref: string | null;
    buckets: { current: number; days30: number; days60: number; days90plus: number; total: number };
  }>;
  totals: { current: number; days30: number; days60: number; days90plus: number; total: number; paid_total: number; original_total: number };
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'AP Aging Report',
    `As at ${input.asOfDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  const statusLabel = (s: string) =>
    s === 'partially_paid' ? 'Partial' : s === 'paid' ? 'Paid' : 'Outstanding';

  autoTable(doc, {
    startY: 30,
    head: [['Supplier', 'Invoice', 'Status', 'Original', 'Paid', 'Outstanding', 'Current', '31-60', '61-90', '90+', 'Pay Date', 'PV']],
    body: [
      ...input.rows.map((row) => [
        `${row.supplier_code} ${row.supplier_name}`,
        row.invoice_number,
        statusLabel(row.status),
        fmt(row.original_amount),
        fmt(row.paid_amount),
        fmt(row.outstanding_amount),
        fmt(row.buckets.current),
        fmt(row.buckets.days30),
        fmt(row.buckets.days60),
        fmt(row.buckets.days90plus),
        row.payment_date || '',
        row.payment_ref || '',
      ]),
      [
        'TOTAL', '', '',
        fmt(input.totals.original_total),
        fmt(input.totals.paid_total),
        fmt(input.totals.total),
        fmt(input.totals.current),
        fmt(input.totals.days30),
        fmt(input.totals.days60),
        fmt(input.totals.days90plus),
        '', '',
      ],
    ],
    styles: { fontSize: 7 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      if (data.row.index === input.rows.length) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`ap-aging-${input.asOfDate}.pdf`);
}

// ---------------------------------------------------------------------------
// AR Aging PDF
// ---------------------------------------------------------------------------

export async function generateArAgingPdf(input: {
  asOfDate: string;
  companyName?: string;
  rows: Array<{
    code: string;
    name: string;
    buckets: { current: number; days30: number; days60: number; days90plus: number; total: number };
  }>;
  totals: { current: number; days30: number; days60: number; days90plus: number; total: number };
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'AR Aging Report',
    `As at ${input.asOfDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  autoTable(doc, {
    startY: 30,
    head: [['Customer Code', 'Customer Name', 'Current (0-30)', '31-60', '61-90', '90+', 'Total']],
    body: [
      ...input.rows.map((row) => [
        row.code,
        row.name,
        fmt(row.buckets.current),
        fmt(row.buckets.days30),
        fmt(row.buckets.days60),
        fmt(row.buckets.days90plus),
        fmt(row.buckets.total),
      ]),
      ['', 'TOTAL', fmt(input.totals.current), fmt(input.totals.days30), fmt(input.totals.days60), fmt(input.totals.days90plus), fmt(input.totals.total)],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      if (data.row.index === input.rows.length) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`ar-aging-${input.asOfDate}.pdf`);
}

// ---------------------------------------------------------------------------
// General Ledger Report PDF
// ---------------------------------------------------------------------------

export async function generateGLReportPdf(input: {
  startDate: string;
  endDate: string;
  companyName?: string;
  accounts: Array<{
    account_code: string;
    account_name: string;
    account_type: string;
    opening_balance: number;
    transactions: Array<{
      entry_date: string;
      entry_number: string;
      description: string;
      reference_type: string;
      debit_amount: number;
      credit_amount: number;
      running_balance: number;
    }>;
    closing_balance: number;
  }>;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'General Ledger Listing',
    `${input.startDate} to ${input.endDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  let startY = 30;

  for (const account of input.accounts) {
    // Check page space
    if (startY > 170) {
      doc.addPage();
      startY = 15;
    }

    // Account header
    const headerBody: string[][] = [
      [`${account.account_code} - ${account.account_name}`, '', '', '', '', '', `Opening: ${fmt(account.opening_balance)}`],
    ];

    const txnBody: string[][] = account.transactions.map((txn) => [
      txn.entry_date,
      txn.entry_number,
      txn.description,
      txn.reference_type,
      txn.debit_amount > 0 ? fmt(txn.debit_amount) : '-',
      txn.credit_amount > 0 ? fmt(txn.credit_amount) : '-',
      fmt(txn.running_balance),
    ]);

    txnBody.push(['', '', '', '', '', 'Closing Balance:', fmt(account.closing_balance)]);

    autoTable(doc, {
      startY,
      head: [['Date', 'Entry #', 'Description', 'Ref Type', 'Debit (RM)', 'Credit (RM)', 'Balance (RM)']],
      body: [...headerBody, ...txnBody],
      styles: { fontSize: 7 },
      headStyles: { fillColor: [15, 118, 110] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        // Bold the account header row
        if (data.row.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
        // Bold the closing balance row
        if (data.row.index === txnBody.length) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    startY = ((doc as any).lastAutoTable?.finalY || startY) + 6;
  }

  doc.save(`gl-listing-${input.startDate}-to-${input.endDate}.pdf`);
}

// ---------------------------------------------------------------------------
// Cash Flow PDF
// ---------------------------------------------------------------------------

export async function generateCashFlowPdf(input: {
  startDate: string;
  endDate: string;
  companyName?: string;
  openingCash: number;
  operating: { label: string; amount: number; items: Array<{ label: string; amount: number }> };
  financing: { label: string; amount: number; items: Array<{ label: string; amount: number }> };
  netChange: number;
  closingCash: number;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'Cash Flow Summary',
    `${input.startDate} to ${input.endDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  function fmtSigned(amount: number) {
    if (amount < 0) return `(${fmt(Math.abs(amount))})`;
    return fmt(amount);
  }

  const body: string[][] = [];

  body.push(['OPENING CASH BALANCE', fmt(input.openingCash)]);
  body.push(['', '']);

  body.push(['OPERATING ACTIVITIES', '']);
  for (const item of input.operating.items) {
    body.push([`  ${item.label}`, fmtSigned(item.amount)]);
  }
  body.push(['Net Cash from Operating Activities', fmtSigned(input.operating.amount)]);
  body.push(['', '']);

  body.push(['FINANCING ACTIVITIES', '']);
  for (const item of input.financing.items) {
    body.push([`  ${item.label}`, fmtSigned(item.amount)]);
  }
  body.push(['Net Cash from Financing Activities', fmtSigned(input.financing.amount)]);
  body.push(['', '']);

  body.push(['NET CHANGE IN CASH', fmtSigned(input.netChange)]);
  body.push(['', '']);
  body.push(['CLOSING CASH BALANCE', fmt(input.closingCash)]);

  autoTable(doc, {
    startY: 30,
    head: [['Description', 'Amount (RM)']],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const text = String(data.cell.raw || '');
      if (
        text.startsWith('OPENING') ||
        text.startsWith('OPERATING') ||
        text.startsWith('FINANCING') ||
        text.startsWith('NET') ||
        text.startsWith('CLOSING') ||
        text.startsWith('Net Cash')
      ) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`cash-flow-${input.startDate}-to-${input.endDate}.pdf`);
}

// ---------------------------------------------------------------------------
// SST Summary PDF
// ---------------------------------------------------------------------------

export async function generateSSTSummaryPdf(input: {
  startDate: string;
  endDate: string;
  companyName?: string;
  outputTax: { taxableAmount: number; taxAmount: number };
  inputTax: { taxableAmount: number; taxAmount: number };
  netPayable: number;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  createHeader(
    doc,
    'SST Summary',
    `${input.startDate} to ${input.endDate}${input.companyName ? ` | ${input.companyName}` : ''}`
  );

  autoTable(doc, {
    startY: 30,
    head: [['Description', 'Taxable Amount (RM)', 'Tax Amount (RM)']],
    body: [
      ['OUTPUT TAX (SALES)', '', ''],
      ['  Standard Rated (SR 6%)', fmt(input.outputTax.taxableAmount), fmt(input.outputTax.taxAmount)],
      ['Total Output Tax', fmt(input.outputTax.taxableAmount), fmt(input.outputTax.taxAmount)],
      ['', '', ''],
      ['INPUT TAX (PURCHASES)', '', ''],
      ['  Standard Rated (SR 6%)', fmt(input.inputTax.taxableAmount), fmt(input.inputTax.taxAmount)],
      ['Total Input Tax', fmt(input.inputTax.taxableAmount), fmt(input.inputTax.taxAmount)],
      ['', '', ''],
      [
        input.netPayable >= 0 ? 'NET SST PAYABLE' : 'NET SST (REFUNDABLE)',
        '',
        input.netPayable < 0 ? `(${fmt(Math.abs(input.netPayable))})` : fmt(input.netPayable),
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 118, 110] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const text = String(data.cell.raw || '');
      if (
        text.startsWith('OUTPUT') ||
        text.startsWith('INPUT') ||
        text.startsWith('Total') ||
        text.startsWith('NET')
      ) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`sst-summary-${input.startDate}-to-${input.endDate}.pdf`);
}
