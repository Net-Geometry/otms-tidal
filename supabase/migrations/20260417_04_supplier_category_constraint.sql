-- Constrain supplier category to fixed values per Tidal Finance request:
-- "Other Creditors" (e.g. company secretary) vs "Trade Creditors" (suppliers).
-- Migrate legacy free-text values to the two canonical values, then enforce
-- with a CHECK constraint.

UPDATE public.suppliers
SET category = CASE
  WHEN LOWER(TRIM(category)) IN ('other payable', 'other creditor', 'other creditors', 'others') THEN 'other_creditors'
  WHEN LOWER(TRIM(category)) IN ('trade creditor', 'trade creditors', 'trade payable', 'services', 'general', 'utilities') THEN 'trade_creditors'
  ELSE NULL
END
WHERE category IS NOT NULL;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_category_check;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_category_check
  CHECK (category IS NULL OR category IN ('trade_creditors', 'other_creditors'));
