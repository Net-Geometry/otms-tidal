import jsPDF from 'jspdf';

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

// ===== FULL PAYROLL PAYSLIP (Phase 6 enhancement) =====

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
    department: string;
    epfNo: string;
    socsoNo: string;
    incomeTaxNo: string;
    bankName: string;
    bankAccountNo: string;
  };
  period: string;
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
  const border: [number, number, number] = [230, 230, 230];
  const lightBg: [number, number, number] = [232, 250, 251];

  const left = 24;
  const right = 24;
  const pw = 210;
  const cw = pw - left - right;
  let y = 18;

  // Header
  drawLogoPlaceholder(doc, left, y, 30, data.company.name);

  const infoX = left + 45;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(data.company.name, infoX, y + 10);

  if (data.company.registration_no) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(`(${data.company.registration_no})`, infoX, y + 17);
  }

  // Employee info
  y = 55;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(data.employee.name, left, y);

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text(`Employee No: ${data.employee.employeeNo}`, left, y);
  doc.text(`Period: ${data.period}`, pw - right, y, { align: 'right' });

  y += 7;
  doc.text(`Department: ${data.employee.department}`, left, y);

  y += 5;
  doc.setFontSize(9);
  const ids = [
    data.employee.epfNo && `EPF: ${data.employee.epfNo}`,
    data.employee.socsoNo && `SOCSO: ${data.employee.socsoNo}`,
    data.employee.incomeTaxNo && `Tax: ${data.employee.incomeTaxNo}`,
  ].filter(Boolean).join('   |   ');
  if (ids) doc.text(ids, left, y);

  if (data.employee.bankName) {
    y += 4;
    doc.text(`Bank: ${data.employee.bankName}  A/C: ${data.employee.bankAccountNo}`, left, y);
  }

  // NET PAY box
  const boxW = 55, boxH = 22, boxX = pw - right - boxW, boxY = 55;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.5);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  doc.text('NET PAY', boxX + boxW / 2, boxY + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(`RM ${fmt(data.item.net_salary)}`, boxX + boxW / 2, boxY + 17, { align: 'center' });

  // === EARNINGS ===
  y += 12;
  y = drawSectionHeader(doc, 'Earnings', y, left, pw - right, primary, border);

  const earnings: [string, number][] = [];
  if (data.item.is_pro_rated) {
    earnings.push(['Basic Salary (Pro-rated)', data.item.pro_rated_salary]);
  } else {
    earnings.push(['Basic Salary', data.item.basic_salary]);
  }
  if (data.item.ot_amount > 0) earnings.push(['Overtime Pay', data.item.ot_amount]);
  if (data.item.is_director && data.item.director_fee > 0) earnings.push(['Director Fee', data.item.director_fee]);

  // Allowances
  for (const a of data.item.payroll_item_allowances || []) {
    if (a.amount > 0) earnings.push([a.allowance_type?.name || 'Allowance', a.amount]);
  }

  const totalEarnings = earnings.reduce((s, [, v]) => s + v, 0);

  for (const [label, amount] of earnings) {
    y = drawRow(doc, label, amount, y, left, pw - right, black);
  }
  y = drawTotalRow(doc, 'Total Earnings', totalEarnings, y, left, pw - right, primary, lightBg);

  // === DEDUCTIONS ===
  y += 4;
  y = drawSectionHeader(doc, 'Deductions', y, left, pw - right, primary, border);

  const deductions: [string, number][] = [];
  if (data.item.employee_epf > 0) deductions.push(['Employee EPF', data.item.employee_epf]);
  if (data.item.employee_socso > 0) deductions.push(['Employee SOCSO', data.item.employee_socso]);
  if (data.item.employee_eis > 0) deductions.push(['Employee EIS', data.item.employee_eis]);
  if (data.item.pcb_amount > 0) deductions.push(['PCB / MTD', data.item.pcb_amount]);
  // Dynamic deductions from junction table
  for (const d of data.item.payroll_item_deductions || []) {
    if (d.amount > 0) {
      const label = d.deduction_type?.name || 'Other';
      deductions.push([label, d.amount]);
    }
  }
  if (data.item.unpaid_leave_deduction > 0) deductions.push(['Unpaid Leave', data.item.unpaid_leave_deduction]);

  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);

  for (const [label, amount] of deductions) {
    y = drawRow(doc, label, amount, y, left, pw - right, black);
  }
  y = drawTotalRow(doc, 'Total Deductions', totalDed, y, left, pw - right, [220, 50, 50], [255, 240, 240]);

  // === EMPLOYER CONTRIBUTIONS ===
  y += 4;
  y = drawSectionHeader(doc, 'Employer Contributions (Informational)', y, left, pw - right, gray, border);

  const employer: [string, number][] = [];
  if (data.item.employer_epf > 0) employer.push(['Employer EPF', data.item.employer_epf]);
  if (data.item.employer_socso > 0) employer.push(['Employer SOCSO', data.item.employer_socso]);
  if (data.item.employer_eis > 0) employer.push(['Employer EIS', data.item.employer_eis]);
  if (data.item.employer_hrdc > 0) employer.push(['HRDC', data.item.employer_hrdc]);

  for (const [label, amount] of employer) {
    y = drawRow(doc, label, amount, y, left, pw - right, gray);
  }

  // Footer
  const footerY = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, left, footerY);
  doc.text('This is a computer-generated payslip.', pw / 2, footerY, { align: 'center' });

  const fileName = `payslip_${data.employee.employeeNo}_${data.period.replace('/', '-')}.pdf`;
  doc.save(fileName);
}

function fmt(n: number): string {
  return Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawSectionHeader(
  doc: jsPDF, title: string, y: number,
  left: number, right: number,
  color: [number, number, number], borderColor: [number, number, number]
): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(title, left, y);
  y += 2;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  return y + 6;
}

function drawRow(
  doc: jsPDF, label: string, amount: number, y: number,
  left: number, right: number, color: [number, number, number]
): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...color);
  doc.text(label, left + 2, y);
  doc.text(`RM ${fmt(amount)}`, right, y, { align: 'right' });
  return y + 6;
}

function drawTotalRow(
  doc: jsPDF, label: string, amount: number, y: number,
  left: number, right: number,
  color: [number, number, number], bg: [number, number, number]
): number {
  doc.setFillColor(...bg);
  doc.rect(left, y - 4, right - left, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(label, left + 2, y);
  doc.text(`RM ${fmt(amount)}`, right, y, { align: 'right' });
  return y + 8;
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
