import { supabase } from '@/integrations/supabase/client';

export type EmployeeLeaveType =
  | 'annual'
  | 'medical'
  | 'emergency'
  | 'unpaid'
  | 'maternity'
  | 'paternity'
  | 'other';

export type EmployeeLeaveStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeLeaveInput {
  employee_id: string;
  leave_date: string; // YYYY-MM-DD
  leave_type: EmployeeLeaveType;
  status?: EmployeeLeaveStatus;
  notes?: string | null;
}

export interface LeaveImportResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export class EmployeeLeaveService {
  async getEmployeeLeave(employeeId: string, year?: number): Promise<any[]> {
    const targetYear = year || new Date().getFullYear();
    const start = `${targetYear}-01-01`;
    const end = `${targetYear}-12-31`;

    const { data, error } = await supabase
      .from('employee_leave')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('leave_date', start)
      .lte('leave_date', end)
      .order('leave_date', { ascending: true });

    if (error) {
      console.error('Error fetching employee leave:', error);
      return [];
    }

    return data || [];
  }

  async addLeave(input: EmployeeLeaveInput): Promise<{ success: boolean; error?: string }>{
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User must be authenticated' };
    }

    const { error } = await supabase
      .from('employee_leave')
      .insert({
        employee_id: input.employee_id,
        leave_date: input.leave_date,
        leave_type: input.leave_type,
        status: input.status || 'approved',
        notes: input.notes || null,
        created_by: user.id,
      });

    if (error) {
      console.error('Error adding leave entry:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Bulk import leave entries.
   * Expected CSV headers (case-insensitive): employee_id, leave_date, leave_type, status, notes
   */
  async importLeave(csvData: string): Promise<LeaveImportResult> {
    const result: LeaveImportResult = { successful: 0, failed: 0, errors: [] };

    const lines = csvData
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return result;

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);

    const employeeIdIdx = idx('employee_id');
    const dateIdx = idx('leave_date');
    const typeIdx = idx('leave_type');
    const statusIdx = idx('status');
    const notesIdx = idx('notes');

    if (employeeIdIdx === -1 || dateIdx === -1 || typeIdx === -1) {
      return {
        ...result,
        failed: lines.length - 1,
        errors: [{ row: 1, error: 'Missing required headers: employee_id, leave_date, leave_type' }],
      };
    }

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const cols = lines[i].split(',').map((c) => c.trim());

      try {
        const employee_id = cols[employeeIdIdx];
        const leave_date = cols[dateIdx];
        const leave_type = cols[typeIdx] as EmployeeLeaveType;
        const status = (statusIdx !== -1 ? (cols[statusIdx] as EmployeeLeaveStatus) : undefined);
        const notes = notesIdx !== -1 ? (cols[notesIdx] || null) : null;

        const resp = await this.addLeave({ employee_id, leave_date, leave_type, status, notes });
        if (!resp.success) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: resp.error || 'Unknown error' });
          continue;
        }

        result.successful++;
      } catch (e) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return result;
  }
}

export const employeeLeaveService = new EmployeeLeaveService();
