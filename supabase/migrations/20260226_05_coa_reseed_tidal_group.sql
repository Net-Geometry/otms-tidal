-- COA: Add 'cost' to account_type enum, add special_type column, reseed full Tidal group COA
-- Also seeds missing subsidiary companies (TMSB, TPSB, TESB, TTSB)

-- 1) Add 'cost' to account_type enum
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'cost';

-- 2) Create special_type enum and column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'coa_special_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.coa_special_type AS ENUM (
      'AD', 'DC', 'CC', 'BA', 'CH', 'BS', 'OS', 'CS'
    );
  END IF;
END $$;

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS special_type public.coa_special_type;

CREATE INDEX IF NOT EXISTS idx_coa_special_type
  ON public.chart_of_accounts(special_type);

-- 3) Truncate existing COA data (no live transactions)
TRUNCATE public.chart_of_accounts CASCADE;

-- Reseed chart_of_accounts with full Tidal Holdings group COA
-- Generated from COA_TIDAL_1.9.xlsx

-- Create temp mapping table for parent lookups
CREATE TEMP TABLE _coa_map (code text PRIMARY KEY, id uuid NOT NULL);

-- Level 0 accounts (6 rows)
WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '1', 'APPLICATION OF FUNDS (ASSETS)', 'asset', NULL, NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '2', 'SOURCE OF FUNDS (LIABILITIES)', 'liability', 'LT', NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '3', 'EQUITY', 'equity', 'CP', NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '4', 'INCOME', 'revenue', 'SL', NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '5', 'COST', 'cost', 'CO', NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES (NULL, '6', 'EXPENSES', 'expense', 'EP', NULL, 0, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6', id FROM ins;

-- Level 1 accounts (12 rows)
WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1'), '1-100', 'NON-CURRENT ASSET', 'asset', 'FA', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1'), '1-200', 'CURRENT ASSETS', 'asset', 'CA', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1'), '1-300', 'OTHER ASSETS', 'asset', 'OA', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2'), '2-100', 'NON-CURRENT LIABILITIES', 'liability', 'LT', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2'), '2-200', 'CURRENT LIABILITIES', 'liability', 'CL', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2'), '2-300', 'OTHER LIABILITIES', 'liability', 'OL', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3'), '3-100', 'EQUITY', 'equity', 'CP', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4'), '4-100', 'INCOME (SALES & INCOME)', 'revenue', 'SL', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5'), '5-100', 'DIRECT COST RELATED', 'cost', 'CO', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6'), '6-100', 'EXPENSES (Indirect Cost)', 'expense', 'EP', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6'), '6-400', 'TAXATION', 'expense', 'TX', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6'), '6-500', 'APPROPRIATION ACCOUNT', 'expense', 'AP', NULL, 1, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-500', id FROM ins;

