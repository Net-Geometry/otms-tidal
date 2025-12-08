-- Restrict HR and Management OT requests read policy
-- Previously, the otr_respective_sup_read policy allowed HR/management to see all requests
-- Now separate policies for HR and management with appropriate access levels

DROP POLICY IF EXISTS "otr_respective_sup_read" ON public.ot_requests;
DROP POLICY IF EXISTS "otr_hr_read" ON public.ot_requests;

-- HR can see requests in their approval workflow (supervisor_verified, supervisor_confirmed, respective_supervisor_confirmed)
CREATE POLICY "otr_hr_read" ON public.ot_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Respective supervisor can see requests where they are assigned
CREATE POLICY "otr_respective_sup_read" ON public.ot_requests
  FOR SELECT TO authenticated
  USING (
    respective_supervisor_id = auth.uid()
  );
