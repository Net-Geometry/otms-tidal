import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import tidalLogo from '@/assets/tidal-logo.png';

interface HRReportData {
  companyInfo: {
    name: string;
    registrationNo: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  period: string;
  generatedDate: string;
  summary: {
    totalHours: number;
    totalCost: number;
    totalEmployees: number;
    totalCompanies: number;
  };
  companyGroups: Array<{
    companyId: string;
    companyName: string;
    companyCode: string;
    employees: Array<{
      employee_no: string;
      employee_name: string;
      department: string;
      position: string;
      total_ot_hours: number;
      amount: number;
    }>;
    stats: {
      totalEmployees: number;
      totalHours: number;
      totalCost: number;
    };
  }>;
}

interface CombinedReportData {
  companyInfo: {
    name: string;
    registrationNo: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  period: string;
  generatedDate: string;
  summary: {
    totalHours: number;
    totalCost: number;
    totalEmployees: number;
    totalCompanies: number;
  };
  employees: Array<{
    company_name: string;
    company_code: string;
    employee_no: string;
    employee_name: string;
    department: string;
    position: string;
    total_ot_hours: number;
    amount: number;
  }>;
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
  } catch (error) {
    console.error('Failed to load image:', error);
    return null;
  }
}

export async function generateHRReportPDF(data: HRReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const style = createPayslipReportStyle(doc);
  let yPos = await drawPayslipStyleHeader(doc, data.companyInfo, style);

  yPos = drawReportTitle(doc, 'Overtime Summary Report', data.period, yPos, style);
  yPos = drawSummaryBox(doc, data.summary, yPos, style);
  yPos = drawReportSectionHeader(doc, 'Employee Overtime Details by Company', yPos + 8, style);

  data.companyGroups.forEach((company) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...style.black);
    doc.text(`${company.companyName} (${company.companyCode})`, style.left, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Employee No', 'Name', 'Department', 'Position', 'OT Hours', 'Amount (RM)']],
      body: company.employees.map(emp => [
        emp.employee_no,
        emp.employee_name,
        emp.department,
        emp.position,
        emp.total_ot_hours.toFixed(2),
        fmt(emp.amount),
      ]),
      foot: [[
        { content: `${company.companyName} Subtotal`, colSpan: 4, styles: { fontStyle: 'bold' as const } },
        { content: company.stats.totalHours.toFixed(2), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: fmt(company.stats.totalCost), styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: style.primary } },
      ]],
      ...getPayslipTableOptions(style),
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 58 },
        2: { cellWidth: 52 },
        3: { cellWidth: 48 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 32, halign: 'right' },
      },
    });

    yPos = getFinalTableY(doc) + 12;
  });

  drawReportFooter(doc, data.generatedDate, style);

  const fileName = `HR_OT_Report_${data.period.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

export async function generateCombinedReportPDF(data: CombinedReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const style = createPayslipReportStyle(doc);
  let yPos = await drawPayslipStyleHeader(doc, data.companyInfo, style);

  yPos = drawReportTitle(doc, 'Overtime Summary Report (Combined)', data.period, yPos, style);
  yPos = drawSummaryBox(doc, data.summary, yPos, style);
  yPos = drawReportSectionHeader(doc, 'Employee Overtime Details', yPos + 8, style);

  // Grand total values for footer row
  const grandTotalHours = data.employees.reduce((sum, emp) => sum + emp.total_ot_hours, 0);
  const grandTotalAmount = data.employees.reduce((sum, emp) => sum + emp.amount, 0);

  autoTable(doc, {
    startY: yPos,
    head: [['Company', 'Employee No', 'Name', 'Department', 'Position', 'OT Hours', 'Amount (RM)']],
    body: [
      ...data.employees.map(emp => [
        `${emp.company_name} (${emp.company_code})`,
        emp.employee_no,
        emp.employee_name,
        emp.department,
        emp.position,
        emp.total_ot_hours.toFixed(2),
        fmt(emp.amount)
      ]),
      [
        { content: 'Grand Total', colSpan: 5, styles: { fontStyle: 'bold' as const } },
        { content: grandTotalHours.toFixed(2), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: fmt(grandTotalAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: style.primary } },
      ]
    ],
    ...getPayslipTableOptions(style),
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 28 },
      2: { cellWidth: 45 },
      3: { cellWidth: 42 },
      4: { cellWidth: 38 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' }
    },
  });

  drawReportFooter(doc, data.generatedDate, style);

  const fileName = `OT_Report_Combined_${data.companyInfo.name.replace(/\s+/g, '_')}_${data.period.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

function createPayslipReportStyle(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 24;
  const right = pageWidth - 24;

  return {
    primary: [47, 182, 201] as [number, number, number],
    black: [34, 34, 34] as [number, number, number],
    gray: [119, 119, 119] as [number, number, number],
    border: [230, 230, 230] as [number, number, number],
    lightBg: [232, 250, 251] as [number, number, number],
    pageWidth,
    pageHeight,
    left,
    right,
    footerY: pageHeight - 22,
  };
}

async function drawPayslipStyleHeader(
  doc: jsPDF,
  companyInfo: HRReportData['companyInfo'],
  style: ReturnType<typeof createPayslipReportStyle>
): Promise<number> {
  const y = 18;
  const logoSize = 26;
  const logoCenterX = style.left + 17;
  const logoUrl = companyInfo.logoUrl || tidalLogo;
  const logoData = await loadImageFromUrl(logoUrl);

  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', logoCenterX - logoSize / 2, y, logoSize, logoSize);
    } catch {
      drawLogoPlaceholder(doc, style.left, y, 35, companyInfo.name);
    }
  } else {
    drawLogoPlaceholder(doc, style.left, y, 35, companyInfo.name);
  }

  const textY = y + logoSize + 3;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 80, 120);
  doc.text('T I D A L', logoCenterX, textY, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('group', logoCenterX, textY + 4, { align: 'center' });

  const infoX = style.left + 47;
  const maxW = style.right - infoX;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...style.black);
  doc.text(companyInfo.name.toUpperCase(), infoX, y + 8);

  let infoY = y + 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...style.gray);
  if (companyInfo.registrationNo) {
    doc.text(`(${companyInfo.registrationNo})`, infoX, infoY);
    infoY += 4;
  }
  if (companyInfo.address) {
    const addressLines = doc.splitTextToSize(companyInfo.address, maxW);
    doc.text(addressLines, infoX, infoY);
    infoY += addressLines.length * 4;
  }
  if (companyInfo.phone) {
    doc.text(`Telephone No. ${companyInfo.phone}`, infoX, infoY);
  }

  return 68;
}

