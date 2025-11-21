import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateApprovalThreshold } from '@/hooks/hr/useCreateApprovalThreshold';
import { useUpdateApprovalThreshold } from '@/hooks/hr/useUpdateApprovalThreshold';

interface ApprovalThreshold {
  id: string;
  threshold_name: string;
  daily_limit_hours: number;
  weekly_limit_hours: number;
  monthly_limit_hours: number;
  max_claimable_amount: number;
  auto_block_enabled: boolean;
  is_active: boolean;
  applies_to_department_ids?: string[];
  applies_to_role_ids?: string[];
}

interface ThresholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold?: ApprovalThreshold | null;
}

export function ThresholdDialog({ open, onOpenChange, threshold }: ThresholdDialogProps) {
  const [formData, setFormData] = useState({
    threshold_name: '',
    daily_limit_hours: 0,
    weekly_limit_hours: 0,
    monthly_limit_hours: 0,
    max_claimable_amount: 0,
    auto_block_enabled: false,
    is_active: true,
  });

  const createThreshold = useCreateApprovalThreshold();
  const updateThreshold = useUpdateApprovalThreshold();

  useEffect(() => {
    if (threshold) {
      setFormData({
        threshold_name: threshold.threshold_name,
        daily_limit_hours: threshold.daily_limit_hours,
        weekly_limit_hours: threshold.weekly_limit_hours,
        monthly_limit_hours: threshold.monthly_limit_hours,
        max_claimable_amount: threshold.max_claimable_amount,
        auto_block_enabled: threshold.auto_block_enabled,
        is_active: threshold.is_active,
      });
    } else if (!open) {
      setFormData({
        threshold_name: '',
        daily_limit_hours: 0,
        weekly_limit_hours: 0,
        monthly_limit_hours: 0,
        max_claimable_amount: 0,
        auto_block_enabled: false,
        is_active: true,
      });
    }
  }, [threshold, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (threshold) {
      await updateThreshold.mutateAsync({
        id: threshold.id,
        ...formData,
      });
    } else {
      await createThreshold.mutateAsync(formData);
    }

    onOpenChange(false);
  };

  const isLoading = createThreshold.isPending || updateThreshold.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{threshold ? 'Edit' : 'Add'} Approval Threshold</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-2 sm:space-y-2">
            <Label htmlFor="threshold_name" className="text-xs sm:text-sm">Threshold Name</Label>
            <Input
              id="threshold_name"
              value={formData.threshold_name}
              onChange={(e) => setFormData({ ...formData, threshold_name: e.target.value })}
              placeholder="e.g., Standard OT Limits"
              className="h-10 sm:h-9 text-base sm:text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-2 sm:space-y-2">
              <Label htmlFor="daily_limit_hours" className="text-xs sm:text-sm">Daily Limit (hrs)</Label>
              <Input
                id="daily_limit_hours"
                type="number"
                step="0.5"
                value={formData.daily_limit_hours}
                onChange={(e) => setFormData({ ...formData, daily_limit_hours: parseFloat(e.target.value) })}
                placeholder="0"
                className="h-10 sm:h-9 text-base sm:text-sm"
                required
              />
            </div>

            <div className="space-y-2 sm:space-y-2">
              <Label htmlFor="weekly_limit_hours" className="text-xs sm:text-sm">Weekly Limit (hrs)</Label>
              <Input
                id="weekly_limit_hours"
                type="number"
                step="0.5"
                value={formData.weekly_limit_hours}
                onChange={(e) => setFormData({ ...formData, weekly_limit_hours: parseFloat(e.target.value) })}
                placeholder="0"
                className="h-10 sm:h-9 text-base sm:text-sm"
                required
              />
            </div>

            <div className="space-y-2 sm:space-y-2">
              <Label htmlFor="monthly_limit_hours" className="text-xs sm:text-sm">Monthly Limit (hrs)</Label>
              <Input
                id="monthly_limit_hours"
                type="number"
                step="0.5"
                value={formData.monthly_limit_hours}
                onChange={(e) => setFormData({ ...formData, monthly_limit_hours: parseFloat(e.target.value) })}
                placeholder="0"
                className="h-10 sm:h-9 text-base sm:text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2 sm:space-y-2">
            <Label htmlFor="max_claimable_amount" className="text-xs sm:text-sm">Max Claimable Amount (RM)</Label>
            <Input
              id="max_claimable_amount"
              type="number"
              step="0.01"
              value={formData.max_claimable_amount}
              onChange={(e) => setFormData({ ...formData, max_claimable_amount: parseFloat(e.target.value) })}
              placeholder="0.00"
              className="h-10 sm:h-9 text-base sm:text-sm"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 rounded-lg border p-3 sm:p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto_block_enabled" className="text-xs sm:text-sm font-medium">Auto-block on Exceed</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Automatically block submissions exceeding limits
              </p>
            </div>
            <Switch
              id="auto_block_enabled"
              checked={formData.auto_block_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_block_enabled: checked })}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 rounded-lg border p-3 sm:p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active" className="text-xs sm:text-sm font-medium">Active</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Enable this threshold immediately
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
              {isLoading ? 'Saving...' : threshold ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
