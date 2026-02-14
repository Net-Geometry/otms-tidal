-- Add per-employee payroll contribution rate columns to profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_epf_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS employer_epf_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS employee_socso_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS employer_socso_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS employee_eis_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS employer_eis_rate numeric(5,2);

-- Add comment to document the columns
COMMENT ON COLUMN public.profiles.employee_epf_rate IS 'Per-employee employee EPF contribution rate (%). If null, uses global payroll settings.';
COMMENT ON COLUMN public.profiles.employer_epf_rate IS 'Per-employee employer EPF contribution rate (%). If null, uses global payroll settings.';
COMMENT ON COLUMN public.profiles.employee_socso_rate IS 'Per-employee employee SOCSO contribution rate (%). If null, uses global payroll settings.';
COMMENT ON COLUMN public.profiles.employer_socso_rate IS 'Per-employee employer SOCSO contribution rate (%). If null, uses global payroll settings.';
COMMENT ON COLUMN public.profiles.employee_eis_rate IS 'Per-employee employee EIS contribution rate (%). If null, uses global payroll settings.';
COMMENT ON COLUMN public.profiles.employer_eis_rate IS 'Per-employee employer EIS contribution rate (%). If null, uses global payroll settings.';
