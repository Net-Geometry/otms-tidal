-- Finance: Accounts Receivable sub-module (AR Invoice, Official Receipt)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ar_invoice_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ar_invoice_status AS ENUM (
      'draft',
      'pending',
      'approved',
      'rejected',
      'posted',
      'partially_paid',
      'paid',
      'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ar_receipt_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ar_receipt_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'posted', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ar_payment_method' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ar_payment_method AS ENUM ('cheque', 'online_transfer', 'cash', 'credit_card');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ar_tax_code' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ar_tax_code AS ENUM ('sr', 'zr', 'es', 'os');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ar_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number text,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sales_order_ref text,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  exchange_rate numeric(12,6) NOT NULL DEFAULT 1,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_total numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  status public.ar_invoice_status NOT NULL DEFAULT 'draft',
  remarks text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_invoices_company_invoice_number_unique UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.ar_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_invoice_id uuid NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  gl_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  quantity numeric(15,4) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_code public.ar_tax_code NOT NULL DEFAULT 'os',
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  receipt_number text,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  receipt_date date NOT NULL,
  payment_method public.ar_payment_method NOT NULL DEFAULT 'online_transfer',
  reference_no text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  status public.ar_receipt_status NOT NULL DEFAULT 'draft',
  remarks text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_receipts_company_receipt_number_unique UNIQUE (company_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.official_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  or_id uuid NOT NULL REFERENCES public.official_receipts(id) ON DELETE CASCADE,
  ar_invoice_id uuid NOT NULL REFERENCES public.ar_invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_receipt_allocations_amount_positive CHECK (allocated_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_company_status
  ON public.ar_invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_customer
  ON public.ar_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_invoices_due_date
  ON public.ar_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_official_receipts_company_status
  ON public.official_receipts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_official_receipts_customer
  ON public.official_receipts(customer_id);

CREATE INDEX IF NOT EXISTS idx_official_receipt_allocations_or
  ON public.official_receipt_allocations(or_id);
CREATE INDEX IF NOT EXISTS idx_official_receipt_allocations_invoice
  ON public.official_receipt_allocations(ar_invoice_id);

DROP TRIGGER IF EXISTS trg_ar_invoices_updated_at ON public.ar_invoices;
CREATE TRIGGER trg_ar_invoices_updated_at
  BEFORE UPDATE ON public.ar_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_official_receipts_updated_at ON public.official_receipts;
CREATE TRIGGER trg_official_receipts_updated_at
  BEFORE UPDATE ON public.official_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_receipt_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ar_invoices_read_authenticated" ON public.ar_invoices;
CREATE POLICY "ar_invoices_read_authenticated"
  ON public.ar_invoices
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ar_invoices_write_finance_admin" ON public.ar_invoices;
CREATE POLICY "ar_invoices_write_finance_admin"
  ON public.ar_invoices
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

DROP POLICY IF EXISTS "ar_invoice_lines_read_authenticated" ON public.ar_invoice_lines;
CREATE POLICY "ar_invoice_lines_read_authenticated"
  ON public.ar_invoice_lines
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ar_invoice_lines_write_finance_admin" ON public.ar_invoice_lines;
CREATE POLICY "ar_invoice_lines_write_finance_admin"
  ON public.ar_invoice_lines
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

DROP POLICY IF EXISTS "official_receipts_read_authenticated" ON public.official_receipts;
CREATE POLICY "official_receipts_read_authenticated"
  ON public.official_receipts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "official_receipts_write_finance_admin" ON public.official_receipts;
CREATE POLICY "official_receipts_write_finance_admin"
  ON public.official_receipts
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

DROP POLICY IF EXISTS "official_receipt_allocations_read_authenticated" ON public.official_receipt_allocations;
CREATE POLICY "official_receipt_allocations_read_authenticated"
  ON public.official_receipt_allocations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "official_receipt_allocations_write_finance_admin" ON public.official_receipt_allocations;
CREATE POLICY "official_receipt_allocations_write_finance_admin"
  ON public.official_receipt_allocations
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
