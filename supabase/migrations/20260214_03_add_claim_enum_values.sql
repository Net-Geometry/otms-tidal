-- Step 1: Add new enum values to claim_request_status enum
-- This must be in a separate transaction before using the new values

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_director' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'pending_director';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_gm' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'pending_gm';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_head_finance' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'pending_head_finance';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'director_approved' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'director_approved';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gm_approved' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'gm_approved';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'head_finance_approved' AND enumtypid = 'public.claim_request_status'::regtype) THEN
    ALTER TYPE public.claim_request_status ADD VALUE 'head_finance_approved';
  END IF;
END $$;
