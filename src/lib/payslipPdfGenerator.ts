import jsPDF from 'jspdf';
import tidalLogo from '@/assets/tidal-logo.png';

export interface PayslipData {
  company: {
    name: string;
    registration_no: string;
    address: string;
    phone: string;
    logo_url: string | null;
  };
  employee: {
    employee_no: string;
    full_name: string;
    ic_no: string | null;
    department: string;
    position: string;
  };
  period: {
    display: string;
    month: number;
    year: number;
  };
  overtime: {
    amount: number;
    hours: number;
  };
  generatedDate: string;
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

export async function generatePayslipPDF(data: PayslipData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Color scheme - Teal theme
  const primaryColor: [number, number, number] = [47, 182, 201]; // #2FB6C9 - for accents
  const blackColor: [number, number, number] = [34, 34, 34]; // #222 - for company name
  const textColor: [number, number, number] = [34, 34, 34]; // #222
  const grayColor: [number, number, number] = [119, 119, 119]; // #777
  const borderColor: [number, number, number] = [230, 230, 230]; // #E6E6E6
  const lightTealBg: [number, number, number] = [232, 250, 251]; // #E8FAFB

  let yPos = 18; // 18mm top margin
  const leftMargin = 24; // 24mm left margin
  const rightMargin = 24; // 24mm right margin
  const pageWidth = 210;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // ===== HEADER SECTION =====
  
  // Company logo (left side)
  const logoSize = 35; // 35mm x 35mm
  
  if (data.company.logo_url) {
    const imageData = await loadImageFromUrl(data.company.logo_url);
    if (imageData) {
      try {
        doc.addImage(imageData, 'PNG', leftMargin, yPos, logoSize, logoSize);
      } catch (error) {
        console.error('Failed to add image to PDF:', error);
        drawLogoPlaceholder(doc, leftMargin, yPos, logoSize, data.company.name);
      }
    } else {
      drawLogoPlaceholder(doc, leftMargin, yPos, logoSize, data.company.name);
    }
  } else {
    drawLogoPlaceholder(doc, leftMargin, yPos, logoSize, data.company.name);
  }

  // Company info (right side)
  const companyInfoX = leftMargin + logoSize + 15;
  const maxTextWidth = pageWidth - companyInfoX - rightMargin; // ~112mm
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  const companyNameLines = doc.splitTextToSize(data.company.name, maxTextWidth);
  doc.text(companyNameLines, companyInfoX, yPos + 8);
  
  // Calculate height of company name (in case it wrapped)
  const nameHeight = companyNameLines.length * 7; // 7mm per line for 16pt font
  
  yPos += Math.max(14, nameHeight + 6); // More spacing after company name
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  const regNoLines = doc.splitTextToSize(
    `(Registration No. ${data.company.registration_no})`,
    maxTextWidth
  );
  doc.text(regNoLines, companyInfoX, yPos);
  
  // Calculate height of registration number
  const regNoHeight = regNoLines.length * 5; // 5mm per line for 10pt font
  
  yPos += Math.max(6, regNoHeight + 2); // Dynamic spacing
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  const addressUpper = data.company.address.toUpperCase();
  doc.text(addressUpper, companyInfoX, yPos, { maxWidth: maxTextWidth });
  
  yPos += 10;
  doc.setFontSize(9);
  doc.text(`Telephone No. ${data.company.phone}`, companyInfoX, yPos);

  // ===== EMPLOYEE SUMMARY ROW =====
  yPos = 75; // Fixed position after header
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  doc.text(data.employee.full_name, leftMargin, yPos);
  
  yPos += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(`(Employee No: ${data.employee.employee_no})`, leftMargin, yPos);

  // Period (right aligned)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text('Period: ', pageWidth - rightMargin - 45, yPos);
  doc.setTextColor(...blackColor);
  doc.text(data.period.display, pageWidth - rightMargin, yPos, { align: 'right' });

  // ===== EMPLOYEE DETAILS (Left) & NET PAY BOX (Right) =====
  yPos += 10;
  const detailsStartY = yPos;
  
  // Employee details - left column
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...blackColor);
  
  doc.text(`Position: ${data.employee.position}`, leftMargin, yPos);
  yPos += 7;
  doc.text(`Dept: ${data.employee.department}`, leftMargin, yPos);
  yPos += 7;
  const icNo = data.employee.ic_no || 'Not Provided';
  doc.text(`IC/Passport: ${icNo}`, leftMargin, yPos);

