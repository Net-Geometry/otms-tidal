import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has HR or BOD role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const allowedRoles = ['hr', 'bod', 'admin'];
    const hasAccess = userRoles?.some(r => allowedRoles.includes(r.role));

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { employeeId, month, year } = await req.json();

    if (!employeeId || !month || !year) {
      throw new Error('Missing required parameters');
    }

    // Fetch employee profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        employee_id,
        full_name,
        ic_no,
        epf_no,
        socso_no,
        income_tax_no,
        department_id,
        position_id,
        departments!profiles_department_id_fkey(name),
        positions!profiles_position_id_fkey(title)
      `)
      .eq('id', employeeId)
      .single();

    if (profileError || !profile) {
      throw new Error('Employee not found');
    }

    // Calculate date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Fetch OT requests for the month
    const { data: otRequests, error: otError } = await supabase
      .from('ot_requests')
      .select('ot_date, total_hours, ot_amount, status')
      .eq('employee_id', employeeId)
      .gte('ot_date', startDate)
      .lte('ot_date', endDate)
      .in('status', ['approved', 'reviewed']);

    if (otError) {
      throw new Error('Failed to fetch OT requests');
    }

    const totalOTAmount = otRequests?.reduce((sum, r) => sum + (r.ot_amount || 0), 0) || 0;
    const totalOTHours = otRequests?.reduce((sum, r) => sum + (r.total_hours || 0), 0) || 0;

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const primaryColor = rgb(0, 0.639, 0.784); // #00A3C8
    const accentColor = rgb(0, 0.463, 0.639); // #0076A3
    const textColor = rgb(0.122, 0.161, 0.216); // #1F2937

    let yPos = height - 80;

    // Header - Company Info
    page.drawText('TIDAL TECHNICAL SUPPLY & SERVICES SDN. BHD.', {
      x: 50,
      y: yPos,
      size: 14,
      font: fontBold,
      color: accentColor,
    });
    
    yPos -= 20;
    page.drawText('(202301035098 (1529021-A))', {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });
    
    yPos -= 18;
    page.drawText('LEVEL 2, MENARA TSR, NO 12 JALAN PJU 7/3, MUTIARA DAMANSARA', {
      x: 50,
      y: yPos,
      size: 9,
      font: font,
      color: textColor,
    });
    
    yPos -= 18;
    page.drawText('Telephone No. 03-7733 5253', {
      x: 50,
      y: yPos,
      size: 9,
      font: font,
      color: textColor,
    });

    // Period & Generated Date (Right aligned)
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const periodText = `Period: ${monthNames[month]} ${year}`;
    const generatedText = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
    
    page.drawText(periodText, {
      x: width - 200,
      y: height - 80,
      size: 10,
      font: fontBold,
      color: textColor,
    });
    
    page.drawText(generatedText, {
      x: width - 200,
      y: height - 100,
      size: 9,
      font: font,
      color: textColor,
    });

    // Horizontal line
    yPos -= 30;
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Employee Info Section
    yPos -= 30;
    const employeeName = `${profile.full_name} (Employee No: ${profile.employee_id})`;
    page.drawText(employeeName, {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
      color: textColor,
    });

    yPos -= 20;
    const position = profile.positions?.title || 'Not Assigned';
    page.drawText(`Position: ${position}`, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });

    yPos -= 18;
    const department = profile.departments?.name || 'Not Assigned';
    page.drawText(`Dept: ${department}`, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });

    yPos -= 18;
    const icNo = profile.ic_no || 'Not Provided';
    page.drawText(`IC/Passport: ${icNo}`, {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });

    // NET PAY Box (Right side)
    const boxX = width - 220;
    const boxY = yPos + 40;
    const boxWidth = 170;
    const boxHeight = 60;

    // Draw box background
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.902, 0.969, 0.980), // #E6F7FA
      borderColor: primaryColor,
      borderWidth: 1,
    });

    // NET PAY label
    page.drawText('NET PAY', {
      x: boxX + (boxWidth / 2) - 30,
      y: boxY + 40,
      size: 10,
      font: fontBold,
      color: accentColor,
    });

    // Amount
    const amountText = `RM ${totalOTAmount.toFixed(2)}`;
    page.drawText(amountText, {
      x: boxX + (boxWidth / 2) - (amountText.length * 5),
      y: boxY + 20,
      size: 16,
      font: fontBold,
      color: textColor,
    });

    // Period in box
    page.drawText(periodText, {
      x: boxX + (boxWidth / 2) - 45,
      y: boxY + 5,
      size: 8,
      font: font,
      color: textColor,
    });

    // Employee Identifiers
    yPos -= 30;
    const epfNo = profile.epf_no || 'Not Provided';
    const socsoNo = profile.socso_no || 'Not Provided';
    const taxNo = profile.income_tax_no || 'Not Provided';

    page.drawText(`EPF No: ${epfNo}`, {
      x: 50,
      y: yPos,
      size: 9,
      font: font,
      color: textColor,
    });

    page.drawText(`SOCSO No: ${socsoNo}`, {
      x: 220,
      y: yPos,
      size: 9,
      font: font,
      color: textColor,
    });

    yPos -= 18;
    page.drawText(`Income Tax No: ${taxNo}`, {
      x: 50,
      y: yPos,
      size: 9,
      font: font,
      color: textColor,
    });

    // Section Header
    yPos -= 40;
    page.drawText('Employee Earnings/Reimbursements', {
      x: 50,
      y: yPos,
      size: 12,
      font: fontBold,
      color: primaryColor,
    });

    yPos -= 5;
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Table Header
    yPos -= 30;
    page.drawText('Earnings Type', {
      x: 50,
      y: yPos,
      size: 10,
      font: fontBold,
      color: textColor,
    });

    page.drawText('Current', {
      x: width - 150,
      y: yPos,
      size: 10,
      font: fontBold,
      color: textColor,
    });

    // Table Row
    yPos -= 25;
    page.drawText('Overtime Pay', {
      x: 50,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });

    page.drawText(`RM ${totalOTAmount.toFixed(2)}`, {
      x: width - 150,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });

    // Footer
    yPos = 80;
    const footerText = 'This report is auto-generated by the OT Management System. For HR and BOD internal use only.';
    page.drawText(footerText, {
      x: 50,
      y: yPos,
      size: 8,
      font: font,
      color: rgb(0.612, 0.639, 0.686), // #9CA3AF
    });

    // Add note if data is incomplete
    if (!profile.epf_no || !profile.socso_no || !profile.income_tax_no) {
      yPos -= 15;
      page.drawText('Note: Some employee information is incomplete. Please update profile.', {
        x: 50,
        y: yPos,
        size: 8,
        font: font,
        color: rgb(0.8, 0.4, 0),
      });
    }

    const pdfBytes = await pdfDoc.save();

    const fileName = `OT_Payslip_${profile.employee_id}_${monthNames[month]}_${year}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Error generating payslip:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
