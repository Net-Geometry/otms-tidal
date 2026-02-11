-- Finance: petty cash transactions and workflow tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'petty_cash_txn_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.petty_cash_txn_type AS ENUM ('top_up', 'expenditure');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'petty_cash_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.petty_cash_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_number text NOT NULL UNIQUE,
  txn_type public.petty_cash_txn_type NOT NULL,
  txn_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,

  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  project_id uuid,
  receipt_urls text[] DEFAULT '{}',

  status public.petty_cash_status NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approval_remarks text,

  is_posted boolean NOT NULL DEFAULT false,
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  posting_reference text,
  posting_remarks text,

  running_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT petty_cash_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_txn_date ON public.petty_cash_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON public.petty_cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_requested_by ON public.petty_cash_transactions(requested_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_project_id ON public.petty_cash_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_is_posted ON public.petty_cash_transactions(is_posted);

DROP TRIGGER IF EXISTS trg_petty_cash_transactions_updated_at ON public.petty_cash_transactions;
CREATE TRIGGER trg_petty_cash_transactions_updated_at
  BEFORE UPDATE ON public.petty_cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "petty_cash_txn_read_finance_admin" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_read_finance_admin"
  ON public.petty_cash_transactions
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "petty_cash_txn_read_own" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_read_own"
  ON public.petty_cash_transactions
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS "petty_cash_txn_insert" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_insert"
  ON public.petty_cash_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "petty_cash_txn_update" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_update"
  ON public.petty_cash_transactions
  FOR UPDATE
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    requested_by = auth.uid()
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
