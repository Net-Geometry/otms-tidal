DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'coa_account_subtype' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.coa_account_subtype AS ENUM (
      'FA', 'IV', 'CA', 'OA', 'LT', 'CL', 'OL', 'CP', 'RV',
      'RE', 'SL', 'SA', 'OI', 'EO', 'CO', 'EP', 'TX', 'AP'
    );
  END IF;
END $$;

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS account_subtype public.coa_account_subtype;

CREATE INDEX IF NOT EXISTS idx_coa_account_subtype
  ON public.chart_of_accounts(account_subtype);
