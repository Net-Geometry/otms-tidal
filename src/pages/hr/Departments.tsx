import { useState } from 'react';
import { Plus, Grid3x3, List, Search } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useDepartments, DepartmentWithCount } from '@/hooks/hr/useDepartments';
import { DepartmentCard } from '@/components/hr/departments/DepartmentCard';
import { DepartmentTable } from '@/components/hr/departments/DepartmentTable';
import { DepartmentDialog } from '@/components/hr/departments/DepartmentDialog';
import { DepartmentStats } from '@/components/hr/departments/DepartmentStats';
import { DepartmentDetailsSheet } from '@/components/hr/departments/DepartmentDetailsSheet';
import { Skeleton } from '@/components/ui/skeleton';

export default function Departments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentWithCount | null>(null);

  const { data: departments, isLoading } = useDepartments();

  const filteredDepartments = departments?.filter(
    (dept) =>
      dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalEmployees = departments?.reduce((sum, dept) => sum + (dept.employee_count || 0), 0) || 0;
  const emptyDepartments = departments?.filter((dept) => !dept.employee_count || dept.employee_count === 0).length || 0;
  const largestDepartment = departments?.reduce((max, dept) => {
    const count = dept.employee_count || 0;
    return count > (max?.count || 0) ? { name: dept.name, count } : max;
  }, null as { name: string; count: number } | null);

  const handleEdit = (department: DepartmentWithCount) => {
    setSelectedDepartment(department);
    setShowDialog(true);
  };

  const handleCreate = () => {
    setSelectedDepartment(null);
    setShowDialog(true);
  };

  const handleViewDetails = (department: DepartmentWithCount) => {
    setSelectedDepartment(department);
    setShowDetailsSheet(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Departments</h1>
            <p className="text-muted-foreground">Manage organizational departments and structures</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <DepartmentStats
            totalDepartments={departments?.length || 0}
            totalEmployees={totalEmployees}
            largestDepartment={largestDepartment || undefined}
            emptyDepartments={emptyDepartments}
          />
        )}

        {/* Search and View Toggle */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDepartments?.map((department) => (
                  <DepartmentCard
                    key={department.id}
                    department={department}
                    onEdit={handleEdit}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            ) : (
              <DepartmentTable
                departments={filteredDepartments || []}
                onEdit={handleEdit}
              />
            )}
          </>
        )}
      </div>

      <DepartmentDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        department={selectedDepartment}
      />

      <DepartmentDetailsSheet
        department={selectedDepartment}
        open={showDetailsSheet}
        onOpenChange={setShowDetailsSheet}
        onEdit={handleEdit}
      />
    </AppLayout>
  );
}
