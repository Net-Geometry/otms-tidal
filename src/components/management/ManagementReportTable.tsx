import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { ArrowUpDown, ArrowUp, ArrowDown, FileDown, User, Building, Clock, DollarSign } from 'lucide-react';
import { generatePayslipPDF } from '@/lib/payslipPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface EmployeeOTSummary {
  employee_no: string;
  employee_name: string;
  company_name: string;
  company_code: string;
  department: string;
  position: string;
  total_ot_hours: number;
  amount: number;
  monthly_total: number;
}

interface ManagementReportTableProps {
  data: EmployeeOTSummary[];
  isLoading: boolean;
  selectedMonth: Date;
}

type SortColumn = keyof EmployeeOTSummary;
type SortDirection = 'asc' | 'desc';

export function ManagementReportTable({ data, isLoading, selectedMonth }: ManagementReportTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('employee_no');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();

  const handleDownloadOTSlip = async (employeeNo: string) => {
    try {
      toast({
        title: 'Generating OT slip...',
        description: 'Please wait while we prepare the PDF.'
      });

      // Get employee data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          employee_id,
          full_name,
          ic_no,
          department_id,
          position_id,
          departments(name),
          positions(title)
        `)
        .eq('employee_id', employeeNo)
        .single();

      if (profileError) throw profileError;

      // Get company data
      const { data: company, error: companyError } = await supabase
        .from('company_profile')
        .select('*')
        .single();

      if (companyError) throw companyError;

      // Get OT requests for the month
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      const { data: otRequests, error: otError } = await supabase
        .from('ot_requests')
        .select('*')
        .eq('employee_id', profile.id)
        .gte('ot_date', startDate)
        .lte('ot_date', endDate)
        .in('status', ['hr_certified', 'management_approved']);

      if (otError) throw otError;

      // Aggregate OT data
      const totalHours = otRequests?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
      const totalAmount = otRequests?.reduce((sum, req) => sum + (req.ot_amount || 0), 0) || 0;

      // Format data for PDF generator
      const otSlipData = {
        company: {
          name: company.name || 'Company Name',
          registration_no: company.registration_no || 'N/A',
          address: company.address || 'N/A',
          phone: company.phone || 'N/A',
          logo_url: company.logo_url || null
        },
        employee: {
          employee_no: employeeNo,
          full_name: profile.full_name,
          ic_no: profile.ic_no || null,
          department: profile.departments?.name || 'N/A',
          position: profile.positions?.title || 'N/A'
        },
        period: {
          display: format(selectedMonth, 'MMMM yyyy'),
          month: selectedMonth.getMonth() + 1,
          year: selectedMonth.getFullYear()
        },
        overtime: {
          amount: totalAmount,
          hours: totalHours
        },
        generatedDate: format(new Date(), 'dd/MM/yyyy HH:mm')
      };

      // Generate PDF
      generatePayslipPDF(otSlipData);

      toast({
        title: 'OT slip generated',
        description: 'PDF has been downloaded successfully.'
      });

    } catch (error) {
      console.error('Error generating OT slip:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate OT slip. Please try again.',
        variant: 'destructive'
      });
    }
  };


  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * modifier;
    }
    
    return String(aVal).localeCompare(String(bVal)) * modifier;
  });

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />;
  };

  // Calculate totals
  const totalHours = data.reduce((sum, row) => sum + row.total_ot_hours, 0);
  const totalCost = data.reduce((sum, row) => sum + row.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 border rounded-lg">
        <p className="text-muted-foreground">No overtime data for the selected period</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile Cards */}
        {sortedData.map((row, index) => (
          <Card key={`${row.employee_no}-${index}`} className="p-4">
            <CardContent className="p-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">{row.employee_name}</span>
                </div>
                <span className="text-sm bg-muted px-2 py-1 rounded">
                  {row.employee_no}
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-2 pb-2 border-b">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm font-medium">{row.company_name}</div>
                    <div className="text-xs text-muted-foreground">{row.company_code}</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span>{row.department}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Position:</span>
                  <div className="font-medium">{row.position}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-muted-foreground">OT Hours</div>
                    <div className="font-semibold text-primary">
                      {formatHours(row.total_ot_hours)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 justify-end">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div className="text-right">
                    <div className="text-muted-foreground">Total</div>
                    <div className="font-semibold text-green-600">
                      {formatCurrency(row.monthly_total)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDownloadOTSlip(row.employee_no)}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Download OT Slip
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Mobile Summary */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Summary - All Employees</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Hours</div>
                  <div className="font-bold text-primary text-lg">
                    {formatHours(totalHours)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Cost</div>
                  <div className="font-bold text-green-600 text-lg">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tablet layout - compact cards with essential info
  if (isTablet) {
    return (
      <div className="space-y-3">
        {sortedData.map((row, index) => (
          <Card key={`${row.employee_no}-${index}`} className="p-3">
            <CardContent className="p-0">
              <div className="grid grid-cols-5 gap-3 items-center text-sm">
                <div>
                  <div className="font-semibold">{row.employee_name}</div>
                  <div className="text-xs text-muted-foreground">{row.employee_no}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Company</div>
                  <div className="truncate">{row.company_name}</div>
                  <div className="text-xs text-muted-foreground">{row.company_code}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dept</div>
                  <div className="truncate">{row.department}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Hours</div>
                  <div className="font-semibold text-primary">{formatHours(row.total_ot_hours)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-semibold text-green-600">{formatCurrency(row.monthly_total)}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-6 text-xs"
                    onClick={() => handleDownloadOTSlip(row.employee_no)}
                  >
                    <FileDown className="h-3 w-3 mr-1" />
                    Slip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Tablet Summary */}
        <Card className="bg-muted/30 mt-4">
          <CardContent className="p-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold">Total - All Employees</span>
              <div className="text-right">
                <div className="font-bold text-primary">{formatHours(totalHours)} hrs</div>
                <div className="font-bold text-green-600">{formatCurrency(totalCost)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('employee_no')}
            >
              Employee No. <SortIcon column="employee_no" />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('employee_name')}
            >
              Name <SortIcon column="employee_name" />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('company_name')}
            >
              Company <SortIcon column="company_name" />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('department')}
            >
              Department <SortIcon column="department" />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('position')}
            >
              Position <SortIcon column="position" />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 font-semibold"
              onClick={() => handleSort('total_ot_hours')}
            >
              Total OT Hours <SortIcon column="total_ot_hours" />
            </TableHead>
            <TableHead className="text-right font-semibold">Amount (RM)</TableHead>
            <TableHead className="text-right font-semibold">Monthly Total (RM)</TableHead>
            <TableHead className="text-center font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row, index) => (
            <TableRow key={`${row.employee_no}-${index}`}>
              <TableCell className="font-semibold">
                {row.employee_no}
              </TableCell>
              <TableCell>{row.employee_name}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.company_name}</span>
                  <span className="text-xs text-muted-foreground">{row.company_code}</span>
                </div>
              </TableCell>
              <TableCell>{row.department}</TableCell>
              <TableCell>{row.position}</TableCell>
              <TableCell className="font-semibold text-primary">
                {formatHours(row.total_ot_hours)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.amount)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(row.monthly_total)}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadOTSlip(row.employee_no)}
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  OT Slip
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted/50">
            <TableCell colSpan={5} className="font-semibold">
              Total (All Employees)
            </TableCell>
            <TableCell className="font-bold text-primary">
              {formatHours(totalHours)} hrs
            </TableCell>
            <TableCell className="text-right font-bold text-primary">
              {formatCurrency(totalCost)}
            </TableCell>
            <TableCell className="text-right font-bold text-primary">
              {formatCurrency(totalCost)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}