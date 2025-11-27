import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, RotateCcw, Trash2, Loader2 } from 'lucide-react';
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
import { useArchivedEmployees, useRestoreEmployee, useHardDeleteEmployee } from '@/hooks/hr/useArchiveEmployees';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ArchivedEmployees() {
  const navigate = useNavigate();
  const { user, roles, isLoadingRoles } = useAuth();
  const { toast } = useToast();
  const { data: archivedEmployees, isLoading } = useArchivedEmployees();
  const restoreEmployee = useRestoreEmployee();
  const hardDeleteEmployee = useHardDeleteEmployee();

  const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // Check if user has HR or Admin role
  const canAccess = roles?.includes('hr') || roles?.includes('admin');

  // Redirect if not authorized (only after roles have finished loading)
  useEffect(() => {
    if (!isLoadingRoles && !canAccess && user) {
      navigate('/dashboard');
    }
  }, [canAccess, user, navigate, isLoadingRoles]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageLayout title="Archived Employees" description="View and manage deleted employees">
          <div className="text-center py-8">Loading...</div>
        </PageLayout>
      </AppLayout>
    );
  }

  const handleRestore = (employeeId: string) => {
    restoreEmployee.mutate(employeeId);
  };

  const handleHardDelete = () => {
    if (employeeToDelete && deleteConfirmed) {
      hardDeleteEmployee.mutate(employeeToDelete.id);
      setEmployeeToDelete(null);
      setDeleteConfirmed(false);
    }
  };

  const filteredEmployees = (archivedEmployees || []).filter((emp: any) => !!emp.deleted_at);

  return (
    <AppLayout>
      <PageLayout
        title="Archived Employees"
        description="View and restore deleted employees"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/hr/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
        }
      >
        <Card className="p-6">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No archived employees found
            </div>
          ) : (
            <ResponsiveTable
              cardConfig={{
                data: filteredEmployees,
                emptyMessage: 'No archived employees found',
                render: (employee: any) => ({
                  title: employee.full_name,
                  subtitle: employee.employee_id,
                  fields: [
                    {
                      label: 'Email',
                      value: employee.email,
                      variant: 'default'
                    },
                    {
                      label: 'Deleted Date',
                      value: employee.deleted_at
                        ? format(new Date(employee.deleted_at), 'MMM d, yyyy')
                        : 'N/A',
                      variant: 'default'
                    },
                    {
                      label: 'Department',
                      value: employee.department?.name || (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Not assigned
                        </span>
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
                          handleRestore(employee.id);
                        }}
                        disabled={restoreEmployee.isPending}
                        className="h-9 w-9 text-green-600 hover:text-green-700"
                        title="Restore employee"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmployeeToDelete(employee);
                          setDeleteConfirmed(false);
                        }}
                        disabled={hardDeleteEmployee.isPending}
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        title="Permanently delete employee"
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
                      <TableHead>Department</TableHead>
                      <TableHead>Deleted Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee: any) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-mono text-sm">{employee.employee_id}</TableCell>
                        <TableCell className="font-medium">{employee.full_name}</TableCell>
                        <TableCell>{employee.email}</TableCell>
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
                          {employee.deleted_at
                            ? format(new Date(employee.deleted_at), 'MMM d, yyyy')
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(employee.id)}
                              disabled={restoreEmployee.isPending}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              {restoreEmployee.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4 mr-1" />
                              )}
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEmployeeToDelete(employee);
                                setDeleteConfirmed(false);
                              }}
                              disabled={hardDeleteEmployee.isPending}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {hardDeleteEmployee.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-1" />
                              )}
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ResponsiveTable>
          )}
        </Card>

        {/* Two-Step Delete Confirmation Dialog */}
        <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => {
          if (!open) {
            setEmployeeToDelete(null);
            setDeleteConfirmed(false);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteConfirmed ? 'Permanently Delete Employee?' : 'Delete Employee'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {!deleteConfirmed ? (
                  <>
                    <p className="text-sm text-foreground font-medium mb-2">
                      Are you sure you want to permanently delete {employeeToDelete?.full_name}?
                    </p>
                    <p className="text-sm text-destructive font-semibold">
                      ⚠️ This action cannot be undone and will completely remove the employee from the system.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground font-medium mb-2">
                      This is the final step. Click "Delete" again to permanently delete {employeeToDelete?.full_name}.
                    </p>
                    <p className="text-sm text-destructive font-semibold">
                      ⚠️ This action is permanent and irreversible.
                    </p>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  if (!deleteConfirmed) {
                    e.preventDefault();
                    setDeleteConfirmed(true);
                  } else {
                    handleHardDelete();
                  }
                }}
                className={deleteConfirmed ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              >
                {deleteConfirmed ? 'Permanently Delete' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageLayout>
    </AppLayout>
  );
}
