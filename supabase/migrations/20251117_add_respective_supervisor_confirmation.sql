-- Add new OT status enum values for respective supervisor confirmation
ALTER TYPE ot_status ADD VALUE IF NOT EXISTS 'pending_respective_supervisor_confirmation';
ALTER TYPE ot_status ADD VALUE IF NOT EXISTS 'respective_supervisor_confirmed';

-- Add respective supervisor confirmation columns to ot_requests table
ALTER TABLE public.ot_requests
ADD COLUMN IF NOT EXISTS respective_supervisor_id uuid NULL REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS respective_supervisor_confirmed_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS respective_supervisor_remarks text NULL;

-- Create index for respective supervisor queries
CREATE INDEX IF NOT EXISTS idx_ot_requests_respective_supervisor_id
ON public.ot_requests(respective_supervisor_id);

-- Add comments to new columns for documentation
COMMENT ON COLUMN public.ot_requests.respective_supervisor_id IS 'References the supervisor who is supervising the primary supervisor (manager of supervisor)';
COMMENT ON COLUMN public.ot_requests.respective_supervisor_confirmed_at IS 'Timestamp when the respective supervisor confirmed the OT request';
COMMENT ON COLUMN public.ot_requests.respective_supervisor_remarks IS 'Optional remarks from the respective supervisor during confirmation';

-- Create trigger to auto-set respective supervisor ID from supervisor's supervisor
CREATE OR REPLACE FUNCTION public.set_ot_respective_supervisor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If respective_supervisor_id is not explicitly set and we have a supervisor
  IF NEW.respective_supervisor_id IS NULL AND NEW.supervisor_id IS NOT NULL THEN
    -- Get the supervisor's supervisor from the profiles table
    SELECT supervisor_id INTO NEW.respective_supervisor_id
    FROM public.profiles
    WHERE id = NEW.supervisor_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to fire before insert on ot_requests to auto-set respective supervisor
DROP TRIGGER IF EXISTS ot_requests_set_respective_supervisor ON public.ot_requests;
CREATE TRIGGER ot_requests_set_respective_supervisor
BEFORE INSERT ON public.ot_requests
FOR EACH ROW EXECUTE PROCEDURE public.set_ot_respective_supervisor_id();

-- Add notification type enum values for respective supervisor confirmation
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ot_pending_respective_supervisor_confirmation';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ot_respective_supervisor_confirmed';

-- Update RLS policies for respective supervisor access

-- Drop existing policies if they exist
DROP POLICY IF EXISTS otr_respective_sup_read ON public.ot_requests;
DROP POLICY IF EXISTS otr_respective_sup_update ON public.ot_requests;

-- Allow respective supervisors to read OT requests they need to confirm
CREATE POLICY otr_respective_sup_read ON public.ot_requests
  FOR SELECT TO authenticated
  USING (
    -- Respective supervisor can read requests where they are the respective supervisor
    respective_supervisor_id = auth.uid()
    OR supervisor_id = auth.uid()
    OR employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow respective supervisors to update respective supervisor confirmation fields
CREATE POLICY otr_respective_sup_update ON public.ot_requests
  FOR UPDATE TO authenticated
  USING (
    -- Only respective supervisor can update their confirmation fields
    respective_supervisor_id = auth.uid()
  )
  WITH CHECK (
    respective_supervisor_id = auth.uid()
  );

-- Backfill respective_supervisor_id for existing OT requests
-- This automatically sets the respective supervisor from the supervisor's profile
UPDATE public.ot_requests r
SET respective_supervisor_id = p.supervisor_id
FROM public.profiles p
WHERE r.supervisor_id = p.id
  AND r.respective_supervisor_id IS NULL
  AND p.supervisor_id IS NOT NULL;

-- Create a view for pending respective supervisor confirmations
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

-- Rollback script (keep for documentation):
--
-- DROP TRIGGER IF EXISTS ot_requests_set_respective_supervisor ON public.ot_requests;
-- DROP FUNCTION IF EXISTS public.set_ot_respective_supervisor_id();
-- DROP VIEW IF EXISTS pending_respective_supervisor_confirmations;
-- DROP POLICY IF EXISTS otr_respective_sup_read ON public.ot_requests;
-- DROP POLICY IF EXISTS otr_respective_sup_update ON public.ot_requests;
-- ALTER TABLE public.ot_requests DROP COLUMN IF EXISTS respective_supervisor_remarks;
-- ALTER TABLE public.ot_requests DROP COLUMN IF EXISTS respective_supervisor_confirmed_at;
-- ALTER TABLE public.ot_requests DROP COLUMN IF EXISTS respective_supervisor_id;
-- DROP INDEX IF EXISTS idx_ot_requests_respective_supervisor_id;
-- Note: Enum values cannot be easily removed in PostgreSQL
