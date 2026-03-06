-- Partial index on payment_vouchers for 'paid' status
-- Separate migration because new enum values must be committed before use in index predicates.
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status_paid
  ON public.payment_vouchers(status)
  WHERE status = 'paid';