function drawReportTitle(
  doc: jsPDF,
  title: string,
  period: string,
  y: number,
  style: ReturnType<typeof createPayslipReportStyle>
): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...style.black);
  doc.text(title, style.left, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...style.gray);
  const periodLabel = 'Period: ';
  const periodLabelWidth = doc.getTextWidth(periodLabel);
  doc.text(periodLabel, style.right - doc.getTextWidth(period) - periodLabelWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...style.black);
  doc.text(period, style.right, y, { align: 'right' });

  return y + 10;
}

function drawSummaryBox(
  doc: jsPDF,
  summary: HRReportData['summary'],
  y: number,
  style: ReturnType<typeof createPayslipReportStyle>
): number {
  const boxWidth = 62;
  const boxHeight = 20;
  const boxGap = 8;
  const startX = style.right - (boxWidth * 2 + boxGap);

  drawMetricBox(doc, 'TOTAL OT HOURS', summary.totalHours.toFixed(2), startX, y, boxWidth, boxHeight, style);
  drawMetricBox(doc, 'TOTAL OT COST', `RM ${fmt(summary.totalCost)}`, startX + boxWidth + boxGap, y, boxWidth, boxHeight, style);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...style.gray);
  doc.text(`Employees: ${summary.totalEmployees}   Companies: ${summary.totalCompanies}`, style.left, y + 12);

  return y + boxHeight + 10;
}

function drawMetricBox(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ReturnType<typeof createPayslipReportStyle>
): void {
  doc.setFillColor(...style.lightBg);
  doc.setDrawColor(...style.primary);
  doc.setLineWidth(1.2);
  doc.roundedRect(x, y - 4, width, height, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...style.primary);
  doc.text(label, x + width / 2, y + 3, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(...style.black);
  doc.text(value, x + width / 2, y + 11, { align: 'center' });
}

function drawReportSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  style: ReturnType<typeof createPayslipReportStyle>
): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...style.primary);
  doc.text(title, style.left, y);
  y += 2;
  doc.setDrawColor(...style.black);
  doc.setLineWidth(0.3);
  doc.line(style.left, y, style.right, y);
  return y + 7;
}

function getPayslipTableOptions(style: ReturnType<typeof createPayslipReportStyle>) {
  return {
    theme: 'plain' as const,
    margin: { left: style.left, right: style.pageWidth - style.right },
    tableWidth: style.right - style.left,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      lineColor: style.border,
      lineWidth: 0.1,
      textColor: style.black,
    },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: style.black,
      fontStyle: 'bold' as const,
      lineColor: style.black,
      lineWidth: { bottom: 0.3 },
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    footStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: style.black,
      lineColor: style.black,
      lineWidth: { top: 0.3 },
    },
  };
}

function drawReportFooter(
  doc: jsPDF,
  generatedDate: string,
  style: ReturnType<typeof createPayslipReportStyle>
): void {
  const footerY = style.footerY;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...style.gray);
  doc.text('This report is computer generated. No signature is required.', style.pageWidth / 2, footerY, { align: 'center' });

  const printedOnLabel = 'Printed on: ';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const labelWidth = doc.getTextWidth(printedOnLabel);
  doc.setFont('helvetica', 'bold');
  const dateWidth = doc.getTextWidth(generatedDate);
  const startX = (style.pageWidth - labelWidth - dateWidth) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...style.gray);
  doc.text(printedOnLabel, startX, footerY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...style.black);
  doc.text(generatedDate, startX + labelWidth, footerY + 10);
}

function getFinalTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;
}

function fmt(value: number): string {
  return Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawLogoPlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  companyName: string
): void {
  // Draw circle
  doc.setFillColor(20, 184, 166);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'F');

  // Draw company initials
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const initials = companyName
    .split(' ')
    .map(word => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  doc.text(initials, x + size / 2, y + size / 2 + 4, { align: 'center' });
}
