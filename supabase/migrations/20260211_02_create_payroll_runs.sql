-- Payroll Management: payroll_run_status enum + payroll_runs table

-- 1) Enum for payroll run status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payroll_run_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.payroll_run_status AS ENUM (
      'draft',
      'pending_hr_review',
      'hr_approved',
      'pending_director',
      'director_approved',
      'pending_finance',
      'finance_approved',
      'posted',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

-- 2) Payroll runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number text NOT NULL UNIQUE,

  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  pay_period_month int NOT NULL CHECK (pay_period_month >= 1 AND pay_period_month <= 12),
  pay_period_year int NOT NULL CHECK (pay_period_year >= 2020),

  status public.payroll_run_status NOT NULL DEFAULT 'draft',

  -- Denormalized totals
  total_gross_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_net_salary numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_epf numeric(14,2) NOT NULL DEFAULT 0,
  total_employee_epf numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_socso numeric(14,2) NOT NULL DEFAULT 0,
  total_employee_socso numeric(14,2) NOT NULL DEFAULT 0,
  total_employer_eis numeric(14,2) NOT NULL DEFAULT 0,
  total_employee_eis numeric(14,2) NOT NULL DEFAULT 0,
  total_hrdc numeric(14,2) NOT NULL DEFAULT 0,
  total_pcb numeric(14,2) NOT NULL DEFAULT 0,
  total_allowances numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_director_fee numeric(14,2) NOT NULL DEFAULT 0,
  employee_count int NOT NULL DEFAULT 0,

  -- HR approval
  hr_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hr_approved_at timestamptz,
  hr_remarks text,

  -- Director (management) approval
  director_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  director_approved_at timestamptz,
  director_remarks text,

  -- Finance approval
  finance_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finance_approved_at timestamptz,
  finance_remarks text,

  -- Rejection
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_remarks text,
  rejection_stage text,

  -- Finance posting
  is_posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posting_reference text,
  posting_remarks text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT payroll_runs_unique_period UNIQUE (company_id, pay_period_month, pay_period_year)
);

DROP TRIGGER IF EXISTS trg_payroll_runs_updated_at ON public.payroll_runs;
CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_id ON public.payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs(pay_period_year, pay_period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_is_posted ON public.payroll_runs(is_posted);

-- RLS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_runs_read" ON public.payroll_runs;
CREATE POLICY "payroll_runs_read" ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_runs_insert_hr_admin" ON public.payroll_runs;
CREATE POLICY "payroll_runs_insert_hr_admin" ON public.payroll_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payroll_runs_update" ON public.payroll_runs;
CREATE POLICY "payroll_runs_update" ON public.payroll_runs
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
