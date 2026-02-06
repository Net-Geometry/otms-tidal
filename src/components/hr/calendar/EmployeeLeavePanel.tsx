import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { useEmployees } from '@/hooks/hr/useEmployees';
import { employeeLeaveService, type EmployeeLeaveType, type EmployeeLeaveStatus } from '@/services/EmployeeLeaveService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const LEAVE_TYPES: Array<{ label: string; value: EmployeeLeaveType }> = [
  { label: 'Annual', value: 'annual' },
  { label: 'Medical', value: 'medical' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Maternity', value: 'maternity' },
  { label: 'Paternity', value: 'paternity' },
  { label: 'Other', value: 'other' },
];

const STATUSES: Array<{ label: string; value: EmployeeLeaveStatus }> = [
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
];

export function EmployeeLeavePanel({ year: initialYear }: { year?: number }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState<number>(initialYear || new Date().getFullYear());
  const [employeeId, setEmployeeId] = useState<string>('');
  const [leaveDate, setLeaveDate] = useState<string>('');
  const [leaveType, setLeaveType] = useState<EmployeeLeaveType>('annual');
  const [status, setStatus] = useState<EmployeeLeaveStatus>('approved');
  const [notes, setNotes] = useState<string>('');
  const [csv, setCsv] = useState('employee_id,leave_date,leave_type,status,notes\n');
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const employeeOptions = useMemo(() => {
    return (employees || []).map((e: any) => ({
      id: e.id as string,
      label: `${e.full_name || e.email || e.employee_id || e.id}`,
    }));
  }, [employees]);

  const { data: leaveRows, isLoading: leaveLoading } = useQuery({
    queryKey: ['employee-leave', employeeId, year],
    queryFn: () => employeeLeaveService.getEmployeeLeave(employeeId, year),
    enabled: Boolean(employeeId),
  });

  const addLeave = async () => {
    if (!employeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (!leaveDate) {
      toast.error('Please select a date');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await employeeLeaveService.addLeave({
        employee_id: employeeId,
        leave_date: leaveDate,
        leave_type: leaveType,
        status,
        notes: notes || null,
      });

      if (!resp.success) {
        toast.error('Failed to add leave', { description: resp.error });
        return;
      }

      toast.success('Leave added');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['employee-leave'] });
    } finally {
      setSubmitting(false);
    }
  };

  const importCsv = async () => {
    setImporting(true);
    try {
      const result = await employeeLeaveService.importLeave(csv);
      if (result.failed > 0) {
        toast.error('Import completed with errors', { description: `${result.successful} ok, ${result.failed} failed` });
      } else {
        toast.success('Import completed', { description: `${result.successful} imported` });
      }
      await queryClient.invalidateQueries({ queryKey: ['employee-leave'] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Employee Leave (Display Only)</div>
          <div className="text-xs text-muted-foreground">
            Leave entries appear on the employee calendar, but do not affect OT workflows.
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leave-year">Year</Label>
          <Input id="leave-year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={employeesLoading}>
            <SelectTrigger>
              <SelectValue placeholder={employeesLoading ? 'Loading...' : 'Select employee'} />
            </SelectTrigger>
            <SelectContent>
              {employeeOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={leaveType} onValueChange={(v) => setLeaveType(v as EmployeeLeaveType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as EmployeeLeaveStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
      </div>

      <Button type="button" onClick={addLeave} disabled={submitting}>
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add Leave'}
      </Button>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Current Leave Entries</div>
        {!employeeId ? (
          <div className="text-sm text-muted-foreground">Select an employee to view leave.</div>
        ) : leaveLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (leaveRows as any[])?.length ? (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(leaveRows as any[]).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 text-xs text-muted-foreground">{format(new Date(r.leave_date), 'PP')}</td>
                    <td className="p-2">{r.leave_type}</td>
                    <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No leave entries found.</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">CSV Import</div>
        <div className="text-xs text-muted-foreground">
          Paste CSV with headers: employee_id, leave_date (YYYY-MM-DD), leave_type, status, notes
        </div>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-[140px] font-mono text-xs" />
        <Button type="button" variant="secondary" onClick={importCsv} disabled={importing}>
          {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <><Upload className="mr-2 h-4 w-4" />Import CSV</>}
        </Button>
      </div>
    </div>
  );
}
