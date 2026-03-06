export interface EmployeeDependent {
  id: string;
  employee_id: string;
  relationship: 'spouse' | 'child';
  name: string;
  date_of_birth: string | null;
  is_disabled: boolean;
  is_studying: boolean;
  created_at: string;
  updated_at: string;
}
