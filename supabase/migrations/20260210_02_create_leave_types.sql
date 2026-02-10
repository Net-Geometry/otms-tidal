-- Leave Management: leave_request_status enum + leave_types config table (seeded)

-- 1) Enum for leave request status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'leave_request_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.leave_request_status AS ENUM (
      'pending_supervisor',
      'supervisor_approved',
      'pending_hr',
      'hr_approved',
      'pending_management',
      'management_approved',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

-- 2) Configurable leave types
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  default_days numeric(5,1) NOT NULL DEFAULT 0,
  is_half_day_allowed boolean DEFAULT true,
  requires_attachment boolean DEFAULT false,
  is_paid boolean DEFAULT true,
  max_days numeric(5,1),
  is_carry_forward boolean DEFAULT false,
  max_carry_forward numeric(5,1) DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_leave_types_updated_at ON public.leave_types;
CREATE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_types_read_all" ON public.leave_types;
CREATE POLICY "leave_types_read_all"
  ON public.leave_types
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "leave_types_write_hr_admin" ON public.leave_types;
CREATE POLICY "leave_types_write_hr_admin"
  ON public.leave_types
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

-- Seed data (ERP MVP)
INSERT INTO public.leave_types (
  code,
  name,
  default_days,
  is_half_day_allowed,
  requires_attachment,
  is_paid,
  max_days,
  is_carry_forward,
  max_carry_forward,
  is_active,
  sort_order
)
VALUES
  ('annual', 'Annual Leave', 14, true, false, true, NULL, true, 0, true, 10),
  ('sick', 'Sick Leave', 14, true, true, true, NULL, false, 0, true, 20),
  ('medical', 'Medical/Hospitalization', 60, true, true, true, 60, false, 0, true, 30),
  ('marriage', 'Marriage Leave', 3, true, false, true, 3, false, 0, true, 40),
  ('maternity', 'Maternity Leave', 98, false, true, true, 98, false, 0, true, 50),
  ('paternity', 'Paternity Leave', 7, false, false, true, 7, false, 0, true, 60),
  ('replacement', 'Replacement Leave', 0, true, false, true, NULL, false, 0, true, 70),
  ('unpaid', 'Unpaid Leave', 0, true, false, false, NULL, false, 0, true, 80),
  ('compassionate', 'Compassionate Leave', 3, true, false, true, 3, false, 0, true, 90),
  ('half_day', 'Half-Day Leave', 0, true, false, true, NULL, false, 0, true, 100),
  ('emergency', 'Emergency Leave', 0, true, false, true, NULL, false, 0, true, 110)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  default_days = EXCLUDED.default_days,
  is_half_day_allowed = EXCLUDED.is_half_day_allowed,
  requires_attachment = EXCLUDED.requires_attachment,
  is_paid = EXCLUDED.is_paid,
  max_days = EXCLUDED.max_days,
  is_carry_forward = EXCLUDED.is_carry_forward,
  max_carry_forward = EXCLUDED.max_carry_forward,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
