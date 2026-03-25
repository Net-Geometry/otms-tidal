export interface EmployeeDependent {
  id: string;
  employee_id: string;
  relationship: 'spouse' | 'child';
  name: string;
  date_of_birth: string | null;
  is_disabled: boolean;
  is_studying: boolean;
  education_status: 'none' | 'full_time_local' | 'degree_local_overseas';
  has_own_income: boolean;
  is_dependant: boolean;
  created_at: string;
  updated_at: string;
}
