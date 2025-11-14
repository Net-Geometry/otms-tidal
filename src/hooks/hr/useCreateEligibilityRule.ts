import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateEligibilityRuleData {
  rule_name: string;
  min_salary: number;
  max_salary: number;
  is_active: boolean;
  department_ids?: string[];
  role_ids?: string[];
  employment_types?: string[];
}

export function useCreateEligibilityRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateEligibilityRuleData) => {
      const { data: result, error } = await supabase
        .from('ot_eligibility_rules')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eligibility-rules'] });
      toast({
        title: 'Success',
        description: 'Eligibility rule created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create eligibility rule',
        variant: 'destructive',
      });
    },
  });
}
