-- Add employer SOCSO and EPF registration numbers to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS socso_employer_no text,
  ADD COLUMN IF NOT EXISTS epf_employer_no text;
