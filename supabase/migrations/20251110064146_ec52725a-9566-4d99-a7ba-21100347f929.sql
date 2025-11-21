-- Fix Sunday OT calculation bug
-- Step 1: Update existing incorrect Sunday OT amounts
UPDATE ot_requests
SET ot_amount = CASE 
  WHEN day_type = 'sunday' AND total_hours <= 4 THEN 0.5 * orp
  WHEN day_type = 'sunday' AND total_hours > 4 AND total_hours <= 8 THEN 1.0 * orp
  WHEN day_type = 'sunday' AND total_hours > 8 THEN (1.0 * orp) + (2 * hrp * (total_hours - 8))
  ELSE ot_amount
END
WHERE day_type = 'sunday' 
AND ot_amount IS NOT NULL;

-- Step 2: Replace the buggy evaluate_ot_formula function with improved logic
CREATE OR REPLACE FUNCTION public.evaluate_ot_formula(
  formula_text text,
  p_orp numeric,
  p_hrp numeric,
  p_hours numeric,
  p_basic numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result numeric;
  working_formula text;
BEGIN
  working_formula := formula_text;
  
  -- Handle simple formulas without IF
  IF working_formula NOT ILIKE '%IF%' THEN
    -- Replace variables with actual values
    working_formula := replace(working_formula, 'Hours', p_hours::text);
    working_formula := replace(working_formula, 'ORP', p_orp::text);
    working_formula := replace(working_formula, 'HRP', p_hrp::text);
    working_formula := replace(working_formula, 'Basic', p_basic::text);
    working_formula := replace(working_formula, '×', '*');
    working_formula := replace(working_formula, '÷', '/');
    
    -- Evaluate as numeric expression
    EXECUTE 'SELECT ' || working_formula INTO result;
    RETURN result;
  END IF;
  
  -- Handle nested IF statements by evaluating from innermost to outermost
  -- For Sunday formula: IF(Hours <= 4, 0.5 * ORP, IF(Hours <= 8, 1 * ORP, (1 * ORP) + (2 * HRP * (Hours - 8))))
  
  -- Strategy: Manually handle common patterns for Sunday, Public Holiday cases
  -- This is more reliable than regex parsing for nested IFs
  
  -- Sunday case with nested IFs
  IF working_formula ~* 'IF\s*\(\s*Hours\s*<=\s*4.*IF\s*\(\s*Hours\s*<=\s*8' THEN
    IF p_hours <= 4 THEN
      working_formula := '0.5 * ORP';
    ELSIF p_hours <= 8 THEN
      working_formula := '1 * ORP';
    ELSE
      working_formula := '(1 * ORP) + (2 * HRP * (Hours - 8))';
    END IF;
    
    -- Replace variables and evaluate
    working_formula := replace(working_formula, 'Hours', p_hours::text);
    working_formula := replace(working_formula, 'ORP', p_orp::text);
    working_formula := replace(working_formula, 'HRP', p_hrp::text);
    working_formula := replace(working_formula, '×', '*');
    working_formula := replace(working_formula, '÷', '/');
    
    EXECUTE 'SELECT ' || working_formula INTO result;
    RETURN result;
  END IF;
  
  -- Public holiday case with nested IFs
  IF working_formula ~* 'IF\s*\(\s*Hours\s*<=\s*8.*\(2\s*\*\s*ORP\)' THEN
    IF p_hours <= 8 THEN
      working_formula := '2 * ORP';
    ELSE
      working_formula := '(2 * ORP) + (3 * HRP * (Hours - 8))';
    END IF;
    
    -- Replace variables and evaluate
    working_formula := replace(working_formula, 'Hours', p_hours::text);
    working_formula := replace(working_formula, 'ORP', p_orp::text);
    working_formula := replace(working_formula, 'HRP', p_hrp::text);
    working_formula := replace(working_formula, '×', '*');
    working_formula := replace(working_formula, '÷', '/');
    
    EXECUTE 'SELECT ' || working_formula INTO result;
    RETURN result;
  END IF;
  
  -- Simple single IF statement (no nesting)
  IF working_formula ~* '^IF\s*\(\s*Hours\s*<=\s*\d+' THEN
    DECLARE
      threshold numeric;
      true_branch text;
      false_branch text;
      if_content text;
      paren_count int := 0;
      i int;
      comma_pos int;
    BEGIN
      -- Extract threshold
      threshold := substring(working_formula from 'Hours\s*<=\s*(\d+)')::numeric;
      
      -- Extract content between IF( and final )
      if_content := substring(working_formula from 'IF\s*\((.*)\)$');
      
      -- Find the comma that separates true and false branches (accounting for nested parens)
      comma_pos := 0;
      FOR i IN 1..length(if_content) LOOP
        IF substring(if_content from i for 1) = '(' THEN
          paren_count := paren_count + 1;
        ELSIF substring(if_content from i for 1) = ')' THEN
          paren_count := paren_count - 1;
        ELSIF substring(if_content from i for 1) = ',' AND paren_count = 0 THEN
          IF comma_pos = 0 THEN
            comma_pos := i;
          ELSE
            EXIT; -- Found second comma at top level
          END IF;
        END IF;
      END LOOP;
      
      -- Skip the condition part to get branches
      true_branch := trim(split_part(substring(if_content from position(',' in if_content) + 1), ',', 1));
      false_branch := trim(split_part(substring(if_content from position(',' in if_content) + 1), ',', 2));
      
      -- Evaluate condition and select branch
      IF p_hours <= threshold THEN
        working_formula := true_branch;
      ELSE
        working_formula := false_branch;
      END IF;
      
      -- Replace variables and evaluate
      working_formula := replace(working_formula, 'Hours', p_hours::text);
      working_formula := replace(working_formula, 'ORP', p_orp::text);
      working_formula := replace(working_formula, 'HRP', p_hrp::text);
      working_formula := replace(working_formula, 'Basic', p_basic::text);
      working_formula := replace(working_formula, '×', '*');
      working_formula := replace(working_formula, '÷', '/');
      
      EXECUTE 'SELECT ' || working_formula INTO result;
      RETURN result;
    END;
  END IF;
  
  -- Fallback: return NULL to trigger legacy calculation
  RAISE NOTICE 'Could not parse formula: %, returning NULL to use legacy fallback', formula_text;
  RETURN NULL;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error evaluating formula: % - Error: %, returning NULL', formula_text, SQLERRM;
    RETURN NULL;
END;
$function$;