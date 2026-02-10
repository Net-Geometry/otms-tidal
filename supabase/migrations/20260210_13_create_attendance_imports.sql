-- Attendance Management: attendance_imports table + FK from attendance_records

CREATE TABLE IF NOT EXISTS public.attendance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_size_bytes bigint,
  record_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  date_range_start date,
  date_range_end date,
  status public.attendance_import_status NOT NULL DEFAULT 'pending',
  error_log jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT attendance_imports_counts_nonneg CHECK (
    record_count >= 0 AND success_count >= 0 AND error_count >= 0
  )
);

DROP TRIGGER IF EXISTS trg_attendance_imports_updated_at ON public.attendance_imports;
CREATE TRIGGER trg_attendance_imports_updated_at
  BEFORE UPDATE ON public.attendance_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Link attendance_records.import_id -> attendance_imports.id
ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_import_id_fkey;
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_import_id_fkey
    FOREIGN KEY (import_id)
    REFERENCES public.attendance_imports(id)
    ON DELETE SET NULL;

ALTER TABLE public.attendance_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_imports_hr_admin_only" ON public.attendance_imports;
CREATE POLICY "attendance_imports_hr_admin_only"
  ON public.attendance_imports
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
