-- Payment Reminder system (Tidal Finance request)
-- "Nak ada function can create reminder untuk create PRF/buat payment.
--  Dynamic, user can add/edit any new PRF/payment yg perlu reminder."
--
-- Use cases:
--   - Pre-invoice reminders (e.g. "Chase Coway invoice for next month")
--   - Recurring payments (e.g. "Wifi bill due 5th of each month")

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount numeric(15,2),
  frequency text NOT NULL CHECK (frequency IN ('one_off', 'monthly', 'quarterly', 'yearly')),
  -- For one_off: anchor_date is the absolute target date.
  -- For recurring: anchor_date is the next occurrence; cron advances it after each fire.
  anchor_date date NOT NULL,
  lead_days int NOT NULL DEFAULT 3 CHECK (lead_days >= 0 AND lead_days <= 90),
  reminder_type text NOT NULL DEFAULT 'create_pv' CHECK (reminder_type IN ('create_prf', 'create_pv', 'general')),
  assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  next_fire_at timestamptz NOT NULL,
  last_fired_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_company ON public.payment_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_next_fire ON public.payment_reminders(next_fire_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_payment_reminders_assignee ON public.payment_reminders(assignee_id);

DROP TRIGGER IF EXISTS trg_payment_reminders_updated_at ON public.payment_reminders;
CREATE TRIGGER trg_payment_reminders_updated_at
  BEFORE UPDATE ON public.payment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_reminders_read_finance" ON public.payment_reminders;
CREATE POLICY "payment_reminders_read_finance"
  ON public.payment_reminders FOR SELECT TO authenticated
  USING (is_finance_user() OR assignee_id = auth.uid());

DROP POLICY IF EXISTS "payment_reminders_write_finance" ON public.payment_reminders;
CREATE POLICY "payment_reminders_write_finance"
  ON public.payment_reminders FOR ALL TO authenticated
  USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Allow new notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
  notification_type = ANY (ARRAY[
    'ot_approved'::text, 'ot_rejected'::text, 'ot_pending_review'::text,
    'ot_requests_new'::text, 'ot_requests_approved'::text, 'ot_requests_rejected'::text,
    'ot_pending_confirmation'::text, 'ot_supervisor_confirmed'::text,
    'leave_pending_review'::text, 'leave_approved'::text, 'leave_rejected'::text, 'leave_weekly_summary'::text,
    'claim_pending_review'::text, 'claim_approved'::text, 'claim_rejected'::text,
    'prf_pending_review'::text, 'prf_approved'::text, 'prf_rejected'::text,
    'pv_pending_review'::text, 'pv_approved'::text, 'pv_rejected'::text,
    'payment_reminder'::text, 'bank_recon_missing_pv'::text
  ])
);

-- Cron worker: fire reminders due today, advance recurring ones, deactivate one-offs
CREATE OR REPLACE FUNCTION public.process_payment_reminders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rem RECORD;
  fired_count int := 0;
  next_anchor date;
BEGIN
  FOR rem IN
    SELECT * FROM public.payment_reminders
    WHERE is_active = true AND next_fire_at <= now()
  LOOP
    INSERT INTO public.notifications (user_id, title, message, link, notification_type)
    VALUES (
      rem.assignee_id,
      'Payment Reminder: ' || rem.name,
      COALESCE(rem.description, '') ||
        CASE WHEN rem.amount IS NOT NULL THEN
          ' (Amount: RM ' || to_char(rem.amount, 'FM999,999,999.00') || ')'
        ELSE '' END ||
        ' — Due ' || to_char(rem.anchor_date, 'DD Mon YYYY'),
      CASE rem.reminder_type
        WHEN 'create_prf' THEN '/finance/ap/prf'
        WHEN 'create_pv'  THEN '/finance/ap/payment-vouchers'
        ELSE '/finance/dashboard'
      END,
      'payment_reminder'
    );

    fired_count := fired_count + 1;

    IF rem.frequency = 'one_off' THEN
      UPDATE public.payment_reminders
      SET is_active = false, last_fired_at = now()
      WHERE id = rem.id;
    ELSE
      next_anchor := CASE rem.frequency
        WHEN 'monthly'   THEN rem.anchor_date + interval '1 month'
        WHEN 'quarterly' THEN rem.anchor_date + interval '3 months'
        WHEN 'yearly'    THEN rem.anchor_date + interval '1 year'
      END;

      UPDATE public.payment_reminders
      SET
        anchor_date = next_anchor,
        next_fire_at = (next_anchor - (rem.lead_days || ' days')::interval)::timestamptz,
        last_fired_at = now()
      WHERE id = rem.id;
    END IF;
  END LOOP;

  RETURN fired_count;
END;
$$;

-- Schedule daily at 09:00 MYT (01:00 UTC)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-reminders') THEN
    PERFORM cron.schedule(
      'daily-payment-reminders',
      '0 1 * * *',
      $cron$SELECT public.process_payment_reminders();$cron$
    );
  END IF;
END;
$$;
