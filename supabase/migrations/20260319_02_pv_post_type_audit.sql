-- Audit trail for PV post_to_type changes
CREATE TABLE IF NOT EXISTS public.pv_post_type_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pv_id uuid NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
  old_post_type text NOT NULL,
  new_post_type text NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_post_type_audit_pv_id ON public.pv_post_type_audit(pv_id);

ALTER TABLE public.pv_post_type_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance users can view post type audit" ON public.pv_post_type_audit;
DROP POLICY IF EXISTS "Finance users can insert post type audit" ON public.pv_post_type_audit;
DROP POLICY IF EXISTS "Users with finance roles can view post type audit" ON public.pv_post_type_audit;
DROP POLICY IF EXISTS "Users with finance roles can insert post type audit" ON public.pv_post_type_audit;

CREATE POLICY "Users with finance roles can view post type audit"
  ON public.pv_post_type_audit FOR SELECT
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'account_exec'::app_role)
  );

CREATE POLICY "Users with finance roles can insert post type audit"
  ON public.pv_post_type_audit FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'account_exec'::app_role)
  );
