/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendReminderInput {
  bankAccountName: string;
  statementDate: string;
  txnDate: string;
  description: string;
  reference: string;
  amount: number;
  isDebit: boolean;
}

/**
 * Notify all finance_admin users that a bank statement entry has no matching PV.
 * Used in Bank Reconciliation when AI matching leaves an "unmatched extracted"
 * transaction — likely the FA forgot to create the corresponding PV.
 */
export function useSendMissingPVReminder() {
  const db = supabase as any;
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SendReminderInput) => {
      const { data: faUsers, error: faErr } = await db
        .from('user_roles')
        .select('user_id')
        .eq('role', 'finance_admin');
      if (faErr) throw faErr;

      const recipients = ((faUsers || []) as { user_id: string }[]).map((r) => r.user_id);
      if (recipients.length === 0) {
        throw new Error('No finance_admin users found to notify');
      }

      const amountStr = `RM ${input.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const direction = input.isDebit ? 'payment out' : 'receipt in';

      const rows = recipients.map((userId) => ({
        user_id: userId,
        title: 'Bank statement entry has no PV',
        message:
          `Bank ${input.bankAccountName} statement (${input.statementDate}) has an unmatched ${direction} on ${input.txnDate}` +
          `: ${amountStr}` +
          (input.description ? ` — ${input.description}` : '') +
          (input.reference ? ` [Ref: ${input.reference}]` : '') +
          '. Please create the missing Payment Voucher.',
        link: '/finance/ap/payment-vouchers',
        notification_type: 'bank_recon_missing_pv',
      }));

      const { error } = await db.from('notifications').insert(rows);
      if (error) throw error;

      return recipients.length;
    },
    onSuccess: (count: number) => {
      toast({ title: 'Reminder sent', description: `Notified ${count} Finance Admin user(s)` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
