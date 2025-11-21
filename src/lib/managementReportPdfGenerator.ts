import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ManagementSummaryData {
  company: {
    name: string;
    registration_no: string;
    address: string;
    phone: string;
    logo_url: string | null;
  };
  period: {
    display: string;
  };
  generatedDate: string;
  statistics: {
    totalEmployees: number;
    totalHours: number;
    totalCost: number;
    totalCompanies: number;
  };
  companyGroups: Array<{
    companyId: string;
    companyName: string;
    companyCode: string;
    employees: Array<{
      employeeNo: string;
      name: string;
      department: string;
      position: string;
      otHours: number;
      otAmount: number;
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

export async function generateManagementSummaryPDF(data: ManagementSummaryData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Color scheme - Teal theme (matching payslip)
  const primaryColor: [number, number, number] = [47, 182, 201]; // #2FB6C9
  const blackColor: [number, number, number] = [34, 34, 34]; // #222
  const grayColor: [number, number, number] = [119, 119, 119]; // #777
  const borderColor: [number, number, number] = [230, 230, 230]; // #E6E6E6
  const lightTealBg: [number, number, number] = [232, 250, 251]; // #E8FAFB

  let yPos = 18; // 18mm top margin
  const leftMargin = 24; // 24mm left margin
  const rightMargin = 24; // 24mm right margin
  const pageWidth = 210;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // ===== HEADER SECTION (matching payslip) =====
  
  // Company logo (centered)
  const logoSize = 35; // 35mm x 35mm
  const headerContentWidth = logoSize + 15 + 112; // logo + gap + text area
  const headerStartX = (pageWidth - headerContentWidth) / 2;
  
  if (data.company.logo_url) {
    const imageData = await loadImageFromUrl(data.company.logo_url);
    if (imageData) {
      try {
        doc.addImage(imageData, 'PNG', headerStartX, yPos, logoSize, logoSize);
      } catch (error) {
        console.error('Failed to add image to PDF:', error);
        drawLogoPlaceholder(doc, headerStartX, yPos, logoSize, data.company.name);
      }
    } else {
      drawLogoPlaceholder(doc, headerStartX, yPos, logoSize, data.company.name);
    }
  } else {
    drawLogoPlaceholder(doc, headerStartX, yPos, logoSize, data.company.name);
  }

  // Company info (right side of logo)
  const companyInfoX = headerStartX + logoSize + 15;
  const maxTextWidth = 112; // Fixed width for text area
  
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

  // ===== TITLE ROW (replaces employee name section) =====
  yPos = 75; // Fixed position after header
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  doc.text('OVERTIME SUMMARY REPORT', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text('All Employees', pageWidth / 2, yPos, { align: 'center' });

  // Period (below title, centered)
  yPos += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  const periodLabel = 'Period: ';
  const periodLabelWidth = doc.getTextWidth(periodLabel);
  const periodValueWidth = doc.getTextWidth(data.period.display);
  const totalPeriodWidth = periodLabelWidth + periodValueWidth;
  const periodStartX = (pageWidth - totalPeriodWidth) / 2;
  
  doc.text(periodLabel, periodStartX, yPos);
  doc.setTextColor(...blackColor);
  doc.text(data.period.display, periodStartX + periodLabelWidth, yPos);

  // ===== SUMMARY STATISTICS BOXES (replaces NET PAY box) =====
  yPos += 10;
  const boxStartY = yPos;
  
  const boxWidth = 70;
  const boxHeight = 24;
  const boxGap = 8;
  const totalBoxesWidth = (boxWidth * 2) + boxGap;
  const boxesStartX = (pageWidth - totalBoxesWidth) / 2;
  
  // Left Box - Total Hours
  const hoursBoxX = boxesStartX;
  doc.setFillColor(...lightTealBg);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(hoursBoxX, boxStartY, boxWidth, boxHeight, 2, 2, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL OT HOURS', hoursBoxX + boxWidth / 2, boxStartY + 9, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  const hoursText = `${data.statistics.totalHours.toFixed(1)} hrs`;
  doc.text(hoursText, hoursBoxX + boxWidth / 2, boxStartY + 18, { align: 'center' });
  
  // Right Box - Total Cost
  const costBoxX = hoursBoxX + boxWidth + boxGap;
  doc.setFillColor(...lightTealBg);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(costBoxX, boxStartY, boxWidth, boxHeight, 2, 2, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL OT COST', costBoxX + boxWidth / 2, boxStartY + 9, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blackColor);
  const costText = `RM ${data.statistics.totalCost.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(costText, costBoxX + boxWidth / 2, boxStartY + 18, { align: 'center' });

  // Additional stats below boxes - centered
  yPos = boxStartY + boxHeight + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(`Total Employees: ${data.statistics.totalEmployees} | Companies: ${data.statistics.totalCompanies}`, pageWidth / 2, yPos, { align: 'center' });

  // ===== EMPLOYEE DATA SECTION =====
  yPos += 8;
  
  // Section title - centered
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Employee Overtime Details by Company', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(`For Period ${data.period.display}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 2;
  const lineStartX = leftMargin + 15;
  const lineEndX = pageWidth - rightMargin - 15;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(lineStartX, yPos, lineEndX, yPos);

  yPos += 8;

  // Loop through each company group
  const tableWidth = 155;
  const tableStartX = (pageWidth - tableWidth) / 2;

  for (let i = 0; i < data.companyGroups.length; i++) {
    const company = data.companyGroups[i];
    
    // Add page break if needed (except for first company)
    if (i > 0 && yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Company header
    doc.setFillColor(...lightTealBg);
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(tableStartX, yPos - 2, tableWidth, 10, 2, 2, 'FD');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(
      `${company.companyName} (${company.companyCode})`,
      pageWidth / 2,
      yPos + 5,
      { align: 'center' }
    );
    
    yPos += 12;
    
    // Company employee table
    const tableData = company.employees.map(emp => [
      emp.employeeNo,
      emp.name,
      emp.department,
      emp.position,
      `${emp.otHours.toFixed(1)} hrs`,
      `RM ${emp.otAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Employee No.', 'Name', 'Department', 'Position', 'OT Hours', 'OT Amount']],
      body: tableData,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [34, 34, 34],
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [47, 182, 201],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 'auto' },
      },
      margin: { left: tableStartX, right: pageWidth - tableStartX - tableWidth },
      didDrawPage: (data) => {
        yPos = data.cursor?.y || yPos;
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 2;
    
    // Company subtotal bar
    doc.setFillColor(248, 248, 248);
    doc.rect(tableStartX, yPos, tableWidth, 8, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blackColor);
    doc.text(
      `${company.companyName} Total: ${company.stats.totalEmployees} employees`,
      tableStartX + 5,
      yPos + 5
    );
    doc.text(
      `${company.stats.totalHours.toFixed(1)} hrs`,
      tableStartX + 100,
      yPos + 5,
      { align: 'right' }
    );
    doc.text(
      `RM ${company.stats.totalCost.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
      tableStartX + tableWidth - 5,
      yPos + 5,
      { align: 'right' }
    );
    
    yPos += 15; // Gap before next company
  }

  // ===== FOOTER (matching payslip) =====
  const footerY = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  
  // Generated date on left
  doc.text(`Generated: ${data.generatedDate}`, leftMargin, footerY);
  
  // Computer-generated message centered
  const footerText = 'This is a computer-generated report.';
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // ===== SAVE PDF =====
  const fileName = `Management_OT_Summary_${data.period.display.replace(' ', '_')}.pdf`;
  doc.save(fileName);
}

// Helper function to draw logo placeholder with company initials (matching payslip)
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