  // NET PAY box - right side
  const boxWidth = 55;
  const boxHeight = 24;
  const boxX = pageWidth - rightMargin - boxWidth;
  const boxY = detailsStartY - 2;

  // Draw NET PAY box with teal border and light background
  doc.setFillColor(...lightTealBg);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'FD');

  // NET PAY label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('NET PAY', boxX + boxWidth / 2, boxY + 9, { align: 'center' });

  // Amount
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  const amountText = `RM ${data.overtime.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(amountText, boxX + boxWidth / 2, boxY + 18, { align: 'center' });

  // ===== EARNINGS SECTION =====
  yPos += 18;
  
  // Section title (left) and subtitle (right)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Employee Earnings/Reimbursements', leftMargin, yPos);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text('Current', pageWidth - rightMargin, yPos, { align: 'right' });
  
  yPos += 2;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);

  // Overtime Pay row - clean layout without borders
  yPos += 9;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...blackColor);
  
  doc.text('Overtime Pay', leftMargin, yPos);
  const overtimeAmount = `RM ${data.overtime.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(overtimeAmount, pageWidth - rightMargin, yPos, { align: 'right' });

  // ===== FOOTER =====
  const footerY = 280; // Fixed position near bottom
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  
  // Generated date on left
  doc.text(`Generated: ${data.generatedDate}`, leftMargin, footerY);
  
  // Computer-generated message centered
  const footerText = 'This is a computer-generated payslip.';
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // ===== SAVE PDF =====
  const fileName = `payslip_${data.employee.employee_no}_${data.period.display.replace(' ', '_')}.pdf`;
  doc.save(fileName);
}

// ===== FULL PAYROLL PAYSLIP =====

export interface FullPayslipData {
  company: {
    name: string;
    registration_no?: string;
    address?: string;
    phone?: string;
    logo_url?: string | null;
  };
  employee: {
    name: string;
    employeeNo: string;
    position: string;
    department: string;
    icNo: string;
    epfNo: string;
    socsoNo: string;
    incomeTaxNo: string;
    bankName: string;
    bankAccountNo: string;
  };
  period: string;
  showAllowance?: boolean;
  item: {
    basic_salary: number;
    pro_rated_salary: number;
    is_pro_rated: boolean;
    gross_salary: number;
    ot_amount: number;
    director_fee: number;
    is_director: boolean;
    employee_epf: number;
    employee_socso: number;
    employee_eis: number;
    employer_epf: number;
    employer_socso: number;
    employer_eis: number;
    employer_hrdc: number;
    pcb_amount: number;
    unpaid_leave_deduction: number;
    total_allowances: number;
    total_deductions: number;
    net_salary: number;
    payroll_item_allowances?: { amount: number; allowance_type?: { name: string } }[];
    payroll_item_deductions?: { amount: number; deduction_type?: { name: string } }[];
  };
}

