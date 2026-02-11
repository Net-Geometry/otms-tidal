-- Payroll Management: payroll_settings singleton + socso_contribution_table + allowance_types + deduction_types

-- 1) payroll_settings (singleton, id=1 pattern)
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id int PRIMARY KEY DEFAULT 1,

  -- EPF rates
  employer_epf_rate numeric(5,2) NOT NULL DEFAULT 15.00,
  employee_epf_rate_below_60 numeric(5,2) NOT NULL DEFAULT 11.00,
  employee_epf_rate_above_60 numeric(5,2) NOT NULL DEFAULT 5.50,

  -- SOCSO scheme
  socso_scheme text NOT NULL DEFAULT 'both' CHECK (socso_scheme IN ('employment_injury', 'both')),

  -- EIS rates
  eis_employer_rate numeric(5,3) NOT NULL DEFAULT 0.200,
  eis_employee_rate numeric(5,3) NOT NULL DEFAULT 0.200,
  eis_wage_ceiling numeric(12,2) NOT NULL DEFAULT 5000.00,

  -- HRDC
  hrdc_rate numeric(5,3) NOT NULL DEFAULT 1.000,
  hrdc_enabled boolean NOT NULL DEFAULT true,

  -- Pro-ration
  working_days_per_month int NOT NULL DEFAULT 26,

  -- Cycle
  payroll_cutoff_day int NOT NULL DEFAULT 25,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT payroll_settings_singleton CHECK (id = 1),
  CONSTRAINT payroll_settings_cutoff_range CHECK (payroll_cutoff_day >= 1 AND payroll_cutoff_day <= 31)
);

DROP TRIGGER IF EXISTS trg_payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER trg_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_settings_read_all" ON public.payroll_settings;
CREATE POLICY "payroll_settings_read_all"
  ON public.payroll_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payroll_settings_write_hr_admin" ON public.payroll_settings;
CREATE POLICY "payroll_settings_write_hr_admin"
  ON public.payroll_settings
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

-- 2) SOCSO contribution table (PERKESO official lookup)
CREATE TABLE IF NOT EXISTS public.socso_contribution_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wage_from numeric(12,2) NOT NULL,
  wage_to numeric(12,2) NOT NULL,
  employer_first_category numeric(8,2) NOT NULL DEFAULT 0,
  employee_first_category numeric(8,2) NOT NULL DEFAULT 0,
  employer_second_category numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT socso_wage_range CHECK (wage_to >= wage_from)
);

ALTER TABLE public.socso_contribution_table ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socso_table_read_all" ON public.socso_contribution_table;
CREATE POLICY "socso_table_read_all"
  ON public.socso_contribution_table
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "socso_table_write_hr_admin" ON public.socso_contribution_table;
CREATE POLICY "socso_table_write_hr_admin"
  ON public.socso_contribution_table
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

-- 3) Allowance types
CREATE TABLE IF NOT EXISTS public.allowance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_epf_subject boolean NOT NULL DEFAULT true,
  is_socso_subject boolean NOT NULL DEFAULT true,
  is_eis_subject boolean NOT NULL DEFAULT true,
  is_taxable boolean NOT NULL DEFAULT true,
  default_amount numeric(12,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_allowance_types_updated_at ON public.allowance_types;
CREATE TRIGGER trg_allowance_types_updated_at
  BEFORE UPDATE ON public.allowance_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allowance_types_read_all" ON public.allowance_types;
CREATE POLICY "allowance_types_read_all"
  ON public.allowance_types
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "allowance_types_write_hr_admin" ON public.allowance_types;
CREATE POLICY "allowance_types_write_hr_admin"
  ON public.allowance_types
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

-- 4) Deduction types
CREATE TABLE IF NOT EXISTS public.deduction_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('statutory', 'loan', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_deduction_types_updated_at ON public.deduction_types;
CREATE TRIGGER trg_deduction_types_updated_at
  BEFORE UPDATE ON public.deduction_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deduction_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deduction_types_read_all" ON public.deduction_types;
CREATE POLICY "deduction_types_read_all"
  ON public.deduction_types
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "deduction_types_write_hr_admin" ON public.deduction_types;
CREATE POLICY "deduction_types_write_hr_admin"
  ON public.deduction_types
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
