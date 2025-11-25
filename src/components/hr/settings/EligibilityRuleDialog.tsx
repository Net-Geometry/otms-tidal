import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateEligibilityRule } from '@/hooks/hr/useCreateEligibilityRule';
import { useUpdateEligibilityRule } from '@/hooks/hr/useUpdateEligibilityRule';

interface EligibilityRule {
  id: string;
  rule_name: string;
  min_salary: number;
  max_salary: number;
  is_active: boolean;
  department_ids?: string[];
  role_ids?: string[];
  employment_types?: string[];
}

interface EligibilityRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: EligibilityRule | null;
}

export function EligibilityRuleDialog({ open, onOpenChange, rule }: EligibilityRuleDialogProps) {
  const [formData, setFormData] = useState({
    rule_name: '',
    min_salary: 0,
    max_salary: 0,
    is_active: true,
  });

  const createRule = useCreateEligibilityRule();
  const updateRule = useUpdateEligibilityRule();

  useEffect(() => {
    if (rule) {
      setFormData({
        rule_name: rule.rule_name,
        min_salary: rule.min_salary,
        max_salary: rule.max_salary,
        is_active: rule.is_active,
      });
    } else if (!open) {
      setFormData({
        rule_name: '',
        min_salary: 0,
        max_salary: 0,
        is_active: true,
      });
    }
  }, [rule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rule) {
      await updateRule.mutateAsync({
        id: rule.id,
        ...formData,
      });
    } else {
      await createRule.mutateAsync(formData);
    }

    onOpenChange(false);
  };

  const isLoading = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{rule ? 'Edit' : 'Add'} Eligibility Rule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2 sm:space-y-2">
            <Label htmlFor="rule_name" className="text-xs sm:text-sm">Rule Name</Label>
            <Input
              id="rule_name"
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              placeholder="e.g., Standard Employee Eligibility"
              className="h-10 sm:h-9 text-base sm:text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2 sm:space-y-2">
              <Label htmlFor="min_salary" className="text-xs sm:text-sm">Minimum Salary (RM)</Label>
              <Input
                id="min_salary"
                type="number"
                step="0.01"
                value={formData.min_salary}
                onChange={(e) => setFormData({ ...formData, min_salary: parseFloat(e.target.value) })}
                placeholder="0.00"
                className="h-10 sm:h-9 text-base sm:text-sm"
                required
              />
            </div>

            <div className="space-y-2 sm:space-y-2">
              <Label htmlFor="max_salary" className="text-xs sm:text-sm">Maximum Salary (RM)</Label>
              <Input
                id="max_salary"
                type="number"
                step="0.01"
                value={formData.max_salary}
                onChange={(e) => setFormData({ ...formData, max_salary: parseFloat(e.target.value) })}
                placeholder="0.00"
                className="h-10 sm:h-9 text-base sm:text-sm"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 rounded-lg border p-3 sm:p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active" className="text-xs sm:text-sm font-medium">Active</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Enable this rule immediately
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full sm:w-auto h-10 sm:h-9 text-base sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto h-10 sm:h-9 text-base sm:text-sm"
            >
              {isLoading ? 'Saving...' : rule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
