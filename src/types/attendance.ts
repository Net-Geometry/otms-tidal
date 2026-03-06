export type AttendanceRecordStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'half_day'
  | 'on_leave'
  | 'holiday'
  | 'rest_day';

export type AttendanceImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type AttendanceSource = 'import' | 'manual' | 'clock_in';

export interface AttendanceSettings {
  id: number;
  late_threshold_minutes: number;
  monthly_cutoff_date: number;
  is_shift_mandatory: boolean;
  allow_early_clockin: boolean;
  allow_multiple_clockin: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  start_time: string; // Postgres time
  end_time: string; // Postgres time
  grace_period_minutes: number;
  is_overnight: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  effective_date: string; // YYYY-MM-DD
  end_date: string | null;
  is_current: boolean;
  allow_multiple_clockin: boolean;
  created_at?: string;
  updated_at?: string;
  shift?: Shift;
  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    department_id?: string;
    departments?: { name: string };
  };
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  clock_in: string | null;
  clock_out: string | null;
  clock_in_2: string | null;
  clock_out_2: string | null;
  shift_id: string | null;
  status: AttendanceRecordStatus;
  is_late: boolean;
  late_minutes: number;
  source: AttendanceSource;
  import_id: string | null;
  notes: string | null;
  attachment_urls: string[] | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  profiles?: {
    id: string;
    employee_id: string;
    full_name: string;
    department_id?: string;
    departments?: { name: string };
  };
  shift?: Shift;
  attendance_imports?: {
    id: string;
    filename: string;
    status: AttendanceImportStatus;
  };
}

export interface AttendanceImport {
  id: string;
  uploaded_by: string | null;
  filename: string;
  file_size_bytes: number | null;
  record_count: number;
  success_count: number;
  error_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  status: AttendanceImportStatus;
  error_log: any;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceCsvRow {
  employee_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  clock_in_2?: string;
  clock_out_2?: string;
}

export interface AttendanceMonthlySummary {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_records: number;
  late_minutes_total: number;
}
