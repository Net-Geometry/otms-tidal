-- Add new PRF statuses and remove 'pending'
ALTER TYPE ap_prf_status ADD VALUE IF NOT EXISTS 'prepared';
ALTER TYPE ap_prf_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE ap_prf_status ADD VALUE IF NOT EXISTS 'checked';

-- Add rejection and workflow tracking columns to purchase_requisitions
ALTER TABLE purchase_requisitions
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_remarks text,
  ADD COLUMN IF NOT EXISTS rejection_stage text,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS checked_at timestamptz;
