-- Finance: petty cash settings singleton

CREATE TABLE IF NOT EXISTS public.petty_cash_settings (
  id int PRIMARY KEY DEFAULT 1,
  float_amount numeric(12,2) NOT NULL DEFAULT 500.00,
  approval_threshold numeric(12,2) NOT NULL DEFAULT 100.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT petty_cash_settings_singleton CHECK (id = 1)
);

INSERT INTO public.petty_cash_settings (id, float_amount, approval_threshold)
VALUES (1, 500.00, 100.00)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_petty_cash_settings_updated_at ON public.petty_cash_settings;
CREATE TRIGGER trg_petty_cash_settings_updated_at
  BEFORE UPDATE ON public.petty_cash_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.petty_cash_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "petty_cash_settings_read_authenticated" ON public.petty_cash_settings;
CREATE POLICY "petty_cash_settings_read_authenticated"
  ON public.petty_cash_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "petty_cash_settings_write_finance_admin" ON public.petty_cash_settings;
CREATE POLICY "petty_cash_settings_write_finance_admin"
  ON public.petty_cash_settings
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
