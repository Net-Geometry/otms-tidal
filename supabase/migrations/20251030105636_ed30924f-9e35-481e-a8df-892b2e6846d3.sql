-- Create has_role function (security definer to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create determine_day_type function
CREATE OR REPLACE FUNCTION public.determine_day_type(ot_date date)
RETURNS day_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dow int;
  is_holiday boolean;
BEGIN
  dow := EXTRACT(DOW FROM ot_date);
  SELECT EXISTS(SELECT 1 FROM public.public_holidays WHERE holiday_date = ot_date) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'public_holiday';
  ELSIF dow = 0 THEN
    RETURN 'sunday';
  ELSIF dow = 6 THEN
    RETURN 'saturday';
  ELSE
    RETURN 'weekday';
  END IF;
END;
$$;

-- Create calculate_ot_amount function
CREATE OR REPLACE FUNCTION public.calculate_ot_amount(
  basic_salary numeric,
  total_hours numeric,
  day_type day_type
)
RETURNS TABLE(orp numeric, hrp numeric, ot_amount numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o numeric;
  h numeric;
  a numeric;
BEGIN
  o := basic_salary / 26;
  h := o / 8;
  
  CASE day_type
    WHEN 'weekday' THEN
      a := 1.5 * h * total_hours;
    WHEN 'saturday' THEN
      a := 2 * h * total_hours;
    WHEN 'sunday' THEN
      IF total_hours <= 4 THEN
        a := 0.5 * o;
      ELSIF total_hours <= 8 THEN
        a := 1 * o;
      ELSE
        a := (1 * o) + (2 * h * (total_hours - 8));
      END IF;
    WHEN 'public_holiday' THEN
      IF total_hours <= 8 THEN
        a := 2 * o;
      ELSE
        a := (2 * o) + (3 * h * (total_hours - 8));
      END IF;
  END CASE;
  
  RETURN QUERY SELECT o, h, a;
END;
$$;

-- Create get_active_formula function
CREATE OR REPLACE FUNCTION public.get_active_formula(
  _day_type day_type,
  _employee_category text,
  _ot_date date
)
RETURNS TABLE(
  formula_id uuid,
  formula_name text,
  multiplier numeric,
  base_formula text,
  conditional_logic jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    ot_rate_formulas.formula_name,
    ot_rate_formulas.multiplier,
    ot_rate_formulas.base_formula,
    ot_rate_formulas.conditional_logic
  FROM ot_rate_formulas
  WHERE is_active
    AND day_type = _day_type
    AND (employee_category = _employee_category OR employee_category = 'All')
    AND effective_from <= _ot_date
    AND (effective_to IS NULL OR effective_to >= _ot_date)
  ORDER BY 
    CASE WHEN employee_category = 'All' THEN 1 ELSE 0 END,
    effective_from DESC
  LIMIT 1;
END;
$$;

-- Create check_ot_eligibility function
CREATE OR REPLACE FUNCTION public.check_ot_eligibility(
  _employee_id uuid,
  _ot_date date
)
RETURNS TABLE(
  is_eligible boolean,
  rule_id uuid,
  rule_name text,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp record;
  r record;
BEGIN
  SELECT 
    p.basic_salary,
    p.department_id,
    p.employment_type,
    COALESCE(array_agg(ur.role), ARRAY[]::app_role[]) as roles
  INTO emp
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = _employee_id
  GROUP BY p.id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Employee not found';
    RETURN;
  END IF;
  
  FOR r IN 
    SELECT * FROM ot_eligibility_rules 
    WHERE is_active 
    ORDER BY created_at DESC
  LOOP
    IF emp.basic_salary < r.min_salary OR emp.basic_salary > r.max_salary THEN
      CONTINUE;
    END IF;
    
    IF array_length(r.department_ids, 1) > 0 AND NOT (emp.department_id = ANY(r.department_ids)) THEN
      CONTINUE;
    END IF;
    
    IF array_length(r.role_ids, 1) > 0 AND NOT (emp.roles::text[] && r.role_ids) THEN
      CONTINUE;
    END IF;
    
    IF array_length(r.employment_types, 1) > 0 AND NOT (emp.employment_type = ANY(r.employment_types)) THEN
      CONTINUE;
    END IF;
    
    RETURN QUERY SELECT true, r.id, r.rule_name, 'Eligible under ' || r.rule_name;
    RETURN;
  END LOOP;
  
  RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'No matching eligibility rule found';
END;
$$;

-- Create check_threshold_violations function
CREATE OR REPLACE FUNCTION public.check_threshold_violations(
  _employee_id uuid,
  _requested_hours numeric,
  _requested_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  dept uuid;
  d numeric;
  w numeric;
  m numeric;
  amt numeric;
  violations jsonb := '[]'::jsonb;
BEGIN
  SELECT department_id INTO dept FROM profiles WHERE id = _employee_id;
  
  SELECT * INTO t 
  FROM ot_approval_thresholds
  WHERE is_active
    AND (array_length(applies_to_department_ids, 1) = 0 OR dept = ANY(applies_to_department_ids))
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Daily check
  SELECT COALESCE(SUM(total_hours), 0) + _requested_hours INTO d
  FROM ot_requests
  WHERE employee_id = _employee_id
    AND ot_date = _requested_date
    AND status <> 'rejected';
    
  IF d > t.daily_limit_hours THEN
    violations := violations || jsonb_build_object(
      'type', 'daily',
      'limit', t.daily_limit_hours,
      'current', d,
      'exceeded_by', d - t.daily_limit_hours
    );
  END IF;
  
  -- Weekly check
  SELECT COALESCE(SUM(total_hours), 0) + _requested_hours INTO w
  FROM ot_requests
  WHERE employee_id = _employee_id
    AND ot_date >= _requested_date - INTERVAL '8 days'
    AND ot_date <= _requested_date
    AND status <> 'rejected';
    
  IF w > t.weekly_limit_hours THEN
    violations := violations || jsonb_build_object(
      'type', 'weekly',
      'limit', t.weekly_limit_hours,
      'current', w,
      'exceeded_by', w - t.weekly_limit_hours
    );
  END IF;
  
  -- Monthly check (hours and amount)
  SELECT 
    COALESCE(SUM(total_hours), 0) + _requested_hours,
    COALESCE(SUM(ot_amount), 0)
  INTO m, amt
  FROM ot_requests
  WHERE employee_id = _employee_id
    AND date_trunc('month', ot_date) = date_trunc('month', _requested_date)
    AND status <> 'rejected';
    
  IF m > t.monthly_limit_hours THEN
    violations := violations || jsonb_build_object(
      'type', 'monthly_hours',
      'limit', t.monthly_limit_hours,
      'current', m,
      'exceeded_by', m - t.monthly_limit_hours
    );
  END IF;
  
  IF amt > t.max_claimable_amount THEN
    violations := violations || jsonb_build_object(
      'type', 'monthly_amount',
      'limit', t.max_claimable_amount,
      'current', amt,
      'exceeded_by', amt - t.max_claimable_amount
    );
  END IF;
  
  RETURN jsonb_build_object(
    'violations', violations,
    'auto_block', t.auto_block_enabled,
    'threshold_name', t.threshold_name
  );
END;
$$;

-- Create update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS upd_profiles ON public.profiles;
CREATE TRIGGER upd_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS upd_ot_requests ON public.ot_requests;
CREATE TRIGGER upd_ot_requests
  BEFORE UPDATE ON public.ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS upd_rules ON public.ot_eligibility_rules;
CREATE TRIGGER upd_rules
  BEFORE UPDATE ON public.ot_eligibility_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS upd_formulas ON public.ot_rate_formulas;
CREATE TRIGGER upd_formulas
  BEFORE UPDATE ON public.ot_rate_formulas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS upd_thresholds ON public.ot_approval_thresholds;
CREATE TRIGGER upd_thresholds
  BEFORE UPDATE ON public.ot_approval_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();