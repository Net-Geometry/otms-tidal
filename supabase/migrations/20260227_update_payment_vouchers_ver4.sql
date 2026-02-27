-- Add 'others' and 'auto_debit' to ap_payment_method enum
ALTER TYPE public.ap_payment_method ADD VALUE IF NOT EXISTS 'others';
ALTER TYPE public.ap_payment_method ADD VALUE IF NOT EXISTS 'auto_debit';

-- Add new columns to payment_vouchers for PV Ver.4
ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS pay_to text,
  ADD COLUMN IF NOT EXISTS pay_for text,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method_other text;

-- Make supplier_id nullable (PV can be to non-supplier payees)
ALTER TABLE public.payment_vouchers
  ALTER COLUMN supplier_id DROP NOT NULL;

-- Create payment_voucher_lines table for line items (Date, Description, Cheque No., Amount)
CREATE TABLE IF NOT EXISTS public.payment_voucher_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id uuid NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  line_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  cheque_no text,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_voucher_lines_pv
  ON public.payment_voucher_lines(pv_id);

-- Enable RLS
ALTER TABLE public.payment_voucher_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_voucher_lines (same pattern as allocations)
DROP POLICY IF EXISTS "payment_voucher_lines_read_authenticated" ON public.payment_voucher_lines;
CREATE POLICY "payment_voucher_lines_read_authenticated"
  ON public.payment_voucher_lines
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payment_voucher_lines_write_finance_admin" ON public.payment_voucher_lines;
CREATE POLICY "payment_voucher_lines_write_finance_admin"
  ON public.payment_voucher_lines
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