export async function generateFullPayslipPDF(data: FullPayslipData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primary: [number, number, number] = [47, 182, 201];
  const black: [number, number, number] = [34, 34, 34];
  const gray: [number, number, number] = [119, 119, 119];
  const lightBg: [number, number, number] = [232, 250, 251];
  const left = 24;
  const rightEdge = 210 - 24;
  const pw = 210;
  let y = 18;

  // ===== COMPANY HEADER =====
  const logoImgSize = 26; // swirl image
  const logoUrl = data.company.logo_url || tidalLogo;
  const logoData = await loadImageFromUrl(logoUrl);
  const logoCenterX = left + 17; // center of the logo area
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', logoCenterX - logoImgSize / 2, y, logoImgSize, logoImgSize);
    } catch {
      drawLogoPlaceholder(doc, left, y, 35, data.company.name);
    }
  } else {
    drawLogoPlaceholder(doc, left, y, 35, data.company.name);
  }
  // Draw "TIDAL" and "group" text below the swirl
  const textY = y + logoImgSize + 3;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 80, 120);
  doc.text('T I D A L', logoCenterX, textY, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('group', logoCenterX, textY + 4, { align: 'center' });

  const infoX = left + 47; // after logo area (swirl + text)
  const maxW = rightEdge - infoX;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(data.company.name.toUpperCase(), infoX, y + 8);

  let hy = y + 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  if (data.company.registration_no) {
    doc.text(`(${data.company.registration_no})`, infoX, hy);
    hy += 4;
  }
  if (data.company.address) {
    const addrLines = doc.splitTextToSize(data.company.address, maxW);
    doc.text(addrLines, infoX, hy);
    hy += addrLines.length * 4;
  }
  if (data.company.phone) {
    doc.text(`Telephone No. ${data.company.phone}`, infoX, hy);
  }

  // ===== EMPLOYEE NAME + PERIOD ROW =====
  y = 68;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(data.employee.name, left, y);

  // "(Employee No: XXX)" inline after name
  const nameWidth = doc.getTextWidth(data.employee.name);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text(` (Employee No: ${data.employee.employeeNo})`, left + nameWidth + 1, y);

  // Period right-aligned
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  const periodLabel = 'Period: ';
  const periodLabelW = doc.getTextWidth(periodLabel);
  doc.text(periodLabel, rightEdge - doc.getTextWidth(data.period) - periodLabelW, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(data.period, rightEdge, y, { align: 'right' });

  // ===== EMPLOYEE DETAILS (2-col) + NET PAY BOX =====
  y += 10;
  const detailY = y;

  // Left column: Position, Dept, IC/Passport
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  doc.text(`Position: ${data.employee.position}`, left, y);
  y += 5;
  doc.text(`Dept: ${data.employee.department}`, left, y);
  y += 5;
  doc.text(`IC/Passport: ${data.employee.icNo || 'N/A'}`, left, y);

  // Right column: EPF No, SOCSO No, Income Tax No
  const col2X = left + 75;
  let ry = detailY;
  doc.text(`EPF No: ${data.employee.epfNo || 'N/A'}`, col2X, ry);
  ry += 5;
  doc.text(`SOCSO No: ${data.employee.socsoNo || 'N/A'}`, col2X, ry);
  ry += 5;
  doc.text(`Income Tax No: ${data.employee.incomeTaxNo || 'N/A'}`, col2X, ry);

  // NET PAY box (right side, aligned with employee details)
  const boxW = 48;
  const boxH = 20;
  const boxX = rightEdge - boxW;
  const boxY = detailY - 3;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.2);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primary);
  doc.text('NET PAY', boxX + boxW / 2, boxY + 7, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(...black);
  doc.text(`RM ${fmt(data.item.net_salary)}`, boxX + boxW / 2, boxY + 15, { align: 'center' });

  // ===== EMPLOYEE EARNINGS/REIMBURSEMENTS =====
  y += 16;
  y = drawPayslipSectionHeader(doc, 'Employee Earnings/Reimbursements', 'Current', y, left, rightEdge, primary);

  const earnings: [string, number][] = [];
  if (data.item.is_pro_rated) {
    earnings.push(['Basic (Pro-rated)', data.item.pro_rated_salary]);
  } else {
    earnings.push(['Basic', data.item.basic_salary]);
  }
  if (data.item.ot_amount > 0) earnings.push(['Overtime Pay', data.item.ot_amount]);
  if (data.item.is_director && data.item.director_fee > 0) earnings.push(['Director Fee', data.item.director_fee]);

  if (data.showAllowance) {
    for (const a of data.item.payroll_item_allowances || []) {
      if (a.amount > 0) earnings.push([a.allowance_type?.name || 'Allowance', a.amount]);
    }
  }

  for (const [label, amount] of earnings) {
    y = drawPayslipRow(doc, label, amount, y, left, rightEdge, black);
  }

  // Gross Pay total — bold black label, teal amount
  y = drawPayslipTotalRow(doc, 'Gross Pay', data.item.gross_salary, y, left, rightEdge, black, primary);

  // ===== EMPLOYEE DEDUCTIONS =====
  y += 14;
  y = drawPayslipSectionHeader(doc, 'Employee Deductions', 'Current', y, left, rightEdge, primary);

  // Always show all statutory deductions (even if 0)
  const deductions: [string, number][] = [
    ['Employee EPF', Number(data.item.employee_epf) || 0],
    ['Employee SOCSO', Number(data.item.employee_socso) || 0],
    ['Tax', Number(data.item.pcb_amount) || 0],
    ['Employee EIS', Number(data.item.employee_eis) || 0],
  ];

  for (const d of data.item.payroll_item_deductions || []) {
    if (d.amount > 0) deductions.push([d.deduction_type?.name || 'Other Deduction', d.amount]);
  }
  if (data.item.unpaid_leave_deduction > 0) deductions.push(['Unpaid Leave', data.item.unpaid_leave_deduction]);

  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);

  for (const [label, amount] of deductions) {
    y = drawPayslipRow(doc, label, amount, y, left, rightEdge, black);
  }

  // Total Deductions — bold black label, teal amount
  y = drawPayslipTotalRow(doc, 'Total Deductions', totalDed, y, left, rightEdge, black, primary);

  // ===== COMPANY CONTRIBUTIONS =====
  y += 14;
  y = drawPayslipSectionHeader(doc, 'Company Contributions', 'Current', y, left, rightEdge, primary);

  // Always show all statutory contributions (even if 0)
  const employer: [string, number][] = [
    ["E'R EPF", Number(data.item.employer_epf) || 0],
    ["E'R SOCSO", Number(data.item.employer_socso) || 0],
    ["E'R EIS", Number(data.item.employer_eis) || 0],
  ];
  if (Number(data.item.employer_hrdc) > 0) employer.push(['HRDC', data.item.employer_hrdc]);

  const totalContrib = employer.reduce((s, [, v]) => s + v, 0);

  for (const [label, amount] of employer) {
    y = drawPayslipRow(doc, label, amount, y, left, rightEdge, black);
  }

  // Total Contributions — bold black label, teal amount
  y = drawPayslipTotalRow(doc, 'Total Contributions', totalContrib, y, left, rightEdge, black, primary);

  // ===== FOOTER =====
  const footerY = 272;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('This payslip is computer generated. No signature is required.', pw / 2, footerY, { align: 'center' });

  const printedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.setFontSize(9);
  const printedOnLabel = 'Printed on: ';
  doc.setFont('helvetica', 'normal');
  const labelW = doc.getTextWidth(printedOnLabel);
  doc.setFont('helvetica', 'bold');
  const dateW = doc.getTextWidth(printedDate);
  const startX = (pw - labelW - dateW) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text(printedOnLabel, startX, footerY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(printedDate, startX + labelW, footerY + 10);

  const fileName = `payslip_${data.employee.employeeNo}_${data.period.replace(/[\s/]/g, '_')}.pdf`;
  doc.save(fileName);
}

