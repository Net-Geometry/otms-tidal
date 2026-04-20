-- Tidal Finance: PV line items now carry their own GL account.
-- GL coding moves from PRF (removed) to PV line items.
-- On posting, each PV line debits its selected GL account.

ALTER TABLE public.payment_voucher_lines
  ADD COLUMN IF NOT EXISTS gl_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_payment_voucher_lines_gl_account_id
  ON public.payment_voucher_lines(gl_account_id);
