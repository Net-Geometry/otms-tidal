import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Badge } from "@/components/ui/badge";

interface CalendarValidationProps {
  hasUnsavedChanges: boolean;
}

export function CalendarValidation({ hasUnsavedChanges }: CalendarValidationProps) {
    const { showPrompt, confirm, cancel } = useUnsavedChanges(hasUnsavedChanges);
    
    return (
        <AlertDialog open={showPrompt}>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
               <AlertDialogDescription>
                 You have unsaved changes. Are you sure you want to leave without saving?
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel onClick={cancel}>Cancel</AlertDialogCancel>
               <AlertDialogAction onClick={() => confirm && confirm()} className="bg-destructive hover:bg-destructive/90">Leave without Saving</AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>
    );
}

export function UnsavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-500 animate-pulse">
      Unsaved Changes
    </Badge>
  );
}

export function getValidationIssues(name: string, dateFrom: string, dateTo: string, totalHolidays: number, weeklyOffsCount: number) {
   const warnings = [];
   const errors = [];

   if (!name.trim()) errors.push("Calendar name is required");
   if (!dateFrom || !dateTo) errors.push("Date range is required");
   if (totalHolidays < 10) warnings.push("Calendar has fewer than 10 holidays - use the tabs to generate holidays");
   if (weeklyOffsCount === 0) warnings.push("No weekly offs configured - use the 'Generate Weekly Offs' tab");

   return { warnings, errors };
}
