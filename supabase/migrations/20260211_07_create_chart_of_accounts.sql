-- Finance: chart of accounts master table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  account_code text NOT NULL UNIQUE,
  account_name text NOT NULL,
  account_type public.account_type NOT NULL,
  level int NOT NULL CHECK (level IN (1, 2, 3)),
  is_postable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  system_tag text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT coa_postable_only_level3 CHECK (is_postable = false OR level = 3),
  CONSTRAINT coa_level1_no_parent CHECK (level <> 1 OR parent_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_coa_parent_id ON public.chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_account_type ON public.chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_level ON public.chart_of_accounts(level);
CREATE INDEX IF NOT EXISTS idx_coa_is_active ON public.chart_of_accounts(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coa_system_tag_unique
  ON public.chart_of_accounts(system_tag)
  WHERE system_tag IS NOT NULL;

DROP TRIGGER IF EXISTS trg_chart_of_accounts_updated_at ON public.chart_of_accounts;
CREATE TRIGGER trg_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coa_read_authenticated" ON public.chart_of_accounts;
CREATE POLICY "coa_read_authenticated"
  ON public.chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coa_write_finance_admin" ON public.chart_of_accounts;
CREATE POLICY "coa_write_finance_admin"
  ON public.chart_of_accounts
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
