-- Change default journal entry prefix for payment_voucher reference type from PV to CB
-- This avoids confusion between PV numbers (e.g. PV-TMT-001) and their cashbook journal entries.
-- The journal entry description now carries the source PV number for traceability.

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
