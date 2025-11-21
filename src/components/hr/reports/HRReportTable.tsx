import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { ArrowUpDown, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { generatePayslipPDF } from '@/lib/payslipPdfGenerator';

interface EmployeeOTSummary {
  employee_id: string;
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

interface HRReportTableProps {
  data: EmployeeOTSummary[];
  isLoading: boolean;
  selectedMonth: Date;
}

type SortColumn = keyof EmployeeOTSummary;
type SortDirection = 'asc' | 'desc';

export function HRReportTable({ data, isLoading, selectedMonth }: HRReportTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('employee_no');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const handleDownloadOTSlip = async (employeeId: string, employeeNo: string) => {
    setDownloadingIds(prev => new Set(prev).add(employeeId));

    try {
      // Check user role - only HR and Management can generate OT slips
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;

      const isAuthorized = roles?.some(r => 
        r.role === 'hr' || r.role === 'management' || r.role === 'admin'
      );

      if (!isAuthorized) {
        toast({
          title: 'Access Denied',
          description: 'Only HR and Management can generate OT slips.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch all required data
      const year = selectedMonth.getFullYear();
      const monthNum = selectedMonth.getMonth() + 1;
      
      // Calculate date range
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // 1. Fetch company profile
      const { data: company, error: companyError } = await supabase
        .from('company_profile')
        .select('*')
        .single();

      if (companyError) throw companyError;

      // 2. Fetch employee profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          employee_id,
          full_name,
          ic_no,
          department_id,
          position_id,
          departments!profiles_department_id_fkey(name),
          positions!profiles_position_id_fkey(title)
        `)
        .eq('id', employeeId)
        .single();

      if (profileError) throw profileError;

      // 3. Fetch OT requests for the month
      const { data: otRequests, error: otError } = await supabase
        .from('ot_requests')
        .select('total_hours, ot_amount')
        .eq('employee_id', employeeId)
        .gte('ot_date', startDate)
        .lte('ot_date', endDate)
        .in('status', ['hr_certified', 'management_approved']);

      if (otError) throw otError;

      const totalAmount = otRequests?.reduce((sum, r) => sum + (r.ot_amount || 0), 0) || 0;
      const totalHours = otRequests?.reduce((sum, r) => sum + (r.total_hours || 0), 0) || 0;

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];

      // Generate OT slip PDF with complete data
      generatePayslipPDF({
        company: {
          name: company.name,
          registration_no: company.registration_no,
          address: company.address,
          phone: company.phone,
          logo_url: company.logo_url,
        },
        employee: {
          employee_no: profile.employee_id,
          full_name: profile.full_name,
          ic_no: profile.ic_no,
          department: profile.departments?.name || 'Not Assigned',
          position: profile.positions?.title || 'Not Assigned',
        },
        period: {
          display: `${monthNames[monthNum - 1]} ${year}`,
          month: monthNum,
          year,
        },
        overtime: {
          amount: totalAmount,
          hours: totalHours,
        },
        generatedDate: new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', ''),
      });

      toast({
        title: 'Success',
        description: 'OT slip downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading OT slip:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate OT slip',
        variant: 'destructive',
      });
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(employeeId);
        return next;
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
                onClick={() => handleSort('company_name')}
              >
                Company <SortIcon column="company_name" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 font-semibold"
                onClick={() => handleSort('employee_name')}
              >
              Name <SortIcon column="employee_name" />
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
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row, index) => (
            <TableRow key={`${row.employee_no}-${index}`}>
              <TableCell className="font-semibold">
                {row.employee_no}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.company_name}</span>
                  <span className="text-xs text-muted-foreground">{row.company_code}</span>
                </div>
              </TableCell>
              <TableCell>{row.employee_name}</TableCell>
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
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadOTSlip(row.employee_id, row.employee_no)}
                  disabled={downloadingIds.has(row.employee_id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {downloadingIds.has(row.employee_id) ? 'Generating...' : 'OT Slip'}
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
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
