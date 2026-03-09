import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ClaimMemo } from '@/types/claims';

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface ClaimMemoPdfData {
  company: {
    name: string;
    registration_no: string;
    address: string;
    phone: string;
    logo_url: string | null;
  };
  memo: ClaimMemo;
  approvers: {
    prepared_by: { name: string; title: string; department: string } | null;
    reviewed_by: { name: string; title: string; department: string } | null;
    approved_by: { name: string; title: string } | null;
  };
}

async function loadImageFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function generateClaimMemoPDF(data: ClaimMemoPdfData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const textDark: [number, number, number] = [34, 34, 34];
  const textGray: [number, number, number] = [100, 100, 100];

  let yPos = 15;

  // ===== COMPANY HEADER =====
  const logoSize = 22;

  if (data.company.logo_url) {
    const imageData = await loadImageFromUrl(data.company.logo_url);
    if (imageData) {
      try {
        doc.addImage(imageData, 'PNG', margin, yPos, logoSize, logoSize);
      } catch {
        // Skip logo on error
      }
    }
  }

  // Company name and details (right of logo)
  const infoX = margin + logoSize + 6;
  const infoWidth = contentWidth - logoSize - 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(data.company.name.toUpperCase(), infoX, yPos + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textGray);

  const regNo = `(${data.company.registration_no})`;
  doc.text(regNo, infoX + doc.getTextWidth(data.company.name.toUpperCase()) + 3, yPos + 5);

  // Address
  const addressLines = doc.splitTextToSize(data.company.address, infoWidth - 40);
  doc.text(addressLines, infoX, yPos + 11);

  // Phone / Fax / Email on right side
  const rightInfoX = pageWidth - margin;
  doc.text(`Tel     : ${data.company.phone}`, rightInfoX, yPos + 5, { align: 'right' });

  // Separator line
  yPos += Math.max(logoSize, 20) + 4;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 8;

  // ===== PRIVATE & CONFIDENTIAL =====
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text('PRIVATE & CONFIDENTIAL', margin, yPos);

  yPos += 12;

  // ===== TITLE =====
  const monthName = MONTHS[data.memo.pay_period_month];
  const yearStr = String(data.memo.pay_period_year);
  const titleLines = [
    data.company.name.toUpperCase(),
    'STAFF PAYMENT',
    `FOR ${monthName.toUpperCase()} ${yearStr} OVERTIME &`,
    'CLAIMS',
  ];

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);

  for (const line of titleLines) {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 9;
  }

  // Underline below title
  yPos += 2;
  doc.setLineWidth(0.8);
  doc.line(margin + 20, yPos, pageWidth - margin - 20, yPos);

  yPos += 12;

  // ===== DATE / FROM / TO =====
  const now = new Date();
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth() + 1]} ${now.getFullYear()}`;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);

  doc.text(`Date  : ${dateStr}`, margin, yPos);
  yPos += 6;
  doc.text('From : Human Resource Department', margin, yPos);
  yPos += 6;
  doc.text('To      : Account and Finance Department', margin, yPos);

  yPos += 10;

  // ===== ADVISORY TEXT =====
  doc.setFontSize(10);
  doc.text(
    `Please be advised of the ${monthName} ${yearStr} Overtime Payment as follow;`,
    margin,
    yPos
  );

  yPos += 10;

  // ===== MAIN TABLE =====
  const tableData: (string | number)[][] = [];
  let rowNum = 1;

  // Row 1: OT
  if (data.memo.ot_total_amount > 0) {
    tableData.push([
      String(rowNum++),
      `OT (${monthName} ${yearStr})`,
      'RM',
      formatCurrency(data.memo.ot_total_amount),
    ]);
  }

  // Row 2: Allowance
  if (data.memo.allowance_total_amount > 0) {
    tableData.push([
      String(rowNum++),
      'Allowance',
      'RM',
      formatCurrency(data.memo.allowance_total_amount),
    ]);
  }

  // Row 3: Claim
  if (data.memo.total_amount > 0) {
    tableData.push([
      String(rowNum++),
      'Claim',
      'RM',
      formatCurrency(data.memo.total_amount),
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['No', 'Item', '', 'Amount']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: textDark,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: textDark,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 90 },
      2: { cellWidth: 15, halign: 'left' },
      3: { cellWidth: contentWidth - 120, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ===== GRAND TOTAL =====
  const grandTotalX = margin + 105;
  const grandTotalWidth = contentWidth - 105;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total', grandTotalX - 30, yPos + 5);

  // Grand total box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(grandTotalX, yPos, grandTotalWidth, 10);
  doc.setFontSize(10);
  doc.text('RM', grandTotalX + 3, yPos + 7);
  doc.text(
    formatCurrency(data.memo.grand_total),
    grandTotalX + grandTotalWidth - 3,
    yPos + 7,
    { align: 'right' }
  );

  yPos += 20;

  // ===== PAYMENT NOTE =====
  // Calculate payment date (16th of next month)
  const payMonth = data.memo.pay_period_month === 12 ? 1 : data.memo.pay_period_month + 1;
  const payYear = data.memo.pay_period_month === 12
    ? data.memo.pay_period_year + 1
    : data.memo.pay_period_year;
  const payDateStr = `16 ${MONTHS[payMonth]} ${payYear}`;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `The payment to the respective shall be made by ${payDateStr}.`,
    margin,
    yPos
  );

  yPos += 20;

  // ===== SIGNATURE SECTION =====
  const colWidth = contentWidth / 3;
  const col1X = margin;
  const col2X = margin + colWidth;
  const col3X = margin + colWidth * 2;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Prepared By:', col1X, yPos);
  doc.text('Reviewed By:', col2X, yPos);
  doc.text('Approved By', col3X, yPos);

  // Signature lines
  const signLineY = yPos + 28;
  const signLineWidth = colWidth - 15;

  doc.setLineWidth(0.3);
  doc.line(col1X, signLineY, col1X + signLineWidth, signLineY);
  doc.line(col2X, signLineY, col2X + signLineWidth, signLineY);
  doc.line(col3X, signLineY, col3X + signLineWidth, signLineY);

  // Approver names and titles
  const nameY = signLineY + 5;

  if (data.approvers.prepared_by) {
    doc.setFont('helvetica', 'normal');
    doc.text(`(${data.approvers.prepared_by.name})`, col1X, nameY);
    doc.text(data.approvers.prepared_by.title, col1X, nameY + 5);
    doc.text(data.approvers.prepared_by.department, col1X, nameY + 10);
  }

  if (data.approvers.reviewed_by) {
    doc.text(`(${data.approvers.reviewed_by.name})`, col2X, nameY);
    doc.text(data.approvers.reviewed_by.title, col2X, nameY + 5);
    doc.text(data.approvers.reviewed_by.department, col2X, nameY + 10);
  }

  if (data.approvers.approved_by) {
    doc.text(`(${data.approvers.approved_by.name})`, col3X, nameY);
    doc.text(data.approvers.approved_by.title, col3X, nameY + 5);
  }

  // Save
  const fileName = `${data.company.name.replace(/\s+/g, '_')}_Staff_Payment_${monthName}_${yearStr}.pdf`;
  doc.save(fileName);
}
