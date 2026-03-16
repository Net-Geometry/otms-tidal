import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useDepartments } from '@/hooks/hr/useDepartments';
import { useAttendanceSummary } from '@/hooks/attendance/useAttendanceSummary';
import { exportToCSV } from '@/lib/exportUtils';

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

  const deptLabel = useMemo(() => {
    if (departmentId === 'all') return 'All';
    return departments.data?.find((d) => d.id === departmentId)?.name ?? 'All';
  }, [departmentId, departments.data]);

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const monthLabel = new Date(year, monthNum - 1).toLocaleString('en-MY', { month: 'long', year: 'numeric' });
    exportToCSV(
      rows,
      `attendance-report-${month}`,
      [
        { key: 'employee_code', label: 'Employee ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department_name', label: 'Department' },
        { key: 'present_count', label: 'Present' },
        { key: 'late_count', label: 'Late' },
        { key: 'absent_count', label: 'Absent' },
        { key: 'late_minutes_total', label: 'Late Minutes' },
      ],
      {
        reportName: 'Attendance Monthly Summary',
        period: `${monthLabel} — Department: ${deptLabel}`,
        generatedDate: new Date().toLocaleDateString('en-MY'),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monthly Summary</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
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
