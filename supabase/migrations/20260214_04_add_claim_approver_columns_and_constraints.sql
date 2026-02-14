-- Step 2: Add columns and constraints after enum values are committed
-- This must run AFTER 20260214_03_add_claim_enum_values.sql

-- Add new columns to claims table for multi-level approval
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS director_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS director_remarks text,
  ADD COLUMN IF NOT EXISTS gm_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gm_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS gm_remarks text,
  ADD COLUMN IF NOT EXISTS head_finance_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS head_finance_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS head_finance_remarks text;

-- Drop and recreate the check constraint on claims table
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;

ALTER TABLE public.claims
  ADD CONSTRAINT claims_status_check
  CHECK (status IN (
    'pending_supervisor',
    'supervisor_approved',
    'pending_hr',
    'hr_approved',
    'pending_finance',
    'pending_director',
    'pending_gm',
    'pending_head_finance',
    'finance_approved',
    'director_approved',
    'gm_approved',
    'head_finance_approved',
    'rejected',
    'cancelled'
  ));

-- Update claim_types table to allow more final_approver options
ALTER TABLE public.claim_types DROP CONSTRAINT IF EXISTS claim_types_final_approver_check;
ALTER TABLE public.claim_types
  ADD CONSTRAINT claim_types_final_approver_check
  CHECK (final_approver IN ('hr', 'finance', 'director', 'gm', 'head_finance', 'assistant'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claims_director_id ON public.claims(director_id);
CREATE INDEX IF NOT EXISTS idx_claims_gm_id ON public.claims(gm_id);
CREATE INDEX IF NOT EXISTS idx_claims_head_finance_id ON public.claims(head_finance_id);

-- Add RLS policies for new approver roles
DROP POLICY IF EXISTS "claims_read_director" ON public.claims;
CREATE POLICY "claims_read_director" ON public.claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = director_id);

DROP POLICY IF EXISTS "claims_read_gm" ON public.claims;
CREATE POLICY "claims_read_gm" ON public.claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = gm_id);

DROP POLICY IF EXISTS "claims_read_head_finance" ON public.claims;
CREATE POLICY "claims_read_head_finance" ON public.claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = head_finance_id);
