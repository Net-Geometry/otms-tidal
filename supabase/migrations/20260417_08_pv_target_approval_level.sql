-- Tidal Finance request: FA chooses how high a PV needs to be escalated.
-- 'fa'       = Finance Admin self-approves (skip AM and DMD)
-- 'asst_mgr' = needs Assistant Manager check (skip DMD)
-- 'dmd'      = full chain: AM check → DMD approval (current default behavior)
--
-- Existing PVs default to 'dmd' to preserve current behavior.

ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS target_approval_level text NOT NULL DEFAULT 'dmd'
    CHECK (target_approval_level IN ('fa', 'asst_mgr', 'dmd'));
