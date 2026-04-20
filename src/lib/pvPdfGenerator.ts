import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_PV_STATUS_LABELS,
  type PaymentVoucher,
} from '@/types/finance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Currency-style number (no symbol) — keeps tables compact. */
function fmtAmount(amount: number) {
  return Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Currency with RM prefix — for totals and headline figures. */
function fmtMoney(amount: number) {
  return `RM ${fmtAmount(amount)}`;
}

function safeDate(value?: string | null, pattern = 'dd MMM yyyy'): string {
  if (!value) return '-';
  try {
    return format(new Date(value), pattern);
  } catch {
    return value;
  }
}

/** Branded header: matches `createHeader` in financeReportPdfGenerator.ts. */
function createHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(subtitle, 14, 24);
  }
  // Reset
  doc.setTextColor(0, 0, 0);
}

function getBankAccountLabel(pv: PaymentVoucher): string {
  const ba = pv.bank_account;
  if (!ba) return '-';
  const parts = [ba.bank_name, ba.account_code, ba.account_name].filter(Boolean);
  return parts.join(' \u00b7 ') || '-';
}

function getPaymentMethodLabel(pv: PaymentVoucher): string {
  if (pv.payment_method === 'others') {
    return pv.payment_method_other || 'Others';
  }
  return AP_PAYMENT_METHOD_LABELS[pv.payment_method] || pv.payment_method;
}

interface KeyValue {
  label: string;
  value: string;
}

/**
 * Render a labelled key/value list in two columns.
 * Returns the Y-coordinate immediately below the rendered block.
 */
function drawTwoColumnInfo(
  doc: jsPDF,
  startY: number,
  pageWidth: number,
  margin: number,
  left: KeyValue[],
  right: KeyValue[],
): number {
  const colGap = 8;
  const colWidth = (pageWidth - margin * 2 - colGap) / 2;
  const labelWidth = 32; // mm reserved for label
  const lineHeight = 5.2;
  const blockPadY = 3;

  const rows = Math.max(left.length, right.length);
  const blockHeight = rows * lineHeight + blockPadY * 2;

  // Subtle background panel
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, startY, pageWidth - margin * 2, blockHeight, 1.5, 1.5, 'FD');

  const drawCol = (entries: KeyValue[], colX: number) => {
    let y = startY + blockPadY + 3.5;
    const maxValueWidth = colWidth - labelWidth - 4;
    for (const entry of entries) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(entry.label.toUpperCase(), colX + 2, y);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);

      // Truncate-with-ellipsis if too long (preserves single-line row heights).
      let value = entry.value || '-';
      if (doc.getTextWidth(value) > maxValueWidth) {
        const ellipsis = '\u2026';
        while (value.length > 1 && doc.getTextWidth(value + ellipsis) > maxValueWidth) {
          value = value.slice(0, -1);
        }
        value = value.trimEnd() + ellipsis;
      }
      doc.text(value, colX + labelWidth, y);

      y += lineHeight;
    }
  };

  drawCol(left, margin);
  drawCol(right, margin + colWidth + colGap);

  doc.setTextColor(0, 0, 0);
  return startY + blockHeight;
}

/**
 * Render the urgent badge. Returns the Y-coordinate below it.
 * Red-on-white badge — high contrast, conventional for "urgent" labelling.
 */
