-- Finance: projects master table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'project_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE,
  project_name text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_name text,
  budget_amount numeric(14,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  status public.project_status NOT NULL DEFAULT 'active',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT project_budget_non_negative CHECK (budget_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON public.projects(is_active);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.petty_cash_transactions
  DROP CONSTRAINT IF EXISTS petty_cash_transactions_project_id_fkey;

ALTER TABLE public.petty_cash_transactions
  ADD CONSTRAINT petty_cash_transactions_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE SET NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_read_authenticated" ON public.projects;
CREATE POLICY "projects_read_authenticated"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "projects_write_finance_hr_admin" ON public.projects;
CREATE POLICY "projects_write_finance_hr_admin"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
