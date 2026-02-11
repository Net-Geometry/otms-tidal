-- Payroll Management: Add payroll-related fields to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS epf_category text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS is_director boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS director_fee numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text;
