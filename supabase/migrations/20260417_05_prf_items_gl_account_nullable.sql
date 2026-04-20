-- Tidal Finance request: PRFs are pre-GL-coding documents.
-- Remove GL Account requirement from PRF line items; GL coding now happens at PV.
-- Keep column nullable (legacy data preserved).

ALTER TABLE public.purchase_requisition_items
  ALTER COLUMN gl_account_id DROP NOT NULL;