-- Level 2 accounts (67 rows)
WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100'), '1-100-000', 'Fixed Asset', 'asset', 'FA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100'), '1-105-000', 'Investment', 'asset', 'IV', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-200-X000', 'Trade Debtors', 'asset', 'CA', 'DC', 2, false, true, 0, 'trade_receivables')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-X000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-205-X000', 'Other Debtor', 'asset', 'CA', 'DC', 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-205-X000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-210-000', 'Other Debtors - Staff/Director', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-215-000', 'Amount Owing By Related Party', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-215-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-220-000', 'Advance For Renovation', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-220-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-225-000', 'Unknown Payment', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-225-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-230-000', 'Cash and Bank Balance', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-235-000', 'Stock', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-235-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200'), '1-240-000', 'Deposit & Prepayment', 'asset', 'CA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-300'), '1-300-000', 'Goodwill', 'asset', 'OA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-300-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-100'), '2-100-000', 'Redeemable Preference Shares', 'liability', 'LT', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-100'), '2-105-000', 'Term Loan (Long Term)', 'liability', 'LT', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-200-X000', 'Trade Creditors', 'liability', 'CL', NULL, 2, false, true, 0, 'trade_payables')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-X000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-205-X000', 'Other Creditors', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-X000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-210-000', 'Accruals', 'liability', 'CL', NULL, 2, false, true, 0, 'claims_payable')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-215-000', 'Contra Account', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-215-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-220-000', 'Term Loan (Short Term)', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-220-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-225-000', 'Amount Owing To - Ultimate Holding', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-230-000', 'Amount Owing To - Immediate Holding', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-230-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-235-000', 'Amount Owing To - Holding Company', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-240-000', 'Amount Owing To - Related Company', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200'), '2-245-000', 'Amount Owing To - Subsidiary', 'liability', 'CL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-300'), '2-300-000', 'Other Liabilities', 'liability', 'OL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-300-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100'), '3-100-000', 'SHARE CAPITAL', 'equity', 'CP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100'), '3-105-000', 'DIVIDEND PAYABLE', 'equity', 'CP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100'), '3-110-000', 'RESERVE', 'equity', 'RV', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-110-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100'), '3-115-000', 'RETAINED EARNING', 'equity', 'RE', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-115-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100'), '4-100-000', 'SALES', 'revenue', 'SL', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100'), '4-105-000', 'SALE ADJUSTMENT', 'revenue', 'SA', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100'), '4-110-000', 'OTHER INCOME', 'revenue', 'OI', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100'), '4-115-000', 'EXTRA ORDINARY INCOME', 'revenue', 'EO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-115-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-100-000', 'STOCK AT THE BEGINNING OF THE YEAR', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-105-000', 'PURCHASE', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-110-000', 'PURCHASED RETURN', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-110-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-115-000', 'CARRIAGE INWARDS', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-115-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-120-000', 'STOCK AT THE END OF THE YEAR', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-120-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-125-000', 'DIRECT COST', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100'), '5-130-000', 'OTHER DIRECT COST', 'cost', 'CO', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-130-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-100-000', 'PERSONNEL RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-105-000', 'BANK RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-110-000', 'PROFESSIONAL RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-115-000', 'STATUTORY RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-120-000', 'TRAVELLING & ACCOMODATION RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-125-000', 'COMPUTER, SOFTWARE & PERIPHERALS RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-125-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-130-000', 'COMMUNICATION RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-130-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-135-000', 'OCCUPATIONAL RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-140-000', 'UTILITIES RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-145-000', 'PANTRY/KITCHEN RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-145-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-150-000', 'GIFT, DONATION & CSR RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-155-000', 'ADMIN & STATIONERY RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-160-000', 'MOTOR VEHICLE RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-160-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-165-000', 'STAFF ACCOMODATION', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-170-000', 'SALES & MARKETING DISTRIBUTION', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-170-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-175-000', 'STAFF REFRESHMENT< RECREATIONAL< WELFARE & REWARD', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-175-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-180-000', 'FOOD & BEVERAGES RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-180-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-185-000', 'TRAINNG & COURSES RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-185-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-190-000', 'ENTERTAINMENT RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-190-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-195-000', 'NON-OPERATING RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-200-000', 'MACHINERY & EQUIPMENT RELATED  EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-200-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-205-000', 'RESEARCH & DEVELOPMENT RELATED EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-205-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-210-000', 'MISCELLANOUS', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-210-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-215-000', 'DIVIDEND EXPENSES', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-215-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100'), '6-220-000', 'UNKNOWN PAYMENT', 'expense', 'EP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-220-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-400'), '6-400-000', 'TAXATION', 'expense', 'TX', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-400-000', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-500'), '6-500-000', '???', 'expense', 'AP', NULL, 2, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-500-000', id FROM ins;

