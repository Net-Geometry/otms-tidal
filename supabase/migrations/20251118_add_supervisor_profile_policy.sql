-- Add RLS policy to allow supervisors to read profile data for:
-- 1. Their own profile
-- 2. Profiles of employees they directly supervise
-- 3. Profiles of respective supervisors assigned to OT requests they handle

DROP POLICY IF EXISTS "prof_supervisor_read" ON public.profiles;

CREATE POLICY "prof_supervisor_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Allow reading own profile
    id = auth.uid()
    OR
    -- Allow supervisors to read profiles of their direct employees (employees they supervise)
    supervisor_id = auth.uid()
    OR
    -- Allow respective supervisors to read employee profiles in OT requests
    id IN (
      SELECT DISTINCT employee_id
      FROM public.ot_requests
      WHERE respective_supervisor_id = auth.uid()
    )
    OR
    -- Allow supervisors to read respective supervisor profiles
    id IN (
      SELECT DISTINCT respective_supervisor_id
      FROM public.ot_requests
      WHERE supervisor_id = auth.uid()
      AND respective_supervisor_id IS NOT NULL
    )
  );
