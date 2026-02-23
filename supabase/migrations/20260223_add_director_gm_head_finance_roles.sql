-- Add new role values to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gm';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_finance';