-- Level 3 accounts (278 rows)
WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-100', 'Furniture & Fittings', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-105', 'Accumulated Depreciation - Furniture & Fittings', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-200', 'Office Equipment', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-205', 'Accumulated Depreciation - Office Equipment', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-205', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-300', 'Motor Vehicle', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-305', 'Accumulated Depreciation - Motor Vehicle', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-305', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-400', 'Computer and Software', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-405', 'Accumulated Depreciation - Computer and Software', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-405', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-500', 'Electrical Installation', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-505', 'Accumulated Depreciation - Electrical Installation', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-505', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-600', 'Renovation', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-600', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-605', 'Accumulated Depreciation - Renovation', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-605', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-700', 'Mobile Phone', 'asset', 'FA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-700', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-100-000'), '1-100-705', 'Accumulated Depreciation - Mobile Phone', 'asset', 'FA', 'AD', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-100-705', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-000'), '1-105-100', 'Investment in Subsidiary', 'asset', 'IV', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200-X000'), '1-200-C001', 'CITAGLOBAL SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-C001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200-X000'), '1-200-E001', 'E&P O&M SERVICES SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-E001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200-X000'), '1-200-J001', 'JANAMURNI SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-J001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200-X000'), '1-200-M001', 'MUTU NUSANTARA SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-M001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-200-X000'), '1-200-T001', 'TOUCH MARVEL SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-200-T001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-205-X000'), '1-205-T001', 'TIDAL VENTURE SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-205-T001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-205-X000'), '1-205-T002', 'TIDAL TECHNICAL SUPPLY AND SERVICES SDN BHD', 'asset', 'CA', 'DC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-205-T002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-000'), '1-210-100', 'Loan to Staff', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-000'), '1-210-200', 'Loan to Director', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-215-000'), '1-215-100', 'Tidal Minds Sdn Bhd', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-215-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-215-000'), '1-215-200', 'Tidal Technical Supply and Services Sdn Bhd', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-215-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-215-000'), '1-215-300', 'Tidal Energy Sdn Bhd', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-215-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-215-000'), '1-215-400', 'Tidal Properties Sdn Bhd', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-215-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-220-000'), '1-220-001', 'Renovation - Betty Wolf', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-220-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-220-000'), '1-220-002', 'Renovation - Desraj', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-220-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-225-000'), '1-225-001', 'Unknown Payment', 'asset', 'CA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-225-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-000'), '1-230-100', 'Cash At Bank', 'asset', 'CA', NULL, 3, false, true, 0, 'cash_bank')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-000'), '1-230-200', 'Cash In Hand', 'asset', 'CA', NULL, 3, false, true, 0, 'cash_in_hand')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-235-000'), '1-235-100', 'Stock', 'asset', 'CA', 'BS', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-235-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-000'), '1-240-100', 'Deposit House Rental', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-000'), '1-240-200', 'Deposit Office', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-000'), '1-240-300', 'Deposit Utility', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-000'), '1-240-400', 'Deposit Supplier', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-000'), '1-240-500', 'Deposit Motor Vehicle', 'asset', 'CA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-300-000'), '1-300-100', 'Goodwill', 'asset', 'OA', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-300-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-100-000'), '2-100-100', 'Redeemable Preference Shares', 'liability', 'LT', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-100-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-105-000'), '2-105-100', 'JM - Ambank Financing Term Facility (LT)', 'liability', 'LT', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-105-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-105-000'), '2-105-200', 'TV - Ambank Financing Term Facility (LT)', 'liability', 'LT', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-105-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-A001', 'AM SALES & MARKETING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-A001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-B001', 'BLOSSOM4975', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-B001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-C001', 'CHOONG NGAI ENGINEERING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-C001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-C002', 'CYC HENG SERVICES ENTERPRISE', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-C002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-E001', 'ENC NATIONWIDE SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-E001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-E002', 'EVER CHOICE RENOVATION AND COSNTRUCTION SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-E002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-F001', 'FLYDA HARDWARE', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-F001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-F002', 'FLYSTAR TECHNOLOGY', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-F002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-F003', 'FUJI INTERIOR DESIGN & RENOVATION', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-F003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-H001', 'HB TEAM', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-H001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-I001', 'IFLAMEXI FIRE PROTECTION SERVICES', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-I001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-I002', 'INSIDE OUT DESIGN SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-I002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-J001', 'J ONE LOGISTICS', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-J001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-L001', 'LEEDEN SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-L001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-M001', 'MASH FOUR SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-M001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-M002', 'MENARA TEGUH OIL AND GAS ENGINEERING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-M002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-N001', 'NAM FANG TACTOR', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-N001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-N002', 'NET GEOMETRY SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-N002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-N003', 'NRI ENGINEERING SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-N003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-P001', 'PACIFIC OFFICE (M) SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-P001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-P002', 'PCD VENTURE SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-P002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-P003', 'PERMULA SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-P003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-R001', 'RENTOKILL INITIAL (M) SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-R001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-S001', 'SKY-WEST ENTERPRISE', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-S001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-S002', 'SS MOHAN KREN SERVICES', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-S002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-S003', 'SUN WINTRA HARDWARE TRADING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-S003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-T001', 'TT DINGIN ENGINEERING SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-T001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-T002', 'T&T LEGACY SUPPLIES & SERVICES', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-T002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-T003', 'TOP SLINGS TRADING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-T003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-T004', 'TGK OXYGEN SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-T004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-W001', 'WAYUS TRADING SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-W001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-W002', 'WENGPRINT ENTERPRISE', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-W002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-W003', 'WELDTECK SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-W003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-W004', 'WELD POWER  TECHNOLOGY & MACHINERY SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-W004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-200-X000'), '2-200-Y001', 'YONG HUAT ELECTRICAL', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-200-Y001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-A001', 'ADAM & CO', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-A001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-C001', 'CHOOI & COMPANY + CHEANG & ARIFF', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-C001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-C002', 'CROWE MALAYSIA PLT', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-C002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-I001', 'INDAH WATER KONSORTIUM SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-I001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-P001', 'POSEIDON SAFETY (M) SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-P001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-Q001', 'QUANTEPHI SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-Q001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-S001', 'SHAREWORKS SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-S001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-T001', 'TOUCH MOBILEGUARDS SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-T001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-T002', 'TELEKOM BERHAD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-T002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-T003', 'TRICOMAS MARKETING', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-T003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-U001', 'U-NI MAGNA SDN BHD', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-U001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-205-X000'), '2-205-Z001', 'ZAIN & CO', 'liability', 'CL', 'CC', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-205-Z001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-001', 'Wages & Salaries Accrued', 'liability', 'CL', NULL, 3, true, true, 0, 'salary_payable')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-002', 'EPF, SOCSO, EIS & PCB Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-003', 'Bonus Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-004', 'O.T. Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-005', 'Director Fee Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-006', 'Telephone, Fax and Wifi Charges Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-007', 'Electricity Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-008', 'Water Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-009', 'Sewerage Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-009', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-010', 'Accruals - Audit Fee', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-010', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-011', 'Consultation Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-011', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-012', 'Tidal Sports Club', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-012', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-210-000'), '2-210-013', 'CMTF-i Interest Accrued', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-210-013', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-215-000'), '2-215-001', 'Contra Account', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-215-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-220-000'), '2-220-001', 'JM - Ambank Financing Term Facility (ST)', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-220-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-220-000'), '2-220-002', 'TV - Ambank Financing Term Facility (ST)', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-220-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-001', 'TV - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-002', 'JM - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-003', 'TP - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-004', 'TM - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-005', 'TE - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-225-000'), '2-225-006', 'TTSS - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-225-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-230-000'), '2-230-001', 'JM - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-230-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-230-000'), '2-230-002', 'TTSS - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-230-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-001', 'JM - Tidal Venture Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-002', 'JM - Saujana Marine Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-003', 'TH - XVI Group Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-004', 'TV - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-005', 'TM - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-006', 'TP - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-007', 'TTSS - Tidal Venture Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-235-000'), '2-235-008', 'TE - Tidal Holding Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-235-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-001', 'JM - Tidal Technical Supply and Services Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-002', 'TV - Tidal Minds Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-003', 'TV - Tidal Energy Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-004', 'TV - Tidal Properties Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-005', 'TP - Tidal Ventures Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-006', 'TP - Tidal Minds Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-007', 'TP - Tidal Energy', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-008', 'TH - Touch Group Holding', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-009', 'TH - Touch Metal Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-009', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-010', 'TH - Ivory Task', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-010', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-011', 'TM - Tidal Energy Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-011', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-012', 'TM - Tidal Venture Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-012', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-013', 'TM - Tidal Properties', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-013', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-014', 'TE - Tidal Minds Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-014', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-015', 'TE - Tidal Venture Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-015', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-016', 'TE - Tidal Properties', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-016', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-240-000'), '2-240-017', 'TTSS - Janamurni Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-240-017', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-001', 'JM - EPOMS', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-002', 'TV - Janamurni Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-003', 'TV - Tidal Technical Supply and services Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-004', 'TH - Tidal Properties', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-005', 'TH - Tidal Ventures Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-006', 'TH - Tidal Minds Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-245-000'), '2-245-007', 'TH - Tidal Energy Sdn Bhd', 'liability', 'CL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-245-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '2-300-000'), '2-300-001', 'Other Liabilities', 'liability', 'OL', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '2-300-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100-000'), '3-100-001', 'Ordinary Share', 'equity', 'CP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-100-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-100-000'), '3-100-002', 'Preference Share', 'equity', 'CP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-100-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-105-000'), '3-105-001', 'Dividend Payable', 'equity', 'CP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-105-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-110-000'), '3-110-001', 'Reserve', 'equity', 'RV', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-110-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '3-115-000'), '3-115-001', 'Retained Earning', 'equity', 'RE', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '3-115-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-000'), '4-100-100', 'Dividend Income', 'revenue', 'SL', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-000'), '4-100-200', 'Sales Revenue', 'revenue', 'SL', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-105-000'), '4-105-100', 'Return Inwards', 'revenue', 'SA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-105-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-105-000'), '4-105-200', 'Discount Allowed', 'revenue', 'SA', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-105-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-001', 'Interest Income', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-002', 'Gain On Foreign Exchange', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-003', 'Misc Non-Cash Credit/Bank', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-004', 'Sale of Asset', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-005', 'Sale of Scrap', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-006', 'Sublease/Leasing', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-007', 'Sponsorship/Donation Received', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-110-000'), '4-110-008', 'Hibah', 'revenue', 'OI', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-110-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-115-000'), '4-115-001', 'Extra Ordinary Income', 'revenue', 'EO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-115-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-100-000'), '5-100-001', 'Addd', 'cost', 'CO', 'OS', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-100-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-105-000'), '5-105-001', 'Addd', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-105-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-110-000'), '5-110-001', 'Addd', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-110-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-115-000'), '5-115-001', 'Addd', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-115-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-120-000'), '5-120-001', 'Addd', 'cost', 'CO', 'CS', 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-120-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-001', 'Raw Material', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-002', 'Labor Cost', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-003', 'Machinery Hire', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-004', 'Transportation Cost', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-005', 'Loose Tools', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-006', 'Work Permit', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-007', 'Custom Duty & Freight Charges', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-125-000'), '5-125-008', 'Landlord', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-125-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-130-000'), '5-130-001', 'Discount Received', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-130-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-130-000'), '5-130-002', 'Debit Note', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-130-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '5-130-000'), '5-130-003', 'Goods Return Note', 'cost', 'CO', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '5-130-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-100', 'Staff Salary', 'expense', 'EP', NULL, 3, false, true, 0, 'payroll_gross')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-200', 'Wages', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-300', 'Bonus', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-400', 'Overtime', 'expense', 'EP', NULL, 3, false, true, 0, 'overtime_expense')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-500', 'Allowance', 'expense', 'EP', NULL, 3, false, true, 0, 'allowance_expense')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-600', 'Directors Fee', 'expense', 'EP', NULL, 3, false, true, 0, 'director_fee')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-600', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-700', 'Directors Allowance', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-700', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-800', 'Staff Benefit', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-800', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-000'), '6-100-900', 'Director Benefit', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-900', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-001', 'Bank Charges', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-002', 'Bank Arrangement Fee', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-003', 'Agency Fee', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-004', 'Interest On CMTF-i Facilitiy', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-005', 'Sales & Service Tax (SST)', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-006', 'Interest On i-Term Financing FL', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-105-000'), '6-105-007', 'Hire Purchase Interest', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-105-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-100', 'Legal Fees', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-200', 'Registration Fees', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-300', 'Accounting, Audit & Secretary', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-400', 'Membership Fees', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-500', 'Securities Services', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-600', 'Advisor/Consultation Fees', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-600', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-700', 'Stamp Duty', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-700', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-800', 'SSM Related Expenses', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-800', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-000'), '6-110-900', 'Management Fees', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-900', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-000'), '6-115-100', 'Employer', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-000'), '6-115-200', 'PCB', 'expense', 'EP', NULL, 3, true, true, 0, 'pcb_payable')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-000'), '6-115-300', 'HRDF', 'expense', 'EP', NULL, 3, true, true, 0, 'hrdc_levy')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-001', 'Flight Ticket/Mileage Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-002', 'Toll', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-003', 'Parking Charges', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-004', 'Accomodation', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-005', 'Petrol', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-006', 'Summon/Field', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-007', 'Transportation', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-008', 'Travelling Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-120-000'), '6-120-009', 'Travelling Miscellanous', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-120-009', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-125-000'), '6-125-001', 'Software and IT Related', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-125-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-125-000'), '6-125-002', 'Upkeep of Computer', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-125-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-125-000'), '6-125-003', 'Subscription Fee', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-125-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-125-000'), '6-125-004', 'Office Astro', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-125-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-130-000'), '6-130-001', 'Office Telephone & Wifi - Telekom', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-130-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-130-000'), '6-130-002', 'Telephone Bill Charges', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-130-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-130-000'), '6-130-003', 'House Telephone & Wifi - Astro', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-130-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-000'), '6-135-100', 'Office Rental', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-000'), '6-135-200', 'Other Rental', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-000'), '6-135-300', 'Upkeep Office', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-000'), '6-135-400', 'Office Parking - Uni Magna', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-000'), '6-135-500', 'Assessment Tax & Quit Rent', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-000'), '6-140-100', 'Utilities Charges', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-000'), '6-140-200', 'Sewerage Charges', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-145-000'), '6-145-100', 'Pantry/Kitchen Utensil', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-145-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-000'), '6-150-100', 'Donation - Tahfiz', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-000'), '6-150-200', 'Donation - Tax Exempt', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-000'), '6-150-300', 'Donation', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-000'), '6-150-400', 'Gift', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-400', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-000'), '6-150-500', 'Corporate Social Responsibility', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-500', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-001', 'Printing', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-002', 'Stationery', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-003', 'Decoration', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-004', 'Uniform', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-005', 'Cleaning Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-006', 'License Fee', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-006', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-007', 'General and Administratives Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-007', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-008', 'Postage & Courier', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-008', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-155-000'), '6-155-009', 'Business License', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-155-009', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-160-000'), '6-160-001', 'Upkeep of Motor Vehicle', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-160-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-160-000'), '6-160-002', 'Road Tax & Insurance', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-160-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-160-000'), '6-160-003', 'Car Rental - Proton', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-160-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-000'), '6-165-100', 'House Rental', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-100', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-000'), '6-165-200', 'Coway Rental', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-200', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-000'), '6-165-300', 'Upkeep House', 'expense', 'EP', NULL, 3, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-300', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-170-000'), '6-170-001', 'Sales Commission', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-170-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-170-000'), '6-170-002', 'Marketing', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-170-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-170-000'), '6-170-003', 'Advertisement', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-170-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-175-000'), '6-175-001', 'Staff Refreshment', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-175-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-175-000'), '6-175-002', 'Staff Recretional', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-175-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-175-000'), '6-175-003', 'Staff Welfare', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-175-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-175-000'), '6-175-004', 'Staff Reward', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-175-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-180-000'), '6-180-001', 'Food & Refreshment', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-180-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-185-000'), '6-185-001', 'Staff - Training & Courses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-185-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-185-000'), '6-185-002', 'Director - Training & Courses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-185-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-185-000'), '6-185-003', 'Recruitment Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-185-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-190-000'), '6-190-001', 'Entertainment', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-190-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-195-000'), '6-195-001', 'Depreciation of Fixed Assets', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-195-000'), '6-195-002', 'Loss On Disposal', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-195-000'), '6-195-003', 'Provision For Bad Debt', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-003', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-195-000'), '6-195-004', 'Bad Debt', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-004', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-195-000'), '6-195-005', 'Loss On Foreign Exchange', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-195-005', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-200-000'), '6-200-001', 'Upkeep Machinery', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-200-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-205-000'), '6-205-001', 'R&D', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-205-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-210-000'), '6-210-001', 'General Miscellanous', 'expense', 'EP', NULL, 3, true, true, 0, 'claims_expense')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-210-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-215-000'), '6-215-001', 'Dividend Expenses', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-215-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-220-000'), '6-220-001', 'Petty Cash - Unknown Payment', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-220-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-220-000'), '6-220-002', 'Bank - Unknown Payment', 'expense', 'EP', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-220-002', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-400-000'), '6-400-001', 'CP204', 'expense', 'TX', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-400-001', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-400-000'), '6-400-002', 'Tax Computation', 'expense', 'TX', NULL, 3, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-400-002', id FROM ins;

