import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  notification_type:
    | 'ot_approved'
    | 'ot_rejected'
    | 'ot_pending_review'
    | 'ot_requests_new'
    | 'ot_requests_approved'
    | 'ot_requests_rejected'
    | 'ot_pending_confirmation'
    | 'ot_supervisor_confirmed'
    | 'leave_pending_review'
    | 'leave_approved'
    | 'leave_rejected'
    | 'claim_pending_review'
    | 'claim_approved'
    | 'claim_rejected'
    | 'leave_weekly_summary'
    | 'pv_submitted'
    | 'pv_checked'
    | 'pv_approved'
    | 'pv_rejected'
    | 'pv_paid'
    | 'pv_posted'
    | 'ap_invoice_submitted'
    | 'ap_invoice_approved'
    | 'ap_invoice_posted'
    | 'ap_payment_submitted'
    | 'ap_payment_checked'
    | 'ap_payment_approved'
    | 'ap_payment_posted'
    | 'ar_invoice_submitted'
    | 'ar_invoice_approved'
    | 'ar_invoice_posted'
    | 'or_submitted'
    | 'or_approved'
    | 'or_posted'
    | 'ar_payment_submitted'
    | 'ar_payment_approved'
    | 'ar_payment_posted';
  created_at: string;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []) as unknown as Notification[];
    },
    staleTime: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch when component mounts
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
