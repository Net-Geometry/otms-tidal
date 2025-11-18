-- Enhanced Respective Supervisor Workflow Migration
-- This migration modifies the respective supervisor confirmation to support:
-- 1. Manual assignment (not auto-assigned from org hierarchy)
-- 2. Denial workflow (send back to direct supervisor)
-- 3. Confirmation happens BEFORE supervisor final confirmation

-- Add new status value for denial scenario
ALTER TYPE ot_status ADD VALUE IF NOT EXISTS 'pending_supervisor_review';

-- Add denial tracking columns
ALTER TABLE public.ot_requests
ADD COLUMN IF NOT EXISTS respective_supervisor_denied_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS respective_supervisor_denial_remarks text NULL;

-- Add comments for new columns
COMMENT ON COLUMN public.ot_requests.respective_supervisor_denied_at IS 'Timestamp when the respective supervisor denied the OT request';
COMMENT ON COLUMN public.ot_requests.respective_supervisor_denial_remarks IS 'Remarks from the respective supervisor when denying the OT request';

-- Update comment for respective_supervisor_id to reflect manual assignment
COMMENT ON COLUMN public.ot_requests.respective_supervisor_id IS 'Manually assigned supervisor who instructed the overtime (optional)';

-- Remove the auto-assignment trigger since we want manual assignment
DROP TRIGGER IF EXISTS ot_requests_set_respective_supervisor ON public.ot_requests;
DROP FUNCTION IF EXISTS public.set_ot_respective_supervisor_id();

-- Add notification type for denial
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ot_respective_supervisor_denied';

-- Add notification type for requesting confirmation
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ot_request_respective_supervisor_confirmation';

-- Update RLS policies to allow supervisors to set respective_supervisor_id
-- Drop existing policy
DROP POLICY IF EXISTS otr_supervisor_update ON public.ot_requests;

-- Recreate supervisor update policy with ability to set respective_supervisor_id
CREATE POLICY otr_supervisor_update ON public.ot_requests
  FOR UPDATE TO authenticated
  USING (
    supervisor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    supervisor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Update the respective supervisor update policy to allow updating denial fields
DROP POLICY IF EXISTS otr_respective_sup_update ON public.ot_requests;

CREATE POLICY otr_respective_sup_update ON public.ot_requests
  FOR UPDATE TO authenticated
  USING (
    respective_supervisor_id = auth.uid()
  )
  WITH CHECK (
    respective_supervisor_id = auth.uid()
  );

-- Update the view to include denial information
DROP VIEW IF EXISTS pending_respective_supervisor_confirmations;

CREATE OR REPLACE VIEW pending_respective_supervisor_confirmations AS
SELECT
  r.id,
  r.employee_id,
  r.ot_date,
  r.total_hours,
  r.status,
  r.supervisor_id,
  r.respective_supervisor_id,
  r.supervisor_verified_at,
  r.supervisor_confirmation_at,
  r.respective_supervisor_confirmed_at,
  r.respective_supervisor_denied_at,
  r.respective_supervisor_remarks,
  r.respective_supervisor_denial_remarks,
  r.created_at,
  e.full_name as employee_name,
  s.full_name as supervisor_name,
  rs.full_name as respective_supervisor_name
FROM public.ot_requests r
LEFT JOIN public.profiles e ON r.employee_id = e.id
LEFT JOIN public.profiles s ON r.supervisor_id = s.id
LEFT JOIN public.profiles rs ON r.respective_supervisor_id = rs.id
WHERE r.status = 'pending_respective_supervisor_confirmation'
ORDER BY r.created_at DESC;

-- Create a view for requests pending supervisor review (after denial)
CREATE OR REPLACE VIEW pending_supervisor_review AS
SELECT
  r.id,
  r.employee_id,
  r.ot_date,
  r.total_hours,
  r.status,
  r.supervisor_id,
  r.respective_supervisor_id,
  r.supervisor_verified_at,
  r.respective_supervisor_denied_at,
  r.respective_supervisor_denial_remarks,
  r.created_at,
  e.full_name as employee_name,
  rs.full_name as respective_supervisor_name
FROM public.ot_requests r
LEFT JOIN public.profiles e ON r.employee_id = e.id
LEFT JOIN public.profiles rs ON r.respective_supervisor_id = rs.id
WHERE r.status = 'pending_supervisor_review'
ORDER BY r.created_at DESC;

-- Clear the backfilled respective_supervisor_id values since we want manual assignment
-- Only clear if they haven't been confirmed yet
UPDATE public.ot_requests
SET respective_supervisor_id = NULL
WHERE respective_supervisor_confirmed_at IS NULL
  AND respective_supervisor_denied_at IS NULL
  AND status NOT IN ('pending_respective_supervisor_confirmation', 'respective_supervisor_confirmed');

-- Rollback script (keep for documentation):
--
-- DROP VIEW IF EXISTS pending_supervisor_review;
-- DROP POLICY IF EXISTS otr_supervisor_update ON public.ot_requests;
-- DROP POLICY IF EXISTS otr_respective_sup_update ON public.ot_requests;
-- ALTER TABLE public.ot_requests DROP COLUMN IF EXISTS respective_supervisor_denial_remarks;
-- ALTER TABLE public.ot_requests DROP COLUMN IF EXISTS respective_supervisor_denied_at;
-- Note: Enum values cannot be easily removed in PostgreSQL
