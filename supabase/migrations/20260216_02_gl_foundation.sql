-- Finance: General Ledger foundation (document sequences + journal entries)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'gl_reference_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.gl_reference_type AS ENUM (
      'manual',
      'ap_invoice',
      'ar_invoice',
      'payment_voucher',
      'official_receipt',
      'petty_cash',
      'claims',
      'payroll'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.document_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  year int NOT NULL CHECK (year >= 2000),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  last_number int NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_sequences_company_prefix_period_unique
    UNIQUE (company_id, prefix, year, month)
);

CREATE INDEX IF NOT EXISTS idx_document_sequences_company_prefix_period
  ON public.document_sequences(company_id, prefix, year, month);

DROP TRIGGER IF EXISTS trg_document_sequences_updated_at ON public.document_sequences;
CREATE TRIGGER trg_document_sequences_updated_at
  BEFORE UPDATE ON public.document_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  description text,
  reference_type public.gl_reference_type NOT NULL DEFAULT 'manual',
  reference_id uuid,
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  reversed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  is_reversed boolean NOT NULL DEFAULT false,
  fiscal_year int NOT NULL CHECK (fiscal_year >= 2000),
  fiscal_month int NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_company_entry_unique UNIQUE (company_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
  ON public.journal_entries(company_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
  ON public.journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_period
  ON public.journal_entries(company_id, fiscal_year, fiscal_month);

DROP TRIGGER IF EXISTS trg_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  description text,
  debit_amount numeric(15,2) NOT NULL DEFAULT 0,
  credit_amount numeric(15,2) NOT NULL DEFAULT 0,
  cost_center text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entry_lines_non_negative_amounts
    CHECK (debit_amount >= 0 AND credit_amount >= 0),
  CONSTRAINT journal_entry_lines_exactly_one_side
    CHECK (
      (debit_amount > 0 AND credit_amount = 0)
      OR (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id
  ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id
  ON public.journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_project_id
  ON public.journal_entry_lines(project_id);

CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id uuid;
  v_total_debit numeric(15,2);
  v_total_credit numeric(15,2);
BEGIN
  v_journal_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = v_journal_entry_id;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION
      'Journal entry % is not balanced (debit %, credit %)',
      v_journal_entry_id,
      v_total_debit,
      v_total_credit;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_journal_entry_balance ON public.journal_entry_lines;
CREATE CONSTRAINT TRIGGER trg_validate_journal_entry_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_entry_balance();

CREATE OR REPLACE FUNCTION public.finance_next_document_number(
  p_company_id uuid,
  p_prefix text,
  p_doc_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_year int;
  v_month int;
  v_next_number int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  v_prefix := UPPER(TRIM(COALESCE(p_prefix, 'JV')));
  IF v_prefix = '' THEN
    RAISE EXCEPTION 'prefix is required';
  END IF;

  v_year := EXTRACT(YEAR FROM COALESCE(p_doc_date, CURRENT_DATE));
  v_month := EXTRACT(MONTH FROM COALESCE(p_doc_date, CURRENT_DATE));

  INSERT INTO public.document_sequences (company_id, prefix, year, month, last_number)
  VALUES (p_company_id, v_prefix, v_year, v_month, 0)
  ON CONFLICT (company_id, prefix, year, month) DO NOTHING;

  UPDATE public.document_sequences
  SET last_number = last_number + 1
  WHERE company_id = p_company_id
    AND prefix = v_prefix
    AND year = v_year
    AND month = v_month
  RETURNING last_number INTO v_next_number;

  RETURN format('%s-%s%s-%s', v_prefix, v_year, LPAD(v_month::text, 2, '0'), LPAD(v_next_number::text, 4, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_journal_entry(
  p_company_id uuid,
  p_entry_date date,
  p_description text,
  p_reference_type public.gl_reference_type,
  p_reference_id uuid,
  p_lines jsonb,
  p_prefix text DEFAULT NULL
)
RETURNS TABLE(journal_entry_id uuid, entry_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_entry_date date;
  v_entry_number text;
  v_journal_entry_id uuid;
  v_line jsonb;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_debit_amount numeric(15,2);
  v_credit_amount numeric(15,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one journal line is required';
  END IF;

  v_entry_date := COALESCE(p_entry_date, CURRENT_DATE);

  v_prefix := UPPER(TRIM(COALESCE(
    p_prefix,
    CASE p_reference_type
      WHEN 'manual' THEN 'JV'
      WHEN 'ap_invoice' THEN 'INV'
      WHEN 'ar_invoice' THEN 'INV'
      WHEN 'payment_voucher' THEN 'PV'
      WHEN 'official_receipt' THEN 'OR'
      WHEN 'petty_cash' THEN 'PCV'
      WHEN 'claims' THEN 'CLM'
      WHEN 'payroll' THEN 'PAY'
    END
  )));

  IF v_prefix = '' THEN
    RAISE EXCEPTION 'Document prefix cannot be empty';
  END IF;

  v_entry_number := public.finance_next_document_number(p_company_id, v_prefix, v_entry_date);

  INSERT INTO public.journal_entries (
    company_id,
    entry_number,
    entry_date,
    description,
    reference_type,
    reference_id,
    posted_by,
    posted_at,
    fiscal_year,
    fiscal_month
  ) VALUES (
    p_company_id,
    v_entry_number,
    v_entry_date,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    p_reference_type,
    p_reference_id,
    auth.uid(),
    now(),
    EXTRACT(YEAR FROM v_entry_date),
    EXTRACT(MONTH FROM v_entry_date)
  )
  RETURNING id INTO v_journal_entry_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit_amount := COALESCE(NULLIF(v_line->>'debit_amount', '')::numeric, 0);
    v_credit_amount := COALESCE(NULLIF(v_line->>'credit_amount', '')::numeric, 0);

    v_total_debit := v_total_debit + v_debit_amount;
    v_total_credit := v_total_credit + v_credit_amount;

    INSERT INTO public.journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount,
      cost_center,
      project_id
    ) VALUES (
      v_journal_entry_id,
      (v_line->>'account_id')::uuid,
      NULLIF(TRIM(COALESCE(v_line->>'description', '')), ''),
      v_debit_amount,
      v_credit_amount,
      NULLIF(TRIM(COALESCE(v_line->>'cost_center', '')), ''),
      CASE
        WHEN NULLIF(v_line->>'project_id', '') IS NULL THEN NULL
        ELSE (v_line->>'project_id')::uuid
      END
    );
  END LOOP;

  IF v_total_debit <= 0 OR v_total_credit <= 0 THEN
    RAISE EXCEPTION 'Journal entry requires both debit and credit totals greater than zero';
  END IF;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Journal entry is not balanced (debit %, credit %)', v_total_debit, v_total_credit;
  END IF;

  RETURN QUERY SELECT v_journal_entry_id, v_entry_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_reverse_journal_entry(
  p_journal_entry_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(journal_entry_id uuid, entry_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.journal_entries%ROWTYPE;
  v_new_entry_id uuid;
  v_new_entry_number text;
  v_description text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  SELECT *
  INTO v_source
  FROM public.journal_entries
  WHERE id = p_journal_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF v_source.is_reversed THEN
    RAISE EXCEPTION 'Journal entry is already reversed';
  END IF;

  v_new_entry_number := public.finance_next_document_number(v_source.company_id, 'JV', CURRENT_DATE);

  v_description := format('Reversal of %s', v_source.entry_number);
  IF p_reason IS NOT NULL AND TRIM(p_reason) <> '' THEN
    v_description := format('%s: %s', v_description, TRIM(p_reason));
  END IF;

  INSERT INTO public.journal_entries (
    company_id,
    entry_number,
    entry_date,
    description,
    reference_type,
    reference_id,
    posted_by,
    posted_at,
    fiscal_year,
    fiscal_month
  ) VALUES (
    v_source.company_id,
    v_new_entry_number,
    CURRENT_DATE,
    v_description,
    'manual',
    v_source.id,
    auth.uid(),
    now(),
    EXTRACT(YEAR FROM CURRENT_DATE),
    EXTRACT(MONTH FROM CURRENT_DATE)
  ) RETURNING id INTO v_new_entry_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount,
    cost_center,
    project_id
  )
  SELECT
    v_new_entry_id,
    l.account_id,
    COALESCE(l.description, 'Reversal line'),
    l.credit_amount,
    l.debit_amount,
    l.cost_center,
    l.project_id
  FROM public.journal_entry_lines l
  WHERE l.journal_entry_id = v_source.id;

  UPDATE public.journal_entries
  SET
    is_reversed = true,
    reversed_by = auth.uid(),
    reversed_at = now()
  WHERE id = v_source.id;

  RETURN QUERY SELECT v_new_entry_id, v_new_entry_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_next_document_number(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_create_journal_entry(uuid, date, text, public.gl_reference_type, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_journal_entry(uuid, text) TO authenticated;

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_sequences_read_authenticated" ON public.document_sequences;
CREATE POLICY "document_sequences_read_authenticated"
  ON public.document_sequences
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "document_sequences_write_finance_admin" ON public.document_sequences;
CREATE POLICY "document_sequences_write_finance_admin"
  ON public.document_sequences
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

DROP POLICY IF EXISTS "journal_entries_read_authenticated" ON public.journal_entries;
CREATE POLICY "journal_entries_read_authenticated"
  ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "journal_entries_write_finance_admin" ON public.journal_entries;
CREATE POLICY "journal_entries_write_finance_admin"
  ON public.journal_entries
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

DROP POLICY IF EXISTS "journal_entry_lines_read_authenticated" ON public.journal_entry_lines;
CREATE POLICY "journal_entry_lines_read_authenticated"
  ON public.journal_entry_lines
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "journal_entry_lines_write_finance_admin" ON public.journal_entry_lines;
CREATE POLICY "journal_entry_lines_write_finance_admin"
  ON public.journal_entry_lines
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
