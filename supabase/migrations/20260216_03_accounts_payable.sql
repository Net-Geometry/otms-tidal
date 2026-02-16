-- Finance: Accounts Payable sub-module (PRF, AP Invoice, Payment Voucher)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_prf_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_prf_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_invoice_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_invoice_status AS ENUM (
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
    WHERE t.typname = 'ap_pv_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_pv_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'posted', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_payment_method' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_payment_method AS ENUM ('cheque', 'online_transfer', 'cash');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_unit_of_measure' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_unit_of_measure AS ENUM (
      'unit',
      'piece',
      'set',
      'box',
      'pack',
      'carton',
      'kg',
      'litre',
      'meter',
      'hour',
      'day',
      'month',
      'service'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ap_tax_code' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ap_tax_code AS ENUM ('sr', 'zr', 'es', 'os');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  prf_number text,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  required_by_date date,
  purpose text,
  justification text,
  suggested_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quotation_ref text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  status public.ap_prf_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_requisitions_company_prf_number_unique UNIQUE (company_id, prf_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prf_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  description text NOT NULL,
  gl_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  quantity numeric(15,4) NOT NULL DEFAULT 1,
  unit public.ap_unit_of_measure NOT NULL DEFAULT 'unit',
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  amount numeric(15,2) GENERATED ALWAYS AS ((quantity * unit_price)::numeric(15,2)) STORED,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ap_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number text,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_invoice_no text,
  prf_id uuid REFERENCES public.purchase_requisitions(id) ON DELETE SET NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  exchange_rate numeric(12,6) NOT NULL DEFAULT 1,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_total numeric(15,2) NOT NULL DEFAULT 0,
  withholding_tax numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  status public.ap_invoice_status NOT NULL DEFAULT 'draft',
  remarks text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ap_invoices_company_invoice_number_unique UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.ap_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_invoice_id uuid NOT NULL REFERENCES public.ap_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  gl_account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  quantity numeric(15,4) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_code public.ap_tax_code NOT NULL DEFAULT 'os',
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  pv_number text,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  payment_date date NOT NULL,
  payment_method public.ap_payment_method NOT NULL DEFAULT 'online_transfer',
  reference_no text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  status public.ap_pv_status NOT NULL DEFAULT 'draft',
  remarks text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_vouchers_company_pv_number_unique UNIQUE (company_id, pv_number)
);

CREATE TABLE IF NOT EXISTS public.payment_voucher_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id uuid NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  ap_invoice_id uuid NOT NULL REFERENCES public.ap_invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_voucher_allocations_amount_positive CHECK (allocated_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_company_status
  ON public.purchase_requisitions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_requester
  ON public.purchase_requisitions(requester_id);

CREATE INDEX IF NOT EXISTS idx_ap_invoices_company_status
  ON public.ap_invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_supplier
  ON public.ap_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_due_date
  ON public.ap_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company_status
  ON public.payment_vouchers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_supplier
  ON public.payment_vouchers(supplier_id);

CREATE INDEX IF NOT EXISTS idx_payment_voucher_allocations_pv
  ON public.payment_voucher_allocations(pv_id);
CREATE INDEX IF NOT EXISTS idx_payment_voucher_allocations_invoice
  ON public.payment_voucher_allocations(ap_invoice_id);

DROP TRIGGER IF EXISTS trg_purchase_requisitions_updated_at ON public.purchase_requisitions;
CREATE TRIGGER trg_purchase_requisitions_updated_at
  BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ap_invoices_updated_at ON public.ap_invoices;
CREATE TRIGGER trg_ap_invoices_updated_at
  BEFORE UPDATE ON public.ap_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_vouchers_updated_at ON public.payment_vouchers;
CREATE TRIGGER trg_payment_vouchers_updated_at
  BEFORE UPDATE ON public.payment_vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_voucher_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_requisitions_read_authenticated" ON public.purchase_requisitions;
CREATE POLICY "purchase_requisitions_read_authenticated"
  ON public.purchase_requisitions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "purchase_requisitions_write_finance_admin" ON public.purchase_requisitions;
CREATE POLICY "purchase_requisitions_write_finance_admin"
  ON public.purchase_requisitions
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

DROP POLICY IF EXISTS "purchase_requisition_items_read_authenticated" ON public.purchase_requisition_items;
CREATE POLICY "purchase_requisition_items_read_authenticated"
  ON public.purchase_requisition_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "purchase_requisition_items_write_finance_admin" ON public.purchase_requisition_items;
CREATE POLICY "purchase_requisition_items_write_finance_admin"
  ON public.purchase_requisition_items
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

DROP POLICY IF EXISTS "ap_invoices_read_authenticated" ON public.ap_invoices;
CREATE POLICY "ap_invoices_read_authenticated"
  ON public.ap_invoices
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ap_invoices_write_finance_admin" ON public.ap_invoices;
CREATE POLICY "ap_invoices_write_finance_admin"
  ON public.ap_invoices
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

DROP POLICY IF EXISTS "ap_invoice_lines_read_authenticated" ON public.ap_invoice_lines;
CREATE POLICY "ap_invoice_lines_read_authenticated"
  ON public.ap_invoice_lines
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ap_invoice_lines_write_finance_admin" ON public.ap_invoice_lines;
CREATE POLICY "ap_invoice_lines_write_finance_admin"
  ON public.ap_invoice_lines
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

DROP POLICY IF EXISTS "payment_vouchers_read_authenticated" ON public.payment_vouchers;
CREATE POLICY "payment_vouchers_read_authenticated"
  ON public.payment_vouchers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payment_vouchers_write_finance_admin" ON public.payment_vouchers;
CREATE POLICY "payment_vouchers_write_finance_admin"
  ON public.payment_vouchers
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

DROP POLICY IF EXISTS "payment_voucher_allocations_read_authenticated" ON public.payment_voucher_allocations;
CREATE POLICY "payment_voucher_allocations_read_authenticated"
  ON public.payment_voucher_allocations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payment_voucher_allocations_write_finance_admin" ON public.payment_voucher_allocations;
CREATE POLICY "payment_voucher_allocations_write_finance_admin"
  ON public.payment_voucher_allocations
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
