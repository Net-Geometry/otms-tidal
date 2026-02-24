import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (employeeId: string) => Promise<void>;
  isAdding: boolean;
  companyId: string;
  existingEmployeeIds: string[];
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onAdd,
  isAdding,
  companyId,
  existingEmployeeIds,
}: AddEmployeeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['company-employees', companyId],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, employee_id, departments(name)')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('full_name');
      if (error) throw error;
      return data as {
        id: string;
        full_name: string;
        employee_id: string;
        departments: { name: string } | null;
      }[];
    },
    enabled: open,
  });

  const available = useMemo(() => {
    const existing = new Set(existingEmployeeIds);
    return (employees || []).filter((e) => !existing.has(e.id));
  }, [employees, existingEmployeeIds]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q)
    );
  }, [available, searchQuery]);

  const handleConfirm = async () => {
    if (!selectedId) return;
    await onAdd(selectedId);
    setSelectedId(null);
    setSearchQuery('');
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setSelectedId(null);
      setSearchQuery('');
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Employee to Payroll</DialogTitle>
          <DialogDescription>
            Select an employee to add to this payroll run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {available.length === 0
                ? 'All employees are already in this payroll run.'
                : 'No employees match your search.'}
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {filtered.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                      selectedId === employee.id
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    }`}
                    onClick={() => setSelectedId(employee.id)}
                  >
                    <div className="font-medium text-sm">
                      {employee.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {employee.employee_id}
                      {employee.departments?.name && (
                        <span className="ml-2">{employee.departments.name}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || isAdding}
          >
            {isAdding ? 'Adding...' : 'Add Employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
