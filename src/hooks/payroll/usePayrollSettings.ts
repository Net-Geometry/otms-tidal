import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PayrollSettings, AllowanceType, DeductionType, SocsoContributionRow } from '@/types/payroll';

export function usePayrollSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const settingsQuery = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const { data, error } = await db
        .from('payroll_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data as PayrollSettings;
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (values: Partial<Omit<PayrollSettings, 'id' | 'created_at' | 'updated_at'>>) => {
      const { error } = await db
        .from('payroll_settings')
        .update(values)
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      toast({ title: 'Saved', description: 'Payroll settings updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateSettingsMutation.mutateAsync,
    isSaving: updateSettingsMutation.isPending,
  };
}

export function useAllowanceTypes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['allowance-types'],
    queryFn: async () => {
      const { data, error } = await db
        .from('allowance_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as AllowanceType[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Partial<AllowanceType> & { code: string; name: string }) => {
      if (values.id) {
        const { error } = await db
          .from('allowance_types')
          .update(values)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('allowance_types')
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance-types'] });
      toast({ title: 'Saved', description: 'Allowance type saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('allowance_types')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowance-types'] });
      toast({ title: 'Deleted', description: 'Allowance type deactivated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    upsertAllowanceType: upsertMutation.mutateAsync,
    deleteAllowanceType: deleteMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  };
}

export function useDeductionTypes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['deduction-types'],
    queryFn: async () => {
      const { data, error } = await db
        .from('deduction_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as DeductionType[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Partial<DeductionType> & { code: string; name: string }) => {
      if (values.id) {
        const { error } = await db
          .from('deduction_types')
          .update(values)
          .eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('deduction_types')
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction-types'] });
      toast({ title: 'Saved', description: 'Deduction type saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('deduction_types')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deduction-types'] });
      toast({ title: 'Deleted', description: 'Deduction type deactivated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    ...query,
    upsertDeductionType: upsertMutation.mutateAsync,
    deleteDeductionType: deleteMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  };
}

export function useSocsoTable() {
  const db = supabase as any;

  return useQuery({
    queryKey: ['socso-contribution-table'],
    queryFn: async () => {
      const { data, error } = await db
        .from('socso_contribution_table')
        .select('*')
        .order('wage_from');
      if (error) throw error;
      return (data || []) as SocsoContributionRow[];
    },
    staleTime: 10 * 60 * 1000,
  });
}
