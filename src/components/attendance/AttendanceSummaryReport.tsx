import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useDepartments } from '@/hooks/hr/useDepartments';
import { useAttendanceSummary } from '@/hooks/attendance/useAttendanceSummary';

function currentMonthValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function AttendanceSummaryReport() {
  const [month, setMonth] = useState<string>(currentMonthValue());
  const [departmentId, setDepartmentId] = useState<string>('all');

  const departments = useDepartments();

  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const summary = useAttendanceSummary({
    year,
    month: monthNum,
    departmentId: departmentId === 'all' ? undefined : departmentId,
  });

  const rows = useMemo(() => summary.data || [], [summary.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm font-medium mb-2">Month</div>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-2">Department</div>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder={departments.isLoading ? 'Loading departments...' : 'Select department'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(departments.data || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {summary.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading summary...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No data for this month.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Late Minutes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employee_id}>
                    <TableCell>
                      <div className="font-medium">{r.employee_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employee_code}</div>
                    </TableCell>
                    <TableCell>{r.department_name}</TableCell>
                    <TableCell className="text-right">{r.present_count}</TableCell>
                    <TableCell className="text-right">{r.late_count}</TableCell>
                    <TableCell className="text-right">{r.absent_count}</TableCell>
                    <TableCell className="text-right">{r.late_minutes_total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
