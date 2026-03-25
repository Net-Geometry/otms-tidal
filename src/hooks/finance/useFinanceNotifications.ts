import { supabase } from '@/integrations/supabase/client';

type FinanceNotificationType =
  | 'pv_submitted' | 'pv_checked' | 'pv_approved' | 'pv_rejected' | 'pv_paid' | 'pv_posted'
  | 'ap_invoice_submitted' | 'ap_invoice_approved' | 'ap_invoice_posted'
  | 'ap_payment_submitted' | 'ap_payment_checked' | 'ap_payment_approved' | 'ap_payment_posted'
  | 'ar_invoice_submitted' | 'ar_invoice_approved' | 'ar_invoice_posted'
  | 'or_submitted' | 'or_approved' | 'or_posted'
  | 'ar_payment_submitted' | 'ar_payment_approved' | 'ar_payment_posted';

const NOTIFICATION_TITLES: Record<FinanceNotificationType, string> = {
  pv_submitted: 'PV Submitted for Approval',
  pv_checked: 'PV Checked',
  pv_approved: 'PV Approved',
  pv_rejected: 'PV Rejected',
  pv_paid: 'PV Marked as Paid',
  pv_posted: 'PV Posted to GL',
  ap_invoice_submitted: 'AP Invoice Submitted',
  ap_invoice_approved: 'AP Invoice Approved',
  ap_invoice_posted: 'AP Invoice Posted to GL',
  ap_payment_submitted: 'AP Payment Submitted',
  ap_payment_checked: 'AP Payment Checked',
  ap_payment_approved: 'AP Payment Approved',
  ap_payment_posted: 'AP Payment Posted',
  ar_invoice_submitted: 'AR Invoice Submitted',
  ar_invoice_approved: 'AR Invoice Approved',
  ar_invoice_posted: 'AR Invoice Posted to GL',
  or_submitted: 'Official Receipt Submitted',
  or_approved: 'Official Receipt Approved',
  or_posted: 'Official Receipt Posted to GL',
  ar_payment_submitted: 'AR Payment Submitted',
  ar_payment_approved: 'AR Payment Approved',
  ar_payment_posted: 'AR Payment Posted',
};

const NOTIFICATION_LINKS: Record<string, string> = {
  pv: '/finance/ap/payment-vouchers',
  ap_invoice: '/finance/ap/invoices',
  ap_payment: '/finance/ap/payments',
  ar_invoice: '/finance/ar/invoices',
  or: '/finance/ar/official-receipts',
  ar_payment: '/finance/ar/payments',
};

function getDocPrefix(type: FinanceNotificationType): string {
  if (type.startsWith('pv_')) return 'pv';
  if (type.startsWith('ap_invoice_')) return 'ap_invoice';
  if (type.startsWith('ap_payment_')) return 'ap_payment';
  if (type.startsWith('ar_invoice_')) return 'ar_invoice';
  if (type.startsWith('or_')) return 'or';
  if (type.startsWith('ar_payment_')) return 'ar_payment';
  return '';
}

/**
 * Preference group for a notification type.
 * AP types → finance_ap_notifications, AR types → finance_ar_notifications.
 */
function getPreferenceGroup(type: FinanceNotificationType): string {
  const prefix = getDocPrefix(type);
  if (['pv', 'ap_invoice', 'ap_payment'].includes(prefix)) return 'finance_ap_notifications';
  return 'finance_ar_notifications';
}

/**
 * Send an in-app notification to all finance-role users (except the actor).
 * Silently fails so it never blocks the primary mutation.
 */
export async function createFinanceNotification(
  type: FinanceNotificationType,
  documentNumber: string,
  message?: string,
) {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const actorId = authData?.user?.id;
    if (!actorId) return;

    // Get all users with 'finance' role
    const db = supabase as any;
    const { data: financeUsers, error: rolesError } = await db
      .from('user_roles')
      .select('user_id')
      .eq('role', 'finance');

    if (rolesError || !financeUsers?.length) return;

    // Filter out the actor
    const recipientIds: string[] = financeUsers
      .map((r: { user_id: string }) => r.user_id)
      .filter((uid: string) => uid !== actorId);

    if (!recipientIds.length) return;

    // Check each recipient's notification preferences
    const prefKey = getPreferenceGroup(type);
    const { data: profiles } = await db
      .from('profiles')
      .select('id, notification_preferences')
      .in('id', recipientIds);

    const eligibleIds = (profiles || [])
      .filter((p: any) => {
        const prefs = p.notification_preferences;
        if (!prefs) return true; // default = enabled
        if (prefs.all_disabled) return false;
        if (prefs[prefKey] === false) return false;
        return true;
      })
      .map((p: any) => p.id);

    if (!eligibleIds.length) return;

    const link = NOTIFICATION_LINKS[getDocPrefix(type)] || null;
    const title = NOTIFICATION_TITLES[type];
    const body = message || documentNumber;

    const rows = eligibleIds.map((userId: string) => ({
      user_id: userId,
      title,
      message: body,
      link,
      notification_type: type,
      is_read: false,
    }));

    await db.from('notifications').insert(rows);
  } catch (err) {
    // Never block the primary operation
    console.error('[FinanceNotification] Failed to send notification:', err);
  }
}
