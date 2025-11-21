import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useApprovalThresholds } from '@/hooks/hr/useApprovalThresholds';
import { useDeleteApprovalThreshold } from '@/hooks/hr/useDeleteApprovalThreshold';
import { ThresholdCard } from './ThresholdCard';
import { ThresholdDialog } from './ThresholdDialog';
import { Skeleton } from '@/components/ui/skeleton';
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

export function ThresholdsTab() {
  const { data: thresholds, isLoading } = useApprovalThresholds();
  const deleteThreshold = useDeleteApprovalThreshold();
  const [thresholdToDelete, setThresholdToDelete] = useState<any>(null);
  const [thresholdToEdit, setThresholdToEdit] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDelete = () => {
    if (thresholdToDelete) {
      deleteThreshold.mutate(thresholdToDelete.id);
      setThresholdToDelete(null);
    }
  };

  const handleEdit = (threshold: any) => {
    setThresholdToEdit(threshold);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setThresholdToEdit(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setThresholdToEdit(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Approval Thresholds</h3>
          <p className="text-sm text-muted-foreground">
            Set daily, weekly, and monthly OT limits
          </p>
        </div>
        <Button className="bg-[#5F26B4] hover:bg-[#5F26B4]/90" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Threshold
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : thresholds && thresholds.length > 0 ? (
          thresholds.map((threshold) => (
            <ThresholdCard
              key={threshold.id}
              threshold={threshold}
              onEdit={handleEdit}
              onDelete={setThresholdToDelete}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No approval thresholds found. Click "Add Threshold" to create one.
          </div>
        )}
      </div>

      <ThresholdDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        threshold={thresholdToEdit}
      />

      <AlertDialog open={!!thresholdToDelete} onOpenChange={() => setThresholdToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Threshold</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{thresholdToDelete?.threshold_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
