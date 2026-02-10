-- Claims Management: claim_request_status enum + claim_types + claims + RLS

-- 1) Enum for claim request status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'claim_request_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.claim_request_status AS ENUM (
      'pending_supervisor',
      'supervisor_approved',
      'pending_hr',
      'hr_approved',
      'pending_finance',
      'finance_approved',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

-- 2) Configurable claim types
CREATE TABLE IF NOT EXISTS public.claim_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  final_approver text NOT NULL CHECK (final_approver IN ('hr', 'finance')),
  limit_amount numeric(12,2),
  limit_period text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_claim_types_updated_at ON public.claim_types;
CREATE TRIGGER trg_claim_types_updated_at
  BEFORE UPDATE ON public.claim_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.claim_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_types_read_all" ON public.claim_types;
CREATE POLICY "claim_types_read_all"
  ON public.claim_types
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "claim_types_write_hr_admin" ON public.claim_types;
CREATE POLICY "claim_types_write_hr_admin"
  ON public.claim_types
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) Claims workflow table
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,

  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_type_id uuid NOT NULL REFERENCES public.claim_types(id) ON DELETE RESTRICT,

  claim_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  purpose text,
  receipt_urls text[] DEFAULT '{}',
  limit_warning text,

  status public.claim_request_status NOT NULL DEFAULT 'pending_supervisor',

  supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  supervisor_approved_at timestamptz,
  supervisor_remarks text,

  hr_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hr_approved_at timestamptz,
  hr_remarks text,

  finance_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finance_approved_at timestamptz,
  finance_remarks text,

  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_remarks text,
  rejection_stage text,

  cancelled_at timestamptz,
  cancellation_reason text,

  -- Finance posting fields
  is_posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posting_reference text,
  posting_remarks text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT claims_amount_check CHECK (amount > 0)
);

DROP TRIGGER IF EXISTS trg_claims_updated_at ON public.claims;
CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claims_employee_id ON public.claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_claims_claim_type_id ON public.claims(claim_type_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_supervisor_id ON public.claims(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_claims_hr_id ON public.claims(hr_id);
CREATE INDEX IF NOT EXISTS idx_claims_finance_id ON public.claims(finance_id);
CREATE INDEX IF NOT EXISTS idx_claims_claim_date ON public.claims(claim_date);
CREATE INDEX IF NOT EXISTS idx_claims_is_posted ON public.claims(is_posted);

-- RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claims_read_own" ON public.claims;
CREATE POLICY "claims_read_own" ON public.claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "claims_read_supervisor" ON public.claims;
CREATE POLICY "claims_read_supervisor" ON public.claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = supervisor_id);

DROP POLICY IF EXISTS "claims_read_hr_admin" ON public.claims;
CREATE POLICY "claims_read_hr_admin" ON public.claims
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "claims_read_finance_admin" ON public.claims;
CREATE POLICY "claims_read_finance_admin" ON public.claims
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "claims_insert_own" ON public.claims;
CREATE POLICY "claims_insert_own" ON public.claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "claims_update" ON public.claims;
CREATE POLICY "claims_update" ON public.claims
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = employee_id
    OR auth.uid() = supervisor_id
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
