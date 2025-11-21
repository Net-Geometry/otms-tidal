import { useState } from 'react';
import { Plus, Building2, Users, Briefcase, Pencil } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DepartmentWithCount } from '@/hooks/hr/useDepartments';
import { PositionList } from './PositionList';
import { PositionDialog } from './PositionDialog';
import { usePositions } from '@/hooks/hr/usePositions';
import { format } from 'date-fns';

interface DepartmentDetailsSheetProps {
  department: DepartmentWithCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (department: DepartmentWithCount) => void;
}

export function DepartmentDetailsSheet({
  department,
  open,
  onOpenChange,
  onEdit,
}: DepartmentDetailsSheetProps) {
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const { data: positions } = usePositions(department?.id);

  if (!department) return null;

  const positionCount = positions?.length || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {department.name}
            </SheetTitle>
            <SheetDescription>
              View and manage department details, positions, and employees
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Department Info Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Department Information</CardTitle>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(department)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Department Code</span>
                  <Badge variant="secondary" className="font-mono">
                    {department.code}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm font-medium">
                    {format(new Date(department.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{department.employee_count}</p>
                      <p className="text-xs text-muted-foreground">Employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{positionCount}</p>
                      <p className="text-xs text-muted-foreground">Positions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Positions Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Positions</h3>
                <Button
                  size="sm"
                  onClick={() => setShowPositionDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </div>
              <PositionList departmentId={department.id} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <PositionDialog
        open={showPositionDialog}
        onOpenChange={setShowPositionDialog}
        departmentId={department.id}
      />
    </>
  );
}