-- Level 4 accounts (157 rows)
WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-101', 'EPOMS', 'asset', 'IV', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-102', 'TIDAL VENTURE', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-103', 'TIDAL TECHNICAL', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-104', 'JANAMURNI', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-104', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-105', 'TIDAL HOLDING', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-106', 'TIDAL MINDS', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-106', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-107', 'TIDAL ENERGY', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-107', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-105-100'), '1-105-108', 'TIDAL PROPERTIES', 'asset', 'IV', NULL, 4, false, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-105-108', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-101', 'Staff 1', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-102', 'Staff 2', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-103', 'Loan to Staff - Staff 3 (H)', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-104', 'Loan to Staff - Staff 4 (S)', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-104', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-105', 'Loan to Staff - Staff 5 A', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-106', 'Loan to Staff - Staff 6 R', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-106', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-107', 'Loan to Staff - Staff 7 A', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-107', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-100'), '1-210-108', 'Advance to Staff', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-108', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-210-200'), '1-210-201', 'Amount Owing By Director', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-210-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-101', 'JM - Malayan Banking Berhad (A/C No : 564016666127)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-102', 'JM - Malayan Banking Berhad (A/C No : 564016666127', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-103', 'JM - Malayan Banking Berhad (A/C No : 564016666134)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-104', 'JM - Ambank AM Berhad (A/C No : 8881049458216)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-104', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-105', 'JM - Ambank - FSRA (A/C No : 8881053971414)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-106', 'JM - Term Deposit-i (A/C No : 8881053971425)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-106', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-107', 'JM - Ambank ESCROW Account (A/C : 8881053971403)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-107', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-108', 'TV - Maybank Current Account (A/C No: 564427532534)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-108', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-109', 'TV - Ambank current Account (A/C No: 8881054035644)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-109', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-110', 'TV - Ambank - FSRA (A/C No: 8881059246505)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-110', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-111', 'TV - Ambank ESCROW Accoount (A/C No: 8881059246481)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-111', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-112', 'TV - Term Deposit-i (A/C NO: 8881059247292)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-112', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-113', 'TV - Term Deposit-i (A/C NO: 8881059299829)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-113', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-114', 'TV - Term Deposit-i (A/C NO: 8881059347831)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-114', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-115', 'TH - Maybank Current Account (A/C NO: 564427532482)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-115', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-116', 'TH - Ambank Current Account (A/C NO : 8881054012661)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-116', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-117', 'TTSS - Ambank (A/C: 8881059113664)', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-117', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-100'), '1-230-118', 'Suspend Account', 'asset', 'CA', 'BA', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-118', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-201', 'Petty Cash', 'asset', 'CA', 'CH', 4, true, true, 0, 'petty_cash')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-202', 'Petty Cash - AS', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-202', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-203', 'Petty Cash - SA', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-203', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-204', 'Petty Cash - IS', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-204', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-205', 'Petty Cash - Muhaiyiddin', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-205', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-206', 'Petty Cash - T', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-206', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-207', 'Petty Cash - Safe Box', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-207', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-208', 'Petty Cash - OT', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-208', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-230-200'), '1-230-209', 'Petty Cash - Bo', 'asset', 'CA', 'CH', 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-230-209', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-100'), '1-240-101', 'Deposit - D''Shire', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-100'), '1-240-102', 'Deposit - Mutiara Homes', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-200'), '1-240-201', 'Deposit - U-Ni Magna Sdn Bhd', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-300'), '1-240-301', 'Deposit - TNB Level 1', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-301', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-300'), '1-240-302', 'Deposit - TNB Level 2', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-302', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-400'), '1-240-401', 'Deposit - Tricomas Marketing Sdn Bhd', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-401', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-400'), '1-240-402', 'Deposit - Betty and Wolf Design Sdn Bhd', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-402', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-400'), '1-240-403', 'Deposit - Desraj A/L M.Nallathamby', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-403', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-400'), '1-240-404', 'Deposit - Petronas', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-404', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-500'), '1-240-501', 'Deposit - Proton X-70', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-501', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-500'), '1-240-502', 'Deposit - Proton X-50', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-502', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '1-240-500'), '1-240-503', 'Deposit - Toyota Alphard', 'asset', 'CA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '1-240-503', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-100'), '4-100-101', 'Dividend Income', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-201', 'One Time Invoice', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-202', 'Progress', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-202', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-203', 'Advance', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-203', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-204', 'Deposit', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-204', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-205', 'Debit Note', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-205', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-206', 'Retention Money', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-206', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-207', 'Pass Thru Cost', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-207', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-208', 'Rental Income', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-208', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-100-200'), '4-100-209', 'Out Of Pocket Income', 'revenue', 'SL', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-100-209', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-105-100'), '4-105-101', 'Return Inwards', 'revenue', 'SA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-105-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '4-105-200'), '4-105-201', 'Discount To Client', 'revenue', 'SA', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '4-105-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-100'), '6-100-101', 'Staff Salary', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-200'), '6-100-201', 'Wages', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-300'), '6-100-301', 'Staff Bonus', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-301', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-300'), '6-100-302', 'Director Bonus', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-302', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-400'), '6-100-401', 'Overtime', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-401', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-500'), '6-100-501', 'Allowance', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-501', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-500'), '6-100-502', 'Allowance - Intern', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-502', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-500'), '6-100-503', 'Meal Allowance', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-503', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-500'), '6-100-504', 'Telephone Allowance', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-504', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-500'), '6-100-505', 'Travelling Allowance', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-505', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-601', 'Director 1', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-601', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-602', 'Director 2', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-602', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-603', 'Director 3', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-603', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-604', 'Director 4', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-604', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-605', 'Director 5', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-605', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-600'), '6-100-606', 'Director 6', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-606', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-701', 'Directors Allowance - Director 1', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-701', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-702', 'Directors Allowance - Director 2', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-702', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-703', 'Directors Allowance - Director 3', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-703', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-704', 'Directors Allowance - Director 4', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-704', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-705', 'Directors Allowance - Director 5', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-705', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-700'), '6-100-706', 'Directors Allowance - Director 6', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-706', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-801', 'Staff Benefit - Others', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-801', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-802', 'Staff - Benefit - Membership License', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-802', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-803', 'Staff Benefit - Staff Leave Expense', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-803', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-804', 'Staff - Medical Fees', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-804', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-805', 'Staff Insurance', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-805', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-800'), '6-100-806', 'Compensation', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-806', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-900'), '6-100-901', 'Leave Passage', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-901', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-100-900'), '6-100-902', 'Director - Medical Fees', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-100-902', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-101', 'Legal Fees - Zain & Co', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-102', 'Legal Fees - Abd Rahman & Partner', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-103', 'Legal Fees - Adnan Sundra & Low', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-104', 'Legal Fees - DShire Tenancy Agreement', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-104', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-105', 'Legal Fees - Bahari & Bahari', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-106', 'Legal Fees Azlan Shah Sukhdev & Co', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-106', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-107', 'Legal Fees - RMS Smart Ventures', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-107', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-100'), '6-110-108', 'Legal Fees - Chooi & Company + Chenag Ariff', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-108', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-200'), '6-110-201', 'Registration Fees - Fazlie Bin Hj Ahmador', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-200'), '6-110-202', 'Registration Fees', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-202', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-300'), '6-110-301', 'Audit Fee', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-301', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-300'), '6-110-302', 'Audit Disbursement', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-302', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-300'), '6-110-303', 'Secretarial Fees', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-303', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-400'), '6-110-401', 'Membership - MIA', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-401', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-400'), '6-110-402', 'Membership - ACCA', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-402', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-400'), '6-110-403', 'Membership - Institute Internal Auditors', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-403', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-500'), '6-110-501', 'Security Services - TMS', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-501', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-500'), '6-110-502', 'Security Services - MH', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-502', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-601', 'Consultation Fee - Shahzan House', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-601', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-602', 'Consultation Fee - Shahzan Quantephi', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-602', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-603', 'Consultation Fee - Litosfera', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-603', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-604', 'Consultation Fee - Paperwork Trading', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-604', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-605', 'Consultation Fee - Jamal', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-605', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-606', 'Consultation Fee - Mohamad Riaz', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-606', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-607', 'Consultation Fee - Others', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-607', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-608', 'Prefessional Fee', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-608', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-609', 'Advisory Fee - Anuar Bin Abd Rahman', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-609', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-600'), '6-110-610', 'Shariah Advisory Fee', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-610', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-700'), '6-110-701', 'Stamp Duty - Office Rental Agreement', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-701', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-700'), '6-110-702', 'Stamp Duty - Loan Agreement', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-702', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-700'), '6-110-703', 'Stamp Duty - Legal', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-703', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-700'), '6-110-704', 'Stamp Duty - Pemungut Duti Setem', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-704', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-800'), '6-110-801', 'Addd', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-801', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-110-900'), '6-110-901', 'Addd', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-110-901', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-100'), '6-115-101', 'EPF - Employer', 'expense', 'EP', NULL, 4, true, true, 0, 'epf_employer')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-100'), '6-115-102', 'Socso - Employer', 'expense', 'EP', NULL, 4, true, true, 0, 'socso_employer')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-115-100'), '6-115-103', 'EIS - Employer', 'expense', 'EP', NULL, 4, true, true, 0, 'eis_employer')
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-115-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-100'), '6-135-101', 'Office Rental - Level 2 TSR', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-200'), '6-135-201', 'Plant Rental', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-200'), '6-135-202', 'Coway Rental - Air Purifier/Water Dispenser', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-202', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-135-200'), '6-135-203', 'Printer Rental', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-135-203', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-101', 'Utility: Meter 1-1', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-102', 'Utility: Meter 1-2', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-103', 'Utility: DShire', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-104', 'Utility: Meter 2-1', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-104', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-105', 'Utility: Meter 2-2', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-105', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-106', 'Utility: Mutiara Homes', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-106', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-100'), '6-140-107', 'Utility: Water Charges', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-107', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-140-200'), '6-140-201', 'Sewerage Charges - Office Level 2', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-140-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-500'), '6-150-501', 'CSR - Staff', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-501', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-150-500'), '6-150-502', 'CSR - Others', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-150-502', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-100'), '6-165-101', 'House Rental - DShire', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-101', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-100'), '6-165-102', 'House Rental - Tropcana', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-102', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-100'), '6-165-103', 'House Rental - Mutiara Homes', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-103', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-200'), '6-165-201', 'Coway Rental - DShire', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-201', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-200'), '6-165-202', 'Coway Rental - Mutiara Homes', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-202', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-300'), '6-165-301', 'Upkeep House - DShire', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-301', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-300'), '6-165-302', 'Upkeep - Tropicana', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-302', id FROM ins;

WITH ins AS (
  INSERT INTO public.chart_of_accounts (parent_id, account_code, account_name, account_type, account_subtype, special_type, level, is_postable, is_active, sort_order, system_tag)
  VALUES ((SELECT id FROM _coa_map WHERE code = '6-165-300'), '6-165-303', 'Upkeep House - Mutiara Homes', 'expense', 'EP', NULL, 4, true, true, 0, NULL)
  RETURNING id
)
INSERT INTO _coa_map (code, id) SELECT '6-165-303', id FROM ins;

-- Clean up temp table
DROP TABLE _coa_map;

-- 5) Seed missing companies under THSB
INSERT INTO public.companies (name, code, parent_company_id)
SELECT sub.name, sub.code, parent.id
FROM (VALUES
  ('Tidal Minds Sdn Bhd', 'TMSB'),
  ('Tidal Properties Sdn Bhd', 'TPSB'),
  ('Tidal Energy Sdn Bhd', 'TESB'),
  ('Tidal Techkem Sdn Bhd', 'TTSB')
) AS sub(name, code)
CROSS JOIN (SELECT id FROM public.companies WHERE code = 'THSB') AS parent
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies WHERE code = sub.code
);
