import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useEligibilityRules } from '@/hooks/hr/useEligibilityRules';
import { useDeleteEligibilityRule } from '@/hooks/hr/useDeleteEligibilityRule';
import { EligibilityRuleCard } from './EligibilityRuleCard';
import { EligibilityRuleDialog } from './EligibilityRuleDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useGracePeriodSettings, useUpdateGracePeriodSettings } from '@/hooks/hr/useGracePeriodSettings';
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

  const { data: graceSettings, isLoading: isGraceLoading, isError: isGraceError } = useGracePeriodSettings();
  const updateGrace = useUpdateGracePeriodSettings();
  const [graceEnabled, setGraceEnabled] = useState(false);
  const [graceDirty, setGraceDirty] = useState(false);

  useEffect(() => {
    if (graceSettings) {
      setGraceEnabled(!!graceSettings.grace_period_enabled);
      setGraceDirty(false);
    }
  }, [graceSettings]);

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
      <Card className="p-4 border-warning/30 bg-warning/10">
        {isGraceLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold">Grace Period Mode</h4>
                <Badge variant={graceEnabled ? 'warning' : 'secondary'}>
                  {graceEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, employees can submit OT for any past date (the normal submission deadline is bypassed).
              </p>
              {isGraceError && (
                <p className="text-sm text-destructive">
                  Unable to load Grace Period Mode setting.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={graceEnabled}
                onCheckedChange={(checked) => {
                  setGraceEnabled(checked);
                  setGraceDirty(true);
                }}
                disabled={updateGrace.isPending || !graceSettings?.id}
              />
              <Button
                onClick={() => {
                  if (!graceSettings?.id) return;
                  updateGrace.mutate(
                    { id: graceSettings.id, gracePeriodEnabled: graceEnabled },
                    { onSuccess: () => setGraceDirty(false) }
                  );
                }}
                disabled={updateGrace.isPending || !graceSettings?.id || !graceDirty}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Card>

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
