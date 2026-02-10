-- Leave Management: leave_balances table

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  year int NOT NULL,
  entitled_days numeric(5,1) NOT NULL DEFAULT 0,
  used_days numeric(5,1) NOT NULL DEFAULT 0,
  carried_forward numeric(5,1) NOT NULL DEFAULT 0,
  adjustment numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

DROP TRIGGER IF EXISTS trg_leave_balances_updated_at ON public.leave_balances;
CREATE TRIGGER trg_leave_balances_updated_at
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_balances_read_own" ON public.leave_balances;
CREATE POLICY "leave_balances_read_own"
  ON public.leave_balances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "leave_balances_read_hr_admin" ON public.leave_balances;
CREATE POLICY "leave_balances_read_hr_admin"
  ON public.leave_balances
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

DROP POLICY IF EXISTS "leave_balances_write_hr_admin" ON public.leave_balances;
CREATE POLICY "leave_balances_write_hr_admin"
  ON public.leave_balances
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