// Section header with title on left and "Current" on right, teal underline
function drawPayslipSectionHeader(
  doc: jsPDF, title: string, subtitle: string, y: number,
  left: number, right: number,
  color: [number, number, number]
): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(title, left, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 34, 34);
  doc.text(subtitle, right, y, { align: 'right' });

  y += 2;
  doc.setDrawColor(34, 34, 34);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  return y + 8;
}

// Regular data row
function drawPayslipRow(
  doc: jsPDF, label: string, amount: number, y: number,
  left: number, right: number, color: [number, number, number]
): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...color);
  doc.text(label, left, y);
  doc.text(`RM ${fmt(amount)}`, right, y, { align: 'right' });
  return y + 7;
}

// Bold total row — label in labelColor, amount in amountColor
function drawPayslipTotalRow(
  doc: jsPDF, label: string, amount: number, y: number,
  left: number, right: number,
  labelColor: [number, number, number], amountColor: [number, number, number]
): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  doc.text(label, left, y);
  doc.setTextColor(...amountColor);
  doc.text(`RM ${fmt(amount)}`, right, y, { align: 'right' });
  return y + 7;
}

function fmt(n: number): string {
  return Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper function to draw logo placeholder with company initials
function drawLogoPlaceholder(
  doc: jsPDF, 
  x: number, 
  y: number, 
  size: number, 
  companyName: string
): void {
  // Draw circle
  doc.setFillColor(232, 250, 251); // Light teal background
  doc.setDrawColor(47, 182, 201); // Teal border
  doc.setLineWidth(0.5);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'FD');

  // Get initials from company name
  const words = companyName.split(' ');
  const initials = words
    .filter(word => word.length > 0 && word !== '&')
    .slice(0, 3)
    .map(word => word[0].toUpperCase())
    .join('');

  // Draw initials
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(47, 182, 201); // Teal color
  doc.text(initials, x + size / 2, y + size / 2 + 2.5, { align: 'center' });
}
