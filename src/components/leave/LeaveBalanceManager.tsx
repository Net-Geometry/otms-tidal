import { useMemo, useState } from 'react';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useLeaveTypes } from '@/hooks/leave/useLeaveTypes';
import { useLeaveBalanceAdmin } from '@/hooks/leave/useLeaveBalanceAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LeaveBalance, LeaveType } from '@/types/leave';

export function LeaveBalanceManager() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [employeeId, setEmployeeId] = useState<string>('');

  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: leaveTypes = [], isLoading: leaveTypesLoading } = useLeaveTypes();
  const admin = useLeaveBalanceAdmin({ employeeId: employeeId || undefined, year });

  const rows = useMemo(() => {
    const balances = admin.balancesQuery.data || [];
    const byType = new Map<string, LeaveBalance>();
    for (const b of balances) byType.set(b.leave_type_id, b);

    return leaveTypes.map((lt) => {
      const b = byType.get(lt.id);
      return {
        leaveType: lt,
        balance: b || null,
      };
    });
  }, [admin.balancesQuery.data, leaveTypes]);

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const isReady = !!employeeId && !admin.balancesQuery.isLoading && !leaveTypesLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Balances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm font-medium mb-2">Year</div>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))}
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-2">Employee</div>
            <Select value={employeeId} onValueChange={setEmployeeId}>
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await admin.bulkInitializeYear({ year });
            }}
            disabled={admin.isInitializing}
          >
            {admin.isInitializing ? 'Initializing...' : `Bulk Initialize ${year}`}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await admin.processCarryForward({ fromYear: year - 1, toYear: year });
            }}
            disabled={admin.isProcessingCarryForward}
          >
            {admin.isProcessingCarryForward ? 'Processing...' : `Carry Forward (${year - 1} → ${year})`}
          </Button>
        </div>

        {!employeeId ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Select an employee to view balances.</div>
        ) : admin.balancesQuery.isLoading || leaveTypesLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading balances...</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-right">Entitled</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Carried</TableHead>
                  <TableHead className="text-right">Adjustment</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ leaveType, balance }) => {
                  const entitled = Number(balance?.entitled_days ?? leaveType.default_days ?? 0);
                  const used = Number(balance?.used_days ?? 0);
                  const carried = Number(balance?.carried_forward ?? 0);
                  const adjustment = Number(balance?.adjustment ?? 0);
                  const remaining = entitled + carried + adjustment - used;

                  return (
                    <TableRow key={leaveType.id}>
                      <TableCell className="font-medium">{leaveType.name}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={String(entitled)}
                          onBlur={async (e) => {
                            if (!employeeId) return;
                            const v = Number(e.target.value || 0);
                            await admin.upsertBalance({ employeeId, leaveTypeId: leaveType.id, year, entitled_days: v });
                          }}
                          className="h-9 text-right"
                          disabled={!isReady || admin.isSaving}
                        />
                      </TableCell>
                      <TableCell className="text-right">{used.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={String(carried)}
                          onBlur={async (e) => {
                            if (!employeeId) return;
                            const v = Number(e.target.value || 0);
                            await admin.upsertBalance({ employeeId, leaveTypeId: leaveType.id, year, carried_forward: v });
                          }}
                          className="h-9 text-right"
                          disabled={!isReady || admin.isSaving}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={String(adjustment)}
                          onBlur={async (e) => {
                            if (!employeeId) return;
                            const v = Number(e.target.value || 0);
                            await admin.upsertBalance({ employeeId, leaveTypeId: leaveType.id, year, adjustment: v });
                          }}
                          className="h-9 text-right"
                          disabled={!isReady || admin.isSaving}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">{remaining.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await admin.upsertBalance({
                              employeeId,
                              leaveTypeId: leaveType.id,
                              year,
                              entitled_days: entitled,
                              carried_forward: carried,
                              adjustment,
                            });
                          }}
                          disabled={!isReady || admin.isSaving}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
