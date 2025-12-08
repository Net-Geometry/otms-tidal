-- Drop old overly-permissive RLS policies
-- The old otr_respective_sup_read policy allowed HR and Management users to see ALL OT requests
-- This conflicts with the new restrictive policies that properly scope access
-- by supervisor_id and respective_supervisor_id

-- Drop the old permissive policy that was granting universal access to HR/Management
DROP POLICY IF EXISTS "otr_respective_sup_read" ON public.ot_requests;

-- Note: The following new restrictive policies now control access:
-- 1. otr_sup_read (from 20251118_restrict_supervisor_ot_requests_policy.sql)
--    - Supervisors see only requests where they are supervisor_id OR respective_supervisor_id
-- 2. otr_hr_read (from 20251118_restrict_hr_management_ot_requests_policy.sql)
--    - HR/Management/Admin see all requests (by design for their roles)
-- 3. otr_respective_sup_read (from 20251118_restrict_hr_management_ot_requests_policy.sql)
--    - Respective supervisors see only requests where they are assigned (respective_supervisor_id)
