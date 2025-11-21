-- Fix existing rate formulas with incorrect base_formula
-- Update formulas where base_formula is just 'HRP' to include 'Hours' variable
UPDATE ot_rate_formulas
SET 
  base_formula = 'HRP * Hours',
  updated_at = now()
WHERE base_formula = 'HRP'
  AND is_active = true;