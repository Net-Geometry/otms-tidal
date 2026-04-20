/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ReminderFrequency = 'one_off' | 'monthly' | 'quarterly' | 'yearly';
export type ReminderType = 'create_prf' | 'create_pv' | 'general';

export interface PaymentReminder {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  amount: number | null;
  frequency: ReminderFrequency;
  anchor_date: string;
  lead_days: number;
  reminder_type: ReminderType;
  assignee_id: string;
  next_fire_at: string;
  last_fired_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; full_name: string; employee_id: string } | null;
  company?: { id: string; name: string } | null;
}

export interface UpsertPaymentReminderInput {
  id?: string;
  company_id: string;
  name: string;
  description?: string | null;
  amount?: number | null;
  frequency: ReminderFrequency;
  anchor_date: string;
  lead_days: number;
  reminder_type: ReminderType;
  assignee_id: string;
}

function computeNextFireAt(anchorDate: string, leadDays: number): string {
  const anchor = new Date(anchorDate);
  anchor.setDate(anchor.getDate() - leadDays);
  return anchor.toISOString();
}

export function usePaymentReminders(filters: { companyId?: string; activeOnly?: boolean } = {}) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['payment-reminders', filters.companyId || 'all', filters.activeOnly ?? true],
    queryFn: async (): Promise<PaymentReminder[]> => {
      let q = db
        .from('payment_reminders')
        .select(`
          *,
          assignee:profiles!payment_reminders_assignee_id_fkey(id, full_name, employee_id),
          company:companies(id, name)
        `)
        .order('next_fire_at', { ascending: true });

      if (filters.companyId) q = q.eq('company_id', filters.companyId);
      if (filters.activeOnly !== false) q = q.eq('is_active', true);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PaymentReminder[];
    },
    staleTime: 30 * 1000,
  });
}

export function useUpsertPaymentReminder() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertPaymentReminderInput) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');

      const next_fire_at = computeNextFireAt(input.anchor_date, input.lead_days);

      const payload: Record<string, any> = {
        company_id: input.company_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        amount: input.amount ?? null,
        frequency: input.frequency,
        anchor_date: input.anchor_date,
        lead_days: input.lead_days,
        reminder_type: input.reminder_type,
        assignee_id: input.assignee_id,
        next_fire_at,
      };

      if (input.id) {
        const { error } = await db.from('payment_reminders').update(payload).eq('id', input.id);
        if (error) throw error;
        return input.id;
      } else {
        payload.created_by = authData.user.id;
        const { data, error } = await db
          .from('payment_reminders')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
      toast({
        title: vars.id ? 'Updated' : 'Created',
        description: `Reminder "${vars.name}" saved`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return mutation;
}

export function useTogglePaymentReminder() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await db
        .from('payment_reminders')
        .update({ is_active: input.is_active })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
      toast({ title: vars.is_active ? 'Activated' : 'Paused' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeletePaymentReminder() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('payment_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-reminders'] });
      toast({ title: 'Deleted', description: 'Reminder removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
