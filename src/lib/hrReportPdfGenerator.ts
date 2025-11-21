import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Color scheme - teal theme
  const primaryColor: [number, number, number] = [20, 184, 166]; // teal-500
  const secondaryColor: [number, number, number] = [45, 212, 191]; // teal-400
  const textDark: [number, number, number] = [31, 41, 55]; // gray-800
  const textLight: [number, number, number] = [107, 114, 128]; // gray-500

  let yPos = margin;

  // ===== HEADER SECTION =====
  // Company logo or placeholder - centered
  const logoSize = 25;
  const headerContentWidth = logoSize + 10 + 120; // logo + gap + text area
  const headerStartX = (pageWidth - headerContentWidth) / 2;
  
  if (data.companyInfo.logoUrl) {
    const logoData = await loadImageFromUrl(data.companyInfo.logoUrl);
    if (logoData) {
      doc.addImage(logoData, 'PNG', headerStartX, yPos, logoSize, logoSize);
    } else {
      drawLogoPlaceholder(doc, headerStartX, yPos, logoSize, data.companyInfo.name);
    }
  } else {
    drawLogoPlaceholder(doc, headerStartX, yPos, logoSize, data.companyInfo.name);
  }

  // Company info
  doc.setFontSize(16);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyInfo.name, headerStartX + logoSize + 10, yPos + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textLight);
  doc.text(`Reg No: ${data.companyInfo.registrationNo}`, headerStartX + logoSize + 10, yPos + 14);
  doc.text(data.companyInfo.address, headerStartX + logoSize + 10, yPos + 19);
  doc.text(`Tel: ${data.companyInfo.phone}`, headerStartX + logoSize + 10, yPos + 24);

  yPos += logoSize + 15;

  // ===== TITLE ROW =====
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('OVERTIME SUMMARY REPORT', pageWidth / 2, yPos + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const periodText = `Period: ${data.period}`;
  const periodWidth = doc.getTextWidth(periodText);
  doc.text(periodText, pageWidth - margin - periodWidth - 5, yPos + 8);

  yPos += 20;

  // ===== SUMMARY STATISTICS =====
  const boxWidth = 75;
  const boxGap = 10;
  const totalBoxesWidth = (boxWidth * 2) + boxGap;
  const boxesStartX = (pageWidth - totalBoxesWidth) / 2;
  const boxHeight = 25;

  // Total OT Hours box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(boxesStartX, yPos, boxWidth, boxHeight, 3, 3, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxesStartX, yPos, boxWidth, boxHeight, 3, 3, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textLight);
  doc.text('Total OT Hours', boxesStartX + boxWidth / 2, yPos + 8, { align: 'center' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(data.summary.totalHours.toFixed(2), boxesStartX + boxWidth / 2, yPos + 18, { align: 'center' });

  // Total OT Cost box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(boxesStartX + boxWidth + boxGap, yPos, boxWidth, boxHeight, 3, 3, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxesStartX + boxWidth + boxGap, yPos, boxWidth, boxHeight, 3, 3, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textLight);
  doc.text('Total OT Cost', boxesStartX + boxWidth + boxGap + boxWidth / 2, yPos + 8, { align: 'center' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`RM ${data.summary.totalCost.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
    boxesStartX + boxWidth + boxGap + boxWidth / 2, yPos + 18, { align: 'center' });

  yPos += boxHeight + 5;

  // Additional stats
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textLight);
  doc.text(`Total Employees: ${data.summary.totalEmployees} | Companies: ${data.summary.totalCompanies}`, 
    pageWidth / 2, yPos + 5, { align: 'center' });

  yPos += 15;

  // ===== EMPLOYEE DATA SECTION =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text('Employee Overtime Details by Company', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;

  // For each company, create a section
  const tableWidth = 185; // Sum of column widths
  const tableStartX = (pageWidth - tableWidth) / 2;
  
  data.companyGroups.forEach((company, index) => {
    // Company header with subtle background - centered
    doc.setFillColor(240, 247, 255); // Light blue background
    doc.roundedRect(tableStartX, yPos - 2, tableWidth, 10, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`${company.companyName} (${company.companyCode})`, pageWidth / 2, yPos + 5, { align: 'center' });
    
    yPos += 13;
    
    // Company employee table - centered
    autoTable(doc, {
      startY: yPos,
      head: [['Employee No', 'Name', 'Department', 'Position', 'OT Hours', 'Amount (RM)']],
      body: company.employees.map(emp => [
        emp.employee_no,
        emp.employee_name,
        emp.department,
        emp.position,
        emp.total_ot_hours.toFixed(2),
        emp.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textDark,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: tableStartX, right: pageWidth - tableStartX - tableWidth },
    });
    
    // Display subtotal row - centered
    yPos = (doc as any).lastAutoTable.finalY + 3;
    
    doc.setFillColor(245, 245, 245);
    doc.rect(tableStartX, yPos, tableWidth, 8, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.text(
      `${company.companyName} Subtotal: ${company.stats.totalHours.toFixed(2)} hours | RM ${company.stats.totalCost.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tableStartX + tableWidth - 5,
      yPos + 5,
      { align: 'right' }
    );
    
    yPos += 15; // Space before next company
  });

  // ===== FOOTER =====
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textLight);
  
  // Generated date on left
  doc.text(`Generated: ${data.generatedDate}`, margin, finalY + 15);
  
  // Computer-generated message centered
  doc.text('This is a computer-generated report. No signature is required.', 
    pageWidth / 2, finalY + 15, { align: 'center' });

  // Save the PDF
  const fileName = `HR_OT_Report_${data.period.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
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
