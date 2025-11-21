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
