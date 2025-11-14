import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateApprovalThresholdData {
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

export function useCreateApprovalThreshold() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateApprovalThresholdData) => {
      const { data: result, error } = await supabase
        .from('ot_approval_thresholds')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-thresholds'] });
      toast({
        title: 'Success',
        description: 'Approval threshold created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create approval threshold',
        variant: 'destructive',
      });
    },
  });
}
