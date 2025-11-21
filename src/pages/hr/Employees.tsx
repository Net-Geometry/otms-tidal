import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Download, RotateCw, Search } from 'lucide-react';
import { EmployeeTable } from '@/components/hr/employees/EmployeeTable';
import { InviteEmployeeDialog } from '@/components/hr/employees/InviteEmployeeDialog';
import { EmployeeStats } from '@/components/hr/employees/EmployeeStats';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

export default function Employees() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const { data: employees, isLoading } = useEmployees();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast({
        title: 'Success',
        description: 'Employee list refreshed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh employee list',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (!employees || employees.length === 0) {
      toast({
        title: 'No Data',
        description: 'No employees to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'full_name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone_no', label: 'Phone' },
      { key: 'department', label: 'Department' },
      { key: 'company', label: 'Company' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
    ];

    const exportData = employees.map(emp => ({
      employee_id: emp.employee_id || '',
      full_name: emp.full_name || '',
      email: emp.email || '',
      phone_no: emp.phone_no || '',
      department: emp.department?.name || '',
      company: emp.company?.name || '',
      role: emp.user_roles?.[0]?.role || '',
      status: emp.status || '',
    }));

    exportToCSV(exportData, `employees-${new Date().toISOString().split('T')[0]}`, headers);
    
    toast({
      title: 'Success',
      description: 'Employee list exported successfully',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Employee Management</h1>
            <p className="text-muted-foreground">Manage employee accounts and access</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RotateCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        <EmployeeStats employees={employees || []} />

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-6">
          <EmployeeTable 
            employees={employees || []} 
            isLoading={isLoading}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
          />
        </Card>

        <InviteEmployeeDialog 
          open={inviteDialogOpen} 
          onOpenChange={setInviteDialogOpen}
        />
      </div>
    </AppLayout>
  );
}
