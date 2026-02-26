-- Add parent_company_id to companies table
ALTER TABLE public.companies
ADD COLUMN parent_company_id UUID REFERENCES public.companies(id);

-- Create index for subsidiary lookups
CREATE INDEX idx_companies_parent_company_id ON public.companies(parent_company_id);

-- Set THSB as parent of all subsidiaries
UPDATE public.companies
SET parent_company_id = (SELECT id FROM public.companies WHERE code = 'THSB')
WHERE code IN ('TVSB', 'TTSS', 'JMSB', 'TMT');
