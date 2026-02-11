-- Finance: project cost allocation ledger

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cost_source_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cost_source_type AS ENUM ('payroll', 'claims', 'petty_cash', 'manual');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cost_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.cost_category AS ENUM ('labor', 'materials', 'subcontractor', 'equipment', 'overhead', 'travel', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type public.cost_source_type NOT NULL,
  source_id uuid,
  cost_category public.cost_category NOT NULL,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  cost_date date NOT NULL,
  cost_month int NOT NULL CHECK (cost_month >= 1 AND cost_month <= 12),
  cost_year int NOT NULL CHECK (cost_year >= 2020),
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT project_cost_allocations_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_project_cost_allocations_project_id ON public.project_cost_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_cost_allocations_cost_date ON public.project_cost_allocations(cost_date);
CREATE INDEX IF NOT EXISTS idx_project_cost_allocations_cost_period ON public.project_cost_allocations(cost_year, cost_month);
CREATE INDEX IF NOT EXISTS idx_project_cost_allocations_source ON public.project_cost_allocations(source_type, source_id);

DROP TRIGGER IF EXISTS trg_project_cost_allocations_updated_at ON public.project_cost_allocations;
CREATE TRIGGER trg_project_cost_allocations_updated_at
  BEFORE UPDATE ON public.project_cost_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_cost_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_cost_allocations_read_roles" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_read_roles"
  ON public.project_cost_allocations
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "project_cost_allocations_write_finance_admin" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_write_finance_admin"
  ON public.project_cost_allocations
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
