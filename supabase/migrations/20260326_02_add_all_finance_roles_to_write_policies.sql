-- Add all finance roles to write policies across the finance module.
-- Previously only 'finance' and 'admin' could write. Now includes:
-- finance, admin, finance_admin, account_exec, account_assistant, head_finance
--
-- Creates is_finance_user() helper to centralize the check.

CREATE OR REPLACE FUNCTION public.is_finance_user(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role IN ('finance', 'admin', 'finance_admin', 'account_exec', 'account_assistant', 'head_finance')
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER functions: update role checks to use is_finance_user()
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.finance_next_document_number(uuid, text, date);
CREATE FUNCTION public.finance_next_document_number(
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
  IF NOT is_finance_user(auth.uid()) THEN
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

GRANT EXECUTE ON FUNCTION public.finance_next_document_number(uuid, text, date) TO authenticated;

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
  IF NOT is_finance_user(auth.uid()) THEN
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
      WHEN 'payment_voucher' THEN 'CB'
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
    company_id, entry_number, entry_date, description,
    reference_type, reference_id, posted_by, posted_at,
    fiscal_year, fiscal_month
  ) VALUES (
    p_company_id, v_entry_number, v_entry_date,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    p_reference_type, p_reference_id, auth.uid(), now(),
    EXTRACT(YEAR FROM v_entry_date), EXTRACT(MONTH FROM v_entry_date)
  )
  RETURNING id INTO v_journal_entry_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit_amount := COALESCE(NULLIF(v_line->>'debit_amount', '')::numeric, 0);
    v_credit_amount := COALESCE(NULLIF(v_line->>'credit_amount', '')::numeric, 0);
    v_total_debit := v_total_debit + v_debit_amount;
    v_total_credit := v_total_credit + v_credit_amount;

    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_id, description,
      debit_amount, credit_amount, cost_center, project_id
    ) VALUES (
      v_journal_entry_id,
      (v_line->>'account_id')::uuid,
      NULLIF(TRIM(COALESCE(v_line->>'description', '')), ''),
      v_debit_amount, v_credit_amount,
      NULLIF(TRIM(COALESCE(v_line->>'cost_center', '')), ''),
      CASE WHEN NULLIF(v_line->>'project_id', '') IS NULL THEN NULL
           ELSE (v_line->>'project_id')::uuid END
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

GRANT EXECUTE ON FUNCTION public.finance_create_journal_entry(uuid, date, text, public.gl_reference_type, uuid, jsonb, text) TO authenticated;

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
  IF NOT is_finance_user(auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  SELECT * INTO v_source FROM public.journal_entries WHERE id = p_journal_entry_id;
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
    company_id, entry_number, entry_date, description,
    reference_type, reference_id, posted_by, posted_at,
    fiscal_year, fiscal_month
  ) VALUES (
    v_source.company_id, v_new_entry_number, CURRENT_DATE,
    v_description, 'manual', v_source.id, auth.uid(), now(),
    EXTRACT(YEAR FROM CURRENT_DATE), EXTRACT(MONTH FROM CURRENT_DATE)
  ) RETURNING id INTO v_new_entry_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_id, description,
    debit_amount, credit_amount, cost_center, project_id
  )
  SELECT v_new_entry_id, l.account_id,
    COALESCE(l.description, 'Reversal line'),
    l.credit_amount, l.debit_amount,
    l.cost_center, l.project_id
  FROM public.journal_entry_lines l
  WHERE l.journal_entry_id = v_source.id;

  UPDATE public.journal_entries
  SET is_reversed = true, reversed_by = auth.uid(), reversed_at = now()
  WHERE id = v_source.id;

  RETURN QUERY SELECT v_new_entry_id, v_new_entry_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_reverse_journal_entry(uuid, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- RLS POLICIES: update all finance write policies to use is_finance_user()
-- ═══════════════════════════════════════════════════════════════════════

-- GL: document_sequences
DROP POLICY IF EXISTS "document_sequences_write_finance_admin" ON public.document_sequences;
CREATE POLICY "document_sequences_write_finance_admin" ON public.document_sequences
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- GL: journal_entries
DROP POLICY IF EXISTS "journal_entries_write_finance_admin" ON public.journal_entries;
CREATE POLICY "journal_entries_write_finance_admin" ON public.journal_entries
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- GL: journal_entry_lines
DROP POLICY IF EXISTS "journal_entry_lines_write_finance_admin" ON public.journal_entry_lines;
CREATE POLICY "journal_entry_lines_write_finance_admin" ON public.journal_entry_lines
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: finance_company_profiles
DROP POLICY IF EXISTS "finance_company_profiles_write_finance_admin" ON public.finance_company_profiles;
CREATE POLICY "finance_company_profiles_write_finance_admin" ON public.finance_company_profiles
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: doa_rules
DROP POLICY IF EXISTS "doa_rules_write_finance_admin" ON public.doa_rules;
CREATE POLICY "doa_rules_write_finance_admin" ON public.doa_rules
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: suppliers
DROP POLICY IF EXISTS "suppliers_write_finance_admin" ON public.suppliers;
CREATE POLICY "suppliers_write_finance_admin" ON public.suppliers
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: customers
DROP POLICY IF EXISTS "customers_write_finance_admin" ON public.customers;
CREATE POLICY "customers_write_finance_admin" ON public.customers
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: bank_accounts
DROP POLICY IF EXISTS "bank_accounts_write_finance_admin" ON public.bank_accounts;
CREATE POLICY "bank_accounts_write_finance_admin" ON public.bank_accounts
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: approval_workflows
DROP POLICY IF EXISTS "approval_workflows_write_finance_admin" ON public.approval_workflows;
CREATE POLICY "approval_workflows_write_finance_admin" ON public.approval_workflows
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Finance foundation: approval_history
DROP POLICY IF EXISTS "approval_history_write_finance_admin" ON public.approval_history;
CREATE POLICY "approval_history_write_finance_admin" ON public.approval_history
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: purchase_requisitions
DROP POLICY IF EXISTS "purchase_requisitions_write_finance_admin" ON public.purchase_requisitions;
CREATE POLICY "purchase_requisitions_write_finance_admin" ON public.purchase_requisitions
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: purchase_requisition_items
DROP POLICY IF EXISTS "purchase_requisition_items_write_finance_admin" ON public.purchase_requisition_items;
CREATE POLICY "purchase_requisition_items_write_finance_admin" ON public.purchase_requisition_items
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: ap_invoices
DROP POLICY IF EXISTS "ap_invoices_write_finance_admin" ON public.ap_invoices;
CREATE POLICY "ap_invoices_write_finance_admin" ON public.ap_invoices
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: ap_invoice_lines
DROP POLICY IF EXISTS "ap_invoice_lines_write_finance_admin" ON public.ap_invoice_lines;
CREATE POLICY "ap_invoice_lines_write_finance_admin" ON public.ap_invoice_lines
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: payment_vouchers
DROP POLICY IF EXISTS "payment_vouchers_write_finance_admin" ON public.payment_vouchers;
CREATE POLICY "payment_vouchers_write_finance_admin" ON public.payment_vouchers
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AP: payment_voucher_allocations
DROP POLICY IF EXISTS "payment_voucher_allocations_write_finance_admin" ON public.payment_voucher_allocations;
CREATE POLICY "payment_voucher_allocations_write_finance_admin" ON public.payment_voucher_allocations
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AR: ar_invoices
DROP POLICY IF EXISTS "ar_invoices_write_finance_admin" ON public.ar_invoices;
CREATE POLICY "ar_invoices_write_finance_admin" ON public.ar_invoices
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AR: ar_invoice_lines
DROP POLICY IF EXISTS "ar_invoice_lines_write_finance_admin" ON public.ar_invoice_lines;
CREATE POLICY "ar_invoice_lines_write_finance_admin" ON public.ar_invoice_lines
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AR: official_receipts
DROP POLICY IF EXISTS "official_receipts_write_finance_admin" ON public.official_receipts;
CREATE POLICY "official_receipts_write_finance_admin" ON public.official_receipts
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- AR: official_receipt_allocations
DROP POLICY IF EXISTS "official_receipt_allocations_write_finance_admin" ON public.official_receipt_allocations;
CREATE POLICY "official_receipt_allocations_write_finance_admin" ON public.official_receipt_allocations
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- COA
DROP POLICY IF EXISTS "coa_write_finance_admin" ON public.chart_of_accounts;
CREATE POLICY "coa_write_finance_admin" ON public.chart_of_accounts
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Petty cash settings
DROP POLICY IF EXISTS "petty_cash_settings_write_finance_admin" ON public.petty_cash_settings;
CREATE POLICY "petty_cash_settings_write_finance_admin" ON public.petty_cash_settings
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Petty cash transactions: insert
DROP POLICY IF EXISTS "petty_cash_txn_insert" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_insert" ON public.petty_cash_transactions
  FOR INSERT TO authenticated WITH CHECK (is_finance_user());

-- Petty cash transactions: update
DROP POLICY IF EXISTS "petty_cash_txn_update" ON public.petty_cash_transactions;
CREATE POLICY "petty_cash_txn_update" ON public.petty_cash_transactions
  FOR UPDATE TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- Projects (also allows hr role)
DROP POLICY IF EXISTS "projects_write_finance_hr_admin" ON public.projects;
CREATE POLICY "projects_write_finance_hr_admin" ON public.projects
  FOR ALL TO authenticated
  USING (is_finance_user() OR has_role(auth.uid(), 'hr'::app_role))
  WITH CHECK (is_finance_user() OR has_role(auth.uid(), 'hr'::app_role));

-- Project cost allocations
DROP POLICY IF EXISTS "project_cost_allocations_write_finance_admin" ON public.project_cost_allocations;
CREATE POLICY "project_cost_allocations_write_finance_admin" ON public.project_cost_allocations
  FOR ALL TO authenticated USING (is_finance_user()) WITH CHECK (is_finance_user());

-- PV post type audit
DROP POLICY IF EXISTS "Users with finance roles can view post type audit" ON public.pv_post_type_audit;
CREATE POLICY "Users with finance roles can view post type audit" ON public.pv_post_type_audit
  FOR SELECT TO authenticated USING (is_finance_user());

DROP POLICY IF EXISTS "Users with finance roles can insert post type audit" ON public.pv_post_type_audit;
CREATE POLICY "Users with finance roles can insert post type audit" ON public.pv_post_type_audit
  FOR INSERT TO authenticated WITH CHECK (is_finance_user());
