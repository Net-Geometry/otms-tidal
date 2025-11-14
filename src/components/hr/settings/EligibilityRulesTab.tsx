import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useEligibilityRules } from '@/hooks/hr/useEligibilityRules';
import { useDeleteEligibilityRule } from '@/hooks/hr/useDeleteEligibilityRule';
import { EligibilityRuleCard } from './EligibilityRuleCard';
import { EligibilityRuleDialog } from './EligibilityRuleDialog';
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

export function EligibilityRulesTab() {
  const { data: rules, isLoading } = useEligibilityRules();
  const deleteRule = useDeleteEligibilityRule();
  const [ruleToDelete, setRuleToDelete] = useState<any>(null);
  const [ruleToEdit, setRuleToEdit] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDelete = () => {
    if (ruleToDelete) {
      deleteRule.mutate(ruleToDelete.id);
      setRuleToDelete(null);
    }
  };

  const handleEdit = (rule: any) => {
    setRuleToEdit(rule);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setRuleToEdit(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setRuleToEdit(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">OT Eligibility Rules</h3>
          <p className="text-sm text-muted-foreground">
            Define who is eligible for overtime based on salary, department, and role
          </p>
        </div>
        <Button className="bg-[#5F26B4] hover:bg-[#5F26B4]/90" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : rules && rules.length > 0 ? (
          rules.map((rule) => (
            <EligibilityRuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEdit}
              onDelete={setRuleToDelete}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No eligibility rules found. Click "Add Rule" to create one.
          </div>
        )}
      </div>

      <EligibilityRuleDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        rule={ruleToEdit}
      />

      <AlertDialog open={!!ruleToDelete} onOpenChange={() => setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Eligibility Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.rule_name}"? This action cannot be undone.
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
