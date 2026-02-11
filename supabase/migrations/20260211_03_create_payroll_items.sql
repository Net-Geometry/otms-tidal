-- Payroll Management: payroll_items + payroll_item_allowances + payroll_item_deductions

-- 1) Per-employee payroll line items
CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Salary
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  working_days numeric(5,1) NOT NULL DEFAULT 26,
  days_worked numeric(5,1) NOT NULL DEFAULT 26,
  is_pro_rated boolean NOT NULL DEFAULT false,
  pro_rated_salary numeric(12,2) NOT NULL DEFAULT 0,

  -- Director
  is_director boolean NOT NULL DEFAULT false,
  director_fee numeric(12,2) NOT NULL DEFAULT 0,

  -- Pay
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  ot_amount numeric(12,2) NOT NULL DEFAULT 0,

  -- Employee statutory
  employee_epf numeric(12,2) NOT NULL DEFAULT 0,
  employee_socso numeric(12,2) NOT NULL DEFAULT 0,
  employee_eis numeric(12,2) NOT NULL DEFAULT 0,

  -- Employer statutory
  employer_epf numeric(12,2) NOT NULL DEFAULT 0,
  employer_socso numeric(12,2) NOT NULL DEFAULT 0,
  employer_eis numeric(12,2) NOT NULL DEFAULT 0,
  employer_hrdc numeric(12,2) NOT NULL DEFAULT 0,

  -- Tax
  pcb_amount numeric(12,2) NOT NULL DEFAULT 0,
  cp38_amount numeric(12,2) NOT NULL DEFAULT 0,
  zakat_amount numeric(12,2) NOT NULL DEFAULT 0,

  -- Other deductions
  sports_club numeric(12,2) NOT NULL DEFAULT 0,
  staff_loan numeric(12,2) NOT NULL DEFAULT 0,
  rental_deduction numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,

  -- Totals
  total_allowances numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  net_director_fee numeric(12,2) NOT NULL DEFAULT 0,

  -- Leave
  unpaid_leave_days numeric(5,1) NOT NULL DEFAULT 0,
  unpaid_leave_deduction numeric(12,2) NOT NULL DEFAULT 0,

  -- Claims
  claims_amount numeric(12,2) NOT NULL DEFAULT 0,

  -- Audit
  calculation_notes jsonb DEFAULT '{}',
  is_locked boolean NOT NULL DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT payroll_items_unique_employee UNIQUE (payroll_run_id, employee_id)
);

DROP TRIGGER IF EXISTS trg_payroll_items_updated_at ON public.payroll_items;
CREATE TRIGGER trg_payroll_items_updated_at
  BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_items_run_id ON public.payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON public.payroll_items(employee_id);

-- RLS
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_items_read_own" ON public.payroll_items;
CREATE POLICY "payroll_items_read_own" ON public.payroll_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "payroll_items_read_hr_finance_mgmt_admin" ON public.payroll_items;
CREATE POLICY "payroll_items_read_hr_finance_mgmt_admin" ON public.payroll_items
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_items_insert_hr_admin" ON public.payroll_items;
CREATE POLICY "payroll_items_insert_hr_admin" ON public.payroll_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_items_update_hr_admin" ON public.payroll_items;
CREATE POLICY "payroll_items_update_hr_admin" ON public.payroll_items
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_items_delete_hr_admin" ON public.payroll_items;
CREATE POLICY "payroll_items_delete_hr_admin" ON public.payroll_items
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) Junction: payroll item allowances
CREATE TABLE IF NOT EXISTS public.payroll_item_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  allowance_type_id uuid NOT NULL REFERENCES public.allowance_types(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT payroll_item_allowances_unique UNIQUE (payroll_item_id, allowance_type_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_item_allowances_item ON public.payroll_item_allowances(payroll_item_id);

ALTER TABLE public.payroll_item_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_item_allowances_read_own" ON public.payroll_item_allowances;
CREATE POLICY "payroll_item_allowances_read_own" ON public.payroll_item_allowances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_items pi
      WHERE pi.id = payroll_item_id AND pi.employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payroll_item_allowances_read_hr_finance_mgmt_admin" ON public.payroll_item_allowances;
CREATE POLICY "payroll_item_allowances_read_hr_finance_mgmt_admin" ON public.payroll_item_allowances
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_item_allowances_write_hr_admin" ON public.payroll_item_allowances;
CREATE POLICY "payroll_item_allowances_write_hr_admin" ON public.payroll_item_allowances
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

-- 3) Junction: payroll item deductions
CREATE TABLE IF NOT EXISTS public.payroll_item_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  deduction_type_id uuid NOT NULL REFERENCES public.deduction_types(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT payroll_item_deductions_unique UNIQUE (payroll_item_id, deduction_type_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_item_deductions_item ON public.payroll_item_deductions(payroll_item_id);

ALTER TABLE public.payroll_item_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_item_deductions_read_own" ON public.payroll_item_deductions;
CREATE POLICY "payroll_item_deductions_read_own" ON public.payroll_item_deductions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_items pi
      WHERE pi.id = payroll_item_id AND pi.employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payroll_item_deductions_read_hr_finance_mgmt_admin" ON public.payroll_item_deductions;
CREATE POLICY "payroll_item_deductions_read_hr_finance_mgmt_admin" ON public.payroll_item_deductions
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_item_deductions_write_hr_admin" ON public.payroll_item_deductions;
CREATE POLICY "payroll_item_deductions_write_hr_admin" ON public.payroll_item_deductions
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
