-- Fix PostgREST relationships: link leave_requests.*_id columns to public.profiles
-- so joins like profiles!leave_requests_employee_id_fkey work.

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey,
  ADD CONSTRAINT leave_requests_employee_id_fkey
    FOREIGN KEY (employee_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_supervisor_id_fkey,
  ADD CONSTRAINT leave_requests_supervisor_id_fkey
    FOREIGN KEY (supervisor_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_hr_id_fkey,
  ADD CONSTRAINT leave_requests_hr_id_fkey
    FOREIGN KEY (hr_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_management_id_fkey,
  ADD CONSTRAINT leave_requests_management_id_fkey
    FOREIGN KEY (management_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_rejected_by_fkey,
  ADD CONSTRAINT leave_requests_rejected_by_fkey
    FOREIGN KEY (rejected_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
