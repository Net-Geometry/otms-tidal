import { format, parseISO } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { AttendanceRecord } from '@/types/attendance';

function statusVariant(status: string) {
  if (status === 'late') return 'destructive';
  if (status === 'absent') return 'secondary';
  if (status === 'present') return 'default';
  return 'outline';
}

function fmtTime(ts: string | null | undefined) {
  if (!ts) return '--:--';
  try {
    return format(new Date(ts), 'HH:mm');
  } catch {
    return '--:--';
  }
}

function fmtDateShort(date: string | null | undefined) {
  if (!date) return '--';
  try {
    return format(parseISO(date), 'dd MMM');
  } catch {
    return '--';
  }
}

function fmtDay(date: string | null | undefined) {
  if (!date) return '';
  try {
    return format(parseISO(date), 'EEE');
  } catch {
    return '';
  }
}

// Mobile card view for a single attendance record
function AttendanceCard({
  record,
  showEmployee,
  onSelect,
}: {
  record: AttendanceRecord;
  showEmployee: boolean;
  onSelect?: (record: AttendanceRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(record)}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        'active:bg-accent/50 min-h-[44px]',
        record.is_late
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-border bg-card',
      )}
    >
      {/* Top row: date + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{fmtDateShort(record.date)}</span>
          <span className="text-xs text-muted-foreground">{fmtDay(record.date)}</span>
        </div>
        <Badge variant={statusVariant(record.status) as any} className="text-xs">
          {String(record.status).replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* Employee name if needed */}
      {showEmployee && record.profiles && (
        <p className="text-xs text-muted-foreground mb-1.5 truncate">
          {record.profiles.full_name}
          {record.profiles.employee_id && ` (${record.profiles.employee_id})`}
        </p>
      )}

      {/* Bottom row: in/out times + late info */}
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {(record.attendance_sessions && record.attendance_sessions.length > 0)
          ? record.attendance_sessions
              .sort((a, b) => a.session_number - b.session_number)
              .map((s) => {
                const label = record.attendance_sessions!.length > 1 ? `S${s.session_number} ` : '';
                return (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span><span className="font-medium text-foreground">{label}In</span> {fmtTime(s.clock_in)}</span>
                      <span><span className="font-medium text-foreground">Out</span> {fmtTime(s.clock_out)}</span>
                    </div>
                    {s.session_number === 1 && record.is_late && (
                      <span className="text-red-600 dark:text-red-400 font-medium">+{record.late_minutes || 0}m late</span>
                    )}
                  </div>
                );
              })
          : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span><span className="font-medium text-foreground">In</span> {fmtTime(record.clock_in)}</span>
                <span><span className="font-medium text-foreground">Out</span> {fmtTime(record.clock_out)}</span>
              </div>
              {record.is_late && (
                <span className="text-red-600 dark:text-red-400 font-medium">+{record.late_minutes || 0}m late</span>
              )}
            </div>
          )
        }
      </div>
    </button>
  );
}

export function AttendanceTable({
  records,
  isLoading,
  showEmployee = true,
  onSelect,
}: {
  records: AttendanceRecord[];
  isLoading?: boolean;
  showEmployee?: boolean;
  onSelect?: (record: AttendanceRecord) => void;
}) {
  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!records || records.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No records found.</div>;
  }

  return (
    <>
      {/* Mobile card view (below md) */}
      <div className="md:hidden flex flex-col gap-2">
        {records.map((r) => (
          <AttendanceCard
            key={r.id}
            record={r}
            showEmployee={showEmployee}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Desktop table view (md and above) */}
      <div className="hidden md:block rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Shift</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Late (min)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow
                key={r.id}
                className={cn(
                  'cursor-pointer',
                  r.is_late && 'text-red-600 bg-red-50/50 dark:text-red-400 dark:bg-red-950/20'
                )}
                onClick={() => onSelect?.(r)}
              >
                <TableCell className="font-medium">
                  {r.date ? format(parseISO(r.date), 'dd MMM yyyy') : '--'}
                </TableCell>
                {showEmployee && (
                  <TableCell>
                    <div className="font-medium">{r.profiles?.full_name || r.employee_id}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.employee_id || '--'}</div>
                  </TableCell>
                )}
                <TableCell>{r.shift?.name || (r.shift_id ? r.shift_id : '--')}</TableCell>
                <TableCell>
                  {(r.attendance_sessions && r.attendance_sessions.length > 0)
                    ? r.attendance_sessions
                        .sort((a, b) => a.session_number - b.session_number)
                        .map((s) => (
                          <div key={s.id} className="text-xs">
                            {r.attendance_sessions!.length > 1 && <span className="text-muted-foreground">S{s.session_number} </span>}
                            {fmtTime(s.clock_in)} - {fmtTime(s.clock_out)}
                          </div>
                        ))
                    : <span>{fmtTime(r.clock_in)} - {fmtTime(r.clock_out)}</span>
                  }
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status) as any}>{String(r.status).replace(/_/g, ' ')}</Badge>
                </TableCell>
                <TableCell className="text-right">{r.is_late ? String(r.late_minutes || 0) : '--'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
