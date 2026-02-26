-- Fix existing company names
UPDATE public.companies SET name = 'Tidal Holdings Sdn Bhd' WHERE code = 'THSB';
UPDATE public.companies SET name = 'Tidal Venture Sdn Bhd' WHERE code = 'TVSB';
UPDATE public.companies SET name = 'Tidal Technical Supply & Services Sdn Bhd' WHERE code = 'TTSS';
UPDATE public.companies SET name = 'Janamurni Sdn Bhd' WHERE code = 'JMSB';

-- Fix TMT → TMSB
UPDATE public.companies SET name = 'Tidal Minds Sdn Bhd', code = 'TMSB' WHERE code = 'TMT';

-- Add missing subsidiaries under THSB
INSERT INTO public.companies (name, code, parent_company_id)
VALUES
  ('Tidal Properties Sdn Bhd', 'TPSB', (SELECT id FROM public.companies WHERE code = 'THSB')),
  ('Tidal Energy Sdn Bhd', 'TESB', (SELECT id FROM public.companies WHERE code = 'THSB')),
  ('Tidal Techkem Sdn Bhd', 'TTSB', (SELECT id FROM public.companies WHERE code = 'THSB'));
