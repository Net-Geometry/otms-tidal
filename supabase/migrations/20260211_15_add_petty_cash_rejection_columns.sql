-- Add explicit rejection audit fields for petty cash workflow.

ALTER TABLE public.petty_cash_transactions
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_remarks text;

UPDATE public.petty_cash_transactions
SET
  rejected_by = approved_by,
  rejected_at = approved_at,
  rejection_remarks = approval_remarks
WHERE status = 'rejected'
  AND rejected_by IS NULL
  AND (approved_by IS NOT NULL OR approved_at IS NOT NULL OR approval_remarks IS NOT NULL);

UPDATE public.petty_cash_transactions
SET
  approved_by = NULL,
  approved_at = NULL,
  approval_remarks = NULL
WHERE status = 'rejected';
