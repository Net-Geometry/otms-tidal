import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Eye, Edit, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';
import { EmployeeDetailsSheet } from './EmployeeDetailsSheet';
import { Profile } from '@/types/otms';
import { useResendInvite } from '@/hooks/hr/useResendInvite';
import { useDeleteEmployee } from '@/hooks/hr/useDeleteEmployee';
import { useUpdateEmployee } from '@/hooks/hr/useUpdateEmployee';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EmployeeTableProps {
  employees: Profile[];
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string;
}

export function EmployeeTable({ employees, isLoading, searchQuery, statusFilter }: EmployeeTableProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [sheetMode, setSheetMode] = useState<'view' | 'edit'>('view');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Profile | null>(null);
  const resendInvite = useResendInvite();
  const deleteEmployee = useDeleteEmployee();
  const updateEmployee = useUpdateEmployee();

  // Filter employees based on search and status
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = searchQuery === '' || 
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active'
        ? ['active', 'pending_setup'].includes((employee.status || '').toLowerCase())
        : (employee.status || '').toLowerCase() === statusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  const handleResendInvite = (employee: Profile) => {
    resendInvite.mutate({
      userId: employee.id,
      email: employee.email
    });
  };

  const handleDeleteEmployee = () => {
    if (employeeToDelete) {
      deleteEmployee.mutate(employeeToDelete.id);
      setEmployeeToDelete(null);
    }
  };

  const handleToggleOTEligibility = (employee: Profile, checked: boolean) => {
    updateEmployee.mutate({
      id: employee.id,
      is_ot_eligible: checked,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (filteredEmployees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No employees found
      </div>
    );
  }

  return (
    <ResponsiveTable
      cardConfig={{
        data: filteredEmployees,
        emptyMessage: 'No employees found',
        render: (employee) => ({
          title: employee.full_name,
          subtitle: employee.employee_id,
          fields: [
            {
              label: 'Email',
              value: employee.email,
              variant: 'default'
            },
            {
              label: 'Status',
              value: employee.status === 'pending_setup' ? 'Pending Setup' : employee.status,
              variant: 'badge'
            },
            {
              label: 'Department',
              value: employee.department?.name || (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Not assigned
                </span>
              )
            },
            {
              label: 'OT Eligible',
              value: (
                <Switch
                  checked={employee.is_ot_eligible ?? true}
                  onCheckedChange={(checked) => handleToggleOTEligibility(employee, checked)}
                  disabled={updateEmployee.isPending}
                />
              )
            }
          ],
          actions: (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEmployee(employee);
                  setSheetMode('view');
                  setIsSheetOpen(true);
                }}
                className="h-9 w-9"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEmployee(employee);
                  setSheetMode('edit');
                  setIsSheetOpen(true);
                }}
                className="h-9 w-9"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {(employee.status === 'pending' || employee.status === 'inactive') && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResendInvite(employee);
                  }}
                  disabled={resendInvite.isPending}
                  className="h-9 w-9"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setEmployeeToDelete(employee);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })
      }}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>OT Eligible</TableHead>
              <TableHead>Attachment Req.</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-mono text-sm">{employee.employee_id}</TableCell>
                <TableCell className="font-medium">{employee.full_name}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>
                  {employee.company?.name ? (
                    <span>{employee.company.name}</span>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-sm">Not assigned</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {employee.department?.name ? (
                    <span>{employee.department.name}</span>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-sm">Not assigned</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {employee.position ? (
                    <span>{employee.position}</span>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-sm">Not assigned</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {employee.user_roles && employee.user_roles.length > 0
                    ? employee.user_roles.map(ur => ur.role).join(', ')
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      employee.status === 'active'
                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                        : employee.status === 'pending_setup'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                        : employee.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-muted text-muted-foreground hover:bg-muted'
                    }
                  >
                    {employee.status === 'pending_setup' ? 'Pending Setup' : employee.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={employee.is_ot_eligible ?? true}
                    onCheckedChange={(checked) => handleToggleOTEligibility(employee, checked)}
                    disabled={updateEmployee.isPending}
                  />
                </TableCell>
                <TableCell>
                  {employee.require_ot_attachment ? (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setSheetMode('view');
                        setIsSheetOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setSheetMode('edit');
                        setIsSheetOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {(employee.status === 'pending' || employee.status === 'inactive') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendInvite(employee)}
                        disabled={resendInvite.isPending}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setEmployeeToDelete(employee)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ResponsiveTable>

      <EmployeeDetailsSheet
        employee={selectedEmployee}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        mode={sheetMode}
      />

      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {employeeToDelete?.full_name}? 
              This action cannot be undone and will permanently remove the employee 
              account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
