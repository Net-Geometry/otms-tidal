-- Fix: add management role to employee_leave read/write policies

-- Read policy: add management
DROP POLICY IF EXISTS "employee_leave_read_hr_admin" ON public.employee_leave;
CREATE POLICY "employee_leave_read_hr_admin"
  ON public.employee_leave
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

-- Write policy: add management
DROP POLICY IF EXISTS "employee_leave_write_hr_admin" ON public.employee_leave;
CREATE POLICY "employee_leave_write_hr_admin"
  ON public.employee_leave
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );
