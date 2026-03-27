import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { useEmployees } from '@/hooks/hr/useEmployees';
import { useShifts } from '@/hooks/attendance/useShifts';
import { useEmployeeShifts } from '@/hooks/attendance/useEmployeeShifts';

export function EmployeeShiftAssignment() {
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const shifts = useShifts({ includeInactive: false });

  const [employeeId, setEmployeeId] = useState<string>('');
  const [shiftId, setShiftId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [allowMultiple, setAllowMultiple] = useState(false);

  const assignments = useEmployeeShifts({ employeeId: employeeId || undefined });

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const canAssign = !!employeeId && !!shiftId && !!effectiveDate && !assignments.isAssigning;

  const rows = useMemo(() => assignments.data || [], [assignments.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Shift Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-2">Employee</div>
            <Select value={employeeId} onValueChange={(v) => {
              setEmployeeId(v);
              setShiftId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder={employeesLoading ? 'Loading employees...' : 'Select employee'} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmployee && (
              <div className="text-xs text-muted-foreground mt-1">
                {selectedEmployee.department?.name || '—'}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Shift</div>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue placeholder={shifts.isLoading ? 'Loading shifts...' : 'Select shift'} />
              </SelectTrigger>
              <SelectContent>
                {(shifts.data || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Effective Date</div>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Assign a new shift effective from the selected date.
            </div>
            <label className="flex items-center gap-1.5 text-sm shrink-0">
              <Checkbox checked={allowMultiple} onCheckedChange={(v) => setAllowMultiple(!!v)} />
              Allow Multiple Clock-in
            </label>
          </div>
          <Button
            disabled={!canAssign}
            onClick={async () => {
              await assignments.assignShift({ employeeId, shiftId, effectiveDate, allowMultipleClockin: allowMultiple });
              setShiftId('');
              setAllowMultiple(false);
            }}
          >
            {assignments.isAssigning ? 'Saving...' : 'Assign'}
          </Button>
        </div>

        {!employeeId ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Select an employee to view assignments.</div>
        ) : assignments.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading assignments...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No assignments found.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Multiple Clock-in</TableHead>
                  <TableHead>Current</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.effective_date}</TableCell>
                    <TableCell className="font-mono text-xs">{r.end_date || '—'}</TableCell>
                    <TableCell className="font-medium">{r.shift?.name || r.shift_id}</TableCell>
                    <TableCell>
                      {r.is_current ? (
                        <Checkbox
                          checked={!!r.allow_multiple_clockin}
                          onCheckedChange={(checked) =>
                            assignments.toggleMultipleClockin({ shiftAssignmentId: r.id, allow: !!checked })
                          }
                          disabled={assignments.isTogglingMultipleClockin}
                        />
                      ) : (
                        r.allow_multiple_clockin ? <Badge variant="outline" className="text-xs">Yes</Badge> : null
                      )}
                    </TableCell>
                    <TableCell>
                      {r.is_current ? <Badge>Current</Badge> : <Badge variant="secondary">Past</Badge>}
                    </TableCell>
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
