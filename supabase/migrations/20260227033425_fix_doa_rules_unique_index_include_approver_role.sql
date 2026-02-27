-- Fix doa_rules unique index to include approver_role
-- Allows multiple rules for the same company/document_type/level/amount with different approver roles

DROP INDEX IF EXISTS idx_doa_rules_unique_window;

CREATE UNIQUE INDEX idx_doa_rules_unique_window
  ON public.doa_rules (company_id, document_type, approval_level, min_amount, approver_role);
