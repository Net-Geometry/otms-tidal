export interface HolidayRefreshLog {
  id: string;
  job_type: 'monthly_refresh' | 'q4_population' | 'manual_refresh' | string;
  year: number;
  status: 'started' | 'success' | 'partial' | 'failed';
  holidays_scraped: number;
  errors: Array<{ state: string; error: string }>;
  started_at: string;
  completed_at: string | null;
}

export interface StateWeekendConfig {
  state_code: string;
  weekend_days: number[]; // 0=Sun, 6=Sat
  effective_from: string;
}

export interface EmployeeLeave {
  id: string;
  employee_id: string;
  leave_date: string;
  leave_type: 'annual' | 'medical' | 'emergency' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  status: 'pending' | 'approved' | 'rejected';
}
