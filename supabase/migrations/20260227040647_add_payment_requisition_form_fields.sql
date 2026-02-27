-- Add payment requisition form fields to purchase_requisitions
-- (PRF type, payable to, payment via, advance/refund, checklist, remarks)

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS prf_type text NOT NULL DEFAULT 'payment_request',
  ADD COLUMN IF NOT EXISTS prf_type_others text,
  ADD COLUMN IF NOT EXISTS payable_to text,
  ADD COLUMN IF NOT EXISTS payment_via text,
  ADD COLUMN IF NOT EXISTS prf_date date,
  ADD COLUMN IF NOT EXISTS advance_date_received date,
  ADD COLUMN IF NOT EXISTS advance_form_no text,
  ADD COLUMN IF NOT EXISTS advance_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reimburse_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS management_remarks text,
  ADD COLUMN IF NOT EXISTS chk_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_purchase_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_delivery_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_purchase_req_form boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_quotation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_work_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_letter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_memo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_others boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chk_others_text text,
  ADD COLUMN IF NOT EXISTS accounts_dept_remarks text;

-- Add doc_date and project_site to line items
ALTER TABLE public.purchase_requisition_items
  ADD COLUMN IF NOT EXISTS doc_date date,
  ADD COLUMN IF NOT EXISTS project_site text;
