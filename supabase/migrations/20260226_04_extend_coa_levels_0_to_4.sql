ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS coa_postable_only_level3;

ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS coa_level1_no_parent;

ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_level_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.chart_of_accounts'::regclass
      AND conname = 'coa_level_range'
  ) THEN
    ALTER TABLE public.chart_of_accounts
      ADD CONSTRAINT coa_level_range CHECK (level IN (0, 1, 2, 3, 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.chart_of_accounts'::regclass
      AND conname = 'coa_postable_only_level3_or_4'
  ) THEN
    ALTER TABLE public.chart_of_accounts
      ADD CONSTRAINT coa_postable_only_level3_or_4 CHECK (is_postable = false OR level IN (3, 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.chart_of_accounts'::regclass
      AND conname = 'coa_level0_no_parent'
  ) THEN
    ALTER TABLE public.chart_of_accounts
      ADD CONSTRAINT coa_level0_no_parent CHECK (level <> 0 OR parent_id IS NULL);
  END IF;
END $$;
