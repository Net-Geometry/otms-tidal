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
  if (!ts) return '—';
  try {
    return format(new Date(ts), 'HH:mm');
  } catch {
    return '—';
  }
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
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showEmployee && <TableHead>Employee</TableHead>}
            <TableHead>Shift</TableHead>
            <TableHead>In</TableHead>
            <TableHead>Out</TableHead>
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
                {r.date ? format(parseISO(r.date), 'dd MMM yyyy') : '—'}
              </TableCell>
              {showEmployee && (
                <TableCell>
                  <div className="font-medium">{r.profiles?.full_name || r.employee_id}</div>
                  <div className="text-xs text-muted-foreground">{r.profiles?.employee_id || '—'}</div>
                </TableCell>
              )}
              <TableCell>{r.shift?.name || (r.shift_id ? r.shift_id : '—')}</TableCell>
              <TableCell>{fmtTime(r.clock_in)}</TableCell>
              <TableCell>{fmtTime(r.clock_out)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(r.status) as any}>{String(r.status).replace(/_/g, ' ')}</Badge>
              </TableCell>
              <TableCell className="text-right">{r.is_late ? String(r.late_minutes || 0) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
