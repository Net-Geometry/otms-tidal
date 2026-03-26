-- Allow approval roles (assistant_manager, dmd, management) to update
-- payment_vouchers and purchase_requisitions for the check/approve/reject flow.

-- Payment vouchers: finance users + approval roles
DROP POLICY IF EXISTS "payment_vouchers_write_finance_admin" ON public.payment_vouchers;
CREATE POLICY "payment_vouchers_write_finance_admin" ON public.payment_vouchers
  FOR ALL TO authenticated
  USING (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

-- Purchase requisitions: finance users + approval roles
DROP POLICY IF EXISTS "purchase_requisitions_write_finance_admin" ON public.purchase_requisitions;
CREATE POLICY "purchase_requisitions_write_finance_admin" ON public.purchase_requisitions
  FOR ALL TO authenticated
  USING (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

-- Purchase requisition items: same roles
DROP POLICY IF EXISTS "purchase_requisition_items_write_finance_admin" ON public.purchase_requisition_items;
CREATE POLICY "purchase_requisition_items_write_finance_admin" ON public.purchase_requisition_items
  FOR ALL TO authenticated
  USING (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );

-- Approval history: approvers need to write here too
DROP POLICY IF EXISTS "approval_history_write_finance_admin" ON public.approval_history;
CREATE POLICY "approval_history_write_finance_admin" ON public.approval_history
  FOR ALL TO authenticated
  USING (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  )
  WITH CHECK (
    is_finance_user()
    OR has_role(auth.uid(), 'assistant_manager'::app_role)
    OR has_role(auth.uid(), 'dmd'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
  );
