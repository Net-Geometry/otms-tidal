import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
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
import { useState } from 'react';
import { useDeleteDepartment } from '@/hooks/hr/useDeleteDepartment';
import { format } from 'date-fns';

interface DepartmentTableProps {
  departments: Array<{
    id: string;
    code: string;
    name: string;
    employee_count?: number;
    created_at: string;
  }>;
  onEdit: (department: any) => void;
}

export function DepartmentTable({ departments, onEdit }: DepartmentTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDepartment = useDeleteDepartment();

  const handleDelete = () => {
    if (deleteId) {
      deleteDepartment.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <ResponsiveTable
        cardConfig={{
          data: departments,
          emptyMessage: 'No departments found',
          render: (dept) => ({
            title: dept.name,
            subtitle: dept.code,
            fields: [
              { label: 'Employees', value: dept.employee_count || 0 },
              {
                label: 'Created',
                value: format(new Date(dept.created_at), 'PP'),
                variant: 'muted'
              }
            ],
            actions: (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(dept);
                  }}
                  className="h-9 w-9"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(dept.id);
                  }}
                  className="h-9 w-9 text-destructive hover:text-destructive"
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
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No departments found
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {dept.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.employee_count || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(dept.created_at), 'PP')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(dept)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(dept.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ResponsiveTable>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
