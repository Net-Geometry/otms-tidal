-- Restrict supervisor OT requests read policy
-- Previously, supervisors could see ALL OT requests due to overly permissive RLS
-- Now supervisors can only see:
-- 1. Requests for their direct employees (supervisor_id = auth.uid())
-- 2. Requests where they are assigned as respective supervisor (respective_supervisor_id = auth.uid())

DROP POLICY IF EXISTS "otr_sup_read" ON public.ot_requests;

CREATE POLICY "otr_sup_read" ON public.ot_requests
  FOR SELECT TO authenticated
  USING (
    supervisor_id = auth.uid()
    OR respective_supervisor_id = auth.uid()
  );
