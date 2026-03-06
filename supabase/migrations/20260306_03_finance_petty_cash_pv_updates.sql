-- Finance: Petty cash multi-fund with line items + PV paid status + PV post-to type

-- 1. Create pv_post_to_type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pv_post_to_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pv_post_to_type AS ENUM ('cashbook', 'ap_payment', 'ap_credit_note');
  END IF;
END $$;

-- 2. Add 'paid' to ap_pv_status enum (after 'approved')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_pv_status' AND n.nspname = 'public' AND e.enumlabel = 'paid'
  ) THEN
    ALTER TYPE public.ap_pv_status ADD VALUE 'paid' AFTER 'approved';
  END IF;
END $$;

-- 3. Add columns to payment_vouchers
ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_to_type public.pv_post_to_type;

-- 4. Add fund_account_id to petty_cash_transactions
ALTER TABLE public.petty_cash_transactions
  ADD COLUMN IF NOT EXISTS fund_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT;

-- 5. Backfill fund_account_id from system_tag='petty_cash' COA account
UPDATE public.petty_cash_transactions
SET fund_account_id = (
  SELECT id FROM public.chart_of_accounts
  WHERE system_tag = 'petty_cash'
  LIMIT 1
)
WHERE fund_account_id IS NULL;

-- 6. Create petty_cash_transaction_lines table
CREATE TABLE IF NOT EXISTS public.petty_cash_transaction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id uuid NOT NULL REFERENCES public.petty_cash_transactions(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Index on petty_cash_transaction_lines(txn_id)
CREATE INDEX IF NOT EXISTS idx_petty_cash_transaction_lines_txn_id
  ON public.petty_cash_transaction_lines(txn_id);

-- 8. Backfill: create single line item from existing petty_cash_transactions
INSERT INTO public.petty_cash_transaction_lines (txn_id, account_id, description, amount, sort_order)
SELECT
  t.id,
  t.account_id,
  COALESCE(t.description, ''),
  COALESCE(t.amount, 0),
  0
FROM public.petty_cash_transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM public.petty_cash_transaction_lines l WHERE l.txn_id = t.id
);

-- 9. RLS on petty_cash_transaction_lines
ALTER TABLE public.petty_cash_transaction_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "petty_cash_lines_all_authenticated" ON public.petty_cash_transaction_lines;
CREATE POLICY "petty_cash_lines_all_authenticated"
  ON public.petty_cash_transaction_lines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 10. Partial index on payment_vouchers(status) WHERE status = 'paid'
-- NOTE: Applied as separate migration (20260306_04) because new enum values
-- must be committed before they can be used in index predicates.
