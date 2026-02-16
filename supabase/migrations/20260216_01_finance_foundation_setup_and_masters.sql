-- Finance foundation: setup + masters + workflow inbox data model

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_doa_document_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.finance_doa_document_type AS ENUM (
      'prf',
      'pv',
      'ap_invoice',
      'ar_invoice',
      'journal',
      'pcv'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_bank_account_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.finance_bank_account_type AS ENUM ('current', 'savings', 'fixed_deposit');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_statement_frequency' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.finance_statement_frequency AS ENUM ('monthly', 'quarterly', 'on_demand');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_approval_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.finance_approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'finance_approval_action' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.finance_approval_action AS ENUM ('submitted', 'approved', 'rejected', 'recalled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'MYR',
  fiscal_year_start_month int NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  payment_terms_days int NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  tax_id text,
  sst_registration_no text,
  lock_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.finance_company_profiles (company_id)
SELECT c.id
FROM public.companies c
WHERE c.is_active = true
ON CONFLICT (company_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.doa_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type public.finance_doa_document_type NOT NULL,
  approval_level int NOT NULL CHECK (approval_level BETWEEN 1 AND 4),
  min_amount numeric(14,2) NOT NULL DEFAULT 0,
  max_amount numeric(14,2),
  approver_role public.app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT doa_rule_amount_window CHECK (max_amount IS NULL OR max_amount >= min_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doa_rules_unique_window
  ON public.doa_rules (company_id, document_type, approval_level, min_amount);
CREATE INDEX IF NOT EXISTS idx_doa_rules_document_type ON public.doa_rules (document_type);
CREATE INDEX IF NOT EXISTS idx_doa_rules_approver_role ON public.doa_rules (approver_role);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  supplier_code text NOT NULL UNIQUE,
  supplier_name text NOT NULL,
  category text,
  tax_id text,
  gst_no text,
  contact_name text,
  email text,
  phone text,
  address text,
  bank_name text,
  bank_account_no text,
  bank_account_holder text,
  payment_terms_days int NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  currency text NOT NULL DEFAULT 'MYR',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  customer_code text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  tax_id text,
  sst_no text,
  contact_name text,
  email text,
  phone text,
  billing_address text,
  shipping_address text,
  payment_terms_days int NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  currency text NOT NULL DEFAULT 'MYR',
  statement_frequency public.finance_statement_frequency NOT NULL DEFAULT 'monthly',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON public.customers(is_active);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_code text NOT NULL UNIQUE,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type public.finance_bank_account_type NOT NULL DEFAULT 'current',
  currency text NOT NULL DEFAULT 'MYR',
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  gl_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_reconciling boolean NOT NULL DEFAULT true,
  last_reconciled_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT bank_accounts_company_number_unique UNIQUE (company_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl_account_id ON public.bank_accounts(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON public.bank_accounts(is_active);

CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  document_type public.finance_doa_document_type NOT NULL,
  document_id uuid NOT NULL,
  document_number text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_level int NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 4),
  status public.finance_approval_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON public.approval_workflows(status);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_company_id ON public.approval_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_submitted_at ON public.approval_workflows(submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  approval_level int NOT NULL CHECK (approval_level BETWEEN 1 AND 4),
  action public.finance_approval_action NOT NULL,
  acted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  comments text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_approval_history_workflow_id ON public.approval_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_acted_at ON public.approval_history(acted_at DESC);

DROP TRIGGER IF EXISTS trg_finance_company_profiles_updated_at ON public.finance_company_profiles;
CREATE TRIGGER trg_finance_company_profiles_updated_at
  BEFORE UPDATE ON public.finance_company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_doa_rules_updated_at ON public.doa_rules;
CREATE TRIGGER trg_doa_rules_updated_at
  BEFORE UPDATE ON public.doa_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_approval_workflows_updated_at ON public.approval_workflows;
CREATE TRIGGER trg_approval_workflows_updated_at
  BEFORE UPDATE ON public.approval_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doa_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_company_profiles_read_authenticated" ON public.finance_company_profiles;
CREATE POLICY "finance_company_profiles_read_authenticated"
  ON public.finance_company_profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "finance_company_profiles_write_finance_admin" ON public.finance_company_profiles;
CREATE POLICY "finance_company_profiles_write_finance_admin"
  ON public.finance_company_profiles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "doa_rules_read_authenticated" ON public.doa_rules;
CREATE POLICY "doa_rules_read_authenticated"
  ON public.doa_rules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "doa_rules_write_finance_admin" ON public.doa_rules;
CREATE POLICY "doa_rules_write_finance_admin"
  ON public.doa_rules
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "suppliers_read_authenticated" ON public.suppliers;
CREATE POLICY "suppliers_read_authenticated"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "suppliers_write_finance_admin" ON public.suppliers;
CREATE POLICY "suppliers_write_finance_admin"
  ON public.suppliers
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "customers_read_authenticated" ON public.customers;
CREATE POLICY "customers_read_authenticated"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "customers_write_finance_admin" ON public.customers;
CREATE POLICY "customers_write_finance_admin"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "bank_accounts_read_authenticated" ON public.bank_accounts;
CREATE POLICY "bank_accounts_read_authenticated"
  ON public.bank_accounts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "bank_accounts_write_finance_admin" ON public.bank_accounts;
CREATE POLICY "bank_accounts_write_finance_admin"
  ON public.bank_accounts
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "approval_workflows_read_finance_admin" ON public.approval_workflows;
CREATE POLICY "approval_workflows_read_finance_admin"
  ON public.approval_workflows
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "approval_workflows_write_finance_admin" ON public.approval_workflows;
CREATE POLICY "approval_workflows_write_finance_admin"
  ON public.approval_workflows
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "approval_history_read_finance_admin" ON public.approval_history;
CREATE POLICY "approval_history_read_finance_admin"
  ON public.approval_history
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "approval_history_write_finance_admin" ON public.approval_history;
CREATE POLICY "approval_history_write_finance_admin"
  ON public.approval_history
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