function drawUrgentBadge(doc: jsPDF, centerX: number, y: number): number {
  const text = 'URGENT';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const textWidth = doc.getTextWidth(text);
  const padX = 4;
  const padY = 2;
  const boxW = textWidth + padX * 2 + 6; // +6 for the marker
  const boxH = 5.5;
  const boxX = centerX - boxW / 2;

  doc.setFillColor(220, 38, 38); // red-600
  doc.setDrawColor(220, 38, 38);
  doc.roundedRect(boxX, y, boxW, boxH, 1, 1, 'FD');

  doc.setTextColor(255, 255, 255);
  doc.text(`! ${text}`, centerX, y + boxH - padY, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  return y + boxH;
}

/**
 * Render a single PV starting at the doc's *current* page.
 * Caller is responsible for `addPage()` between PVs in bulk mode.
 */
function renderPvPage(doc: jsPDF, pv: PaymentVoucher): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const companyName = pv.company?.name || 'Tidal Portal';
  const subtitle = pv.company?.code
    ? `${pv.company.code} \u00b7 Finance \u00b7 Payment Voucher`
    : 'Finance \u00b7 Payment Voucher';

  // Branded header
  createHeader(doc, companyName, subtitle);

  // Title
  let cursorY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('PAYMENT VOUCHER', pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 2;

  // Status pill (small, under title, centered)
  const statusLabel = AP_PV_STATUS_LABELS[pv.status] || pv.status;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: ${statusLabel.toUpperCase()}`, pageWidth / 2, cursorY + 4, {
    align: 'center',
  });
  cursorY += 6;

  // Urgent badge (centered, red)
  if (pv.priority === 'urgent') {
    cursorY = drawUrgentBadge(doc, pageWidth / 2, cursorY + 2) + 1;
  }

  // Two-column info block
  cursorY += 3;
  const left: KeyValue[] = [
    { label: 'PV No', value: pv.pv_number || 'Draft' },
    { label: 'Date', value: safeDate(pv.payment_date) },
    { label: 'Status', value: statusLabel },
    { label: 'Reference No', value: pv.reference_no || '-' },
  ];
  const right: KeyValue[] = [
    { label: 'Pay To', value: pv.pay_to || pv.supplier?.supplier_name || '-' },
    { label: 'Pay For', value: pv.pay_for || '-' },
    { label: 'Bank Account', value: getBankAccountLabel(pv) },
    { label: 'Payment Method', value: getPaymentMethodLabel(pv) },
  ];

  cursorY = drawTwoColumnInfo(doc, cursorY, pageWidth, margin, left, right) + 4;

  // Line items table
  const sortedLines = [...(pv.lines || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
  const lineTotal = sortedLines.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  if (sortedLines.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Description', 'GL Account', 'Cheque No', 'Amount (RM)']],
      body: sortedLines.map((line) => [
        safeDate(line.line_date, 'dd-MM-yyyy'),
        line.description || '',
        line.gl_account
          ? `${line.gl_account.account_code} \u2014 ${line.gl_account.account_name}`
          : '',
        line.cheque_no || '',
        fmtAmount(line.amount),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: {
        fillColor: [15, 118, 110], // teal-700 — matches existing PDFs
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 50 },
        3: { cellWidth: 22 },
        4: { cellWidth: 26, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 4;
  }

  // Allocations table
  const allocations = pv.allocations || [];
  const allocationTotal = allocations.reduce(
    (sum, a) => sum + Number(a.allocated_amount || 0),
    0,
  );

  if (allocations.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Invoice No', 'Allocated Amount (RM)']],
      body: allocations.map((alloc) => [
        alloc.ap_invoice?.invoice_number || alloc.ap_invoice_id,
        fmtAmount(alloc.allocated_amount),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: {
        fillColor: [30, 64, 175], // blue-800 — distinguish from line items
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 4;
  }

  // Totals block (right-aligned)
  const totalsX = pageWidth - margin;
  const totalsLabelX = totalsX - 60;
  const totalsLines: Array<{ label: string; value: string; bold?: boolean }> = [];
  if (lineTotal > 0) {
    totalsLines.push({ label: 'Line Total', value: fmtMoney(lineTotal) });
  }
  if (allocationTotal > 0) {
    totalsLines.push({ label: 'Allocation Total', value: fmtMoney(allocationTotal) });
  }
  totalsLines.push({
    label: 'GRAND TOTAL',
    value: fmtMoney(Number(pv.total_amount || 0)),
    bold: true,
  });

  // Background panel for totals
  const totalsHeight = totalsLines.length * 6 + 4;
  const totalsBoxX = totalsLabelX - 4;
  const totalsBoxY = cursorY;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.2);
  doc.roundedRect(
    totalsBoxX,
    totalsBoxY,
    totalsX - totalsBoxX + 1,
    totalsHeight,
    1.5,
    1.5,
    'FD',
  );

  let totalsY = cursorY + 5;
  for (const row of totalsLines) {
    if (row.bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
    }
    doc.text(row.label, totalsLabelX, totalsY);
    doc.text(row.value, totalsX, totalsY, { align: 'right' });
    totalsY += 6;
  }
  doc.setTextColor(0, 0, 0);
  cursorY = totalsBoxY + totalsHeight + 8;

  // Signature block — anchored near the bottom of the page so layout
  // stays consistent regardless of how many lines/allocations there are.
  const sigY = Math.max(cursorY, pageHeight - 38);

  const sigColWidth = (pageWidth - margin * 2) / 3;
  const sigLabels = [
    { label: 'Prepared by', name: '' },
    { label: 'Checked by', name: '' },
    { label: 'Approved by', name: '' },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  for (let i = 0; i < sigLabels.length; i++) {
    const colX = margin + sigColWidth * i;
    const colCenter = colX + sigColWidth / 2;

    // Signature line
    const lineY = sigY + 12;
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(colX + 8, lineY, colX + sigColWidth - 8, lineY);

    // Name (if any)
    if (sigLabels[i].name) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(sigLabels[i].name, colCenter, lineY + 4, { align: 'center' });
    }

    // Role label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(sigLabels[i].label, colCenter, lineY + 9, { align: 'center' });

    // Date line
    doc.setFontSize(7.5);
    doc.text('Date: ___________________', colCenter, lineY + 14, { align: 'center' });
  }

  // Footer
  const footerY = pageHeight - 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const generatedOn = format(new Date(), 'dd MMM yyyy, HH:mm');
  doc.text(
    `Generated from Tidal Portal on ${generatedOn}`,
    pageWidth / 2,
    footerY,
    { align: 'center' },
  );

  // Page label (right side of footer)
  const pageInfo = doc.getCurrentPageInfo();
  const totalPages = doc.getNumberOfPages();
  doc.text(
    `Page ${pageInfo.pageNumber} of ${totalPages}`,
    pageWidth - margin,
    footerY,
    { align: 'right' },
  );

  // PV identifier on left footer for paper-trail
  doc.text(`PV ${pv.pv_number || pv.id}`, margin, footerY, { align: 'left' });

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

/**
 * After all PV pages are rendered, walk the pages and rewrite the
 * "Page X of Y" footer so totals are correct (jsPDF doesn't recompute).
 */
function fixPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerY = pageHeight - 8;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Mask the previous page number with a white rectangle
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - margin - 30, footerY - 4, 30, 5, 'F');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, {
      align: 'right',
    });
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generatePvPdf(pv: PaymentVoucher): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderPvPage(doc, pv);
  fixPageNumbers(doc);

  const filename = pv.pv_number
    ? `pv-${pv.pv_number}.pdf`
    : `pv-draft-${pv.id}.pdf`;
  doc.save(filename);
}

export async function generatePvBulkPdf(pvs: PaymentVoucher[]): Promise<void> {
  if (!pvs.length) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pvs.forEach((pv, index) => {
    if (index > 0) doc.addPage();
    renderPvPage(doc, pv);
  });
  fixPageNumbers(doc);

  const today = format(new Date(), 'yyyyMMdd');
  doc.save(`payment-vouchers-bulk-${today}.pdf`);
}
