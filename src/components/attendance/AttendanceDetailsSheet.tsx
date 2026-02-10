import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { cn } from '@/lib/utils';
import type { AttendanceRecord, AttendanceRecordStatus } from '@/types/attendance';
import { useShifts } from '@/hooks/attendance/useShifts';

const schema = z.object({
  status: z.enum(['present', 'late', 'absent', 'half_day', 'on_leave', 'holiday', 'rest_day']),
  shift_id: z.string().nullable().optional(),
  clock_in_time: z.string().optional(),
  clock_out_time: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function statusVariant(status: AttendanceRecordStatus) {
  if (status === 'late') return 'destructive';
  if (status === 'absent') return 'secondary';
  if (status === 'present') return 'default';
  return 'outline';
}

function extractHhMm(ts: string | null) {
  if (!ts) return '';
  try {
    return format(new Date(ts), 'HH:mm');
  } catch {
    return '';
  }
}

function combineMyt(dateStr: string, hhmm: string) {
  const t = (hhmm || '').trim();
  if (!t) return null;
  const m = t.match(/^([0-9]{1,2}):([0-9]{2})$/);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = m[2];
  return `${dateStr}T${hh}:${mm}:00+08:00`;
}

export function AttendanceDetailsSheet({
  record,
  open,
  onOpenChange,
  editable,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editable?: boolean;
  onSave?: (id: string, values: Partial<AttendanceRecord>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  isSaving?: boolean;
  isDeleting?: boolean;
}) {
  const shifts = useShifts({ includeInactive: true });

  const defaults = useMemo<FormValues>(() => {
    if (!record) {
      return {
        status: 'present',
        shift_id: null,
        clock_in_time: '',
        clock_out_time: '',
        notes: '',
      };
    }
    return {
      status: record.status,
      shift_id: record.shift_id || null,
      clock_in_time: extractHhMm(record.clock_in),
      clock_out_time: extractHhMm(record.clock_out),
      notes: record.notes || '',
    };
  }, [record]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  if (!record) return null;

  const employeeName = record.profiles?.full_name || record.employee_id;
  const employeeCode = record.profiles?.employee_id || '—';
  const dept = record.profiles?.departments?.name;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Attendance Record</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Employee</div>
              <div className="font-semibold">{employeeName}</div>
              <div className="text-xs text-muted-foreground">{employeeCode}{dept ? ` • ${dept}` : ''}</div>
            </div>
            <Badge variant={statusVariant(record.status) as any}>
              {String(record.status).replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">Date</div>
              <div className="font-semibold">{record.date ? format(parseISO(record.date), 'dd MMM yyyy') : '—'}</div>
            </div>
            <div className={cn('rounded-md border p-3', record.is_late && 'border-red-200 dark:border-red-900')}>
              <div className="text-muted-foreground">Lateness</div>
              <div className="font-semibold">{record.is_late ? `${record.late_minutes || 0} min` : 'On time'}</div>
            </div>
          </div>

          <Separator />

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                if (!onSave) return;
                const payload: Partial<AttendanceRecord> = {
                  status: values.status as any,
                  shift_id: values.shift_id || null,
                  notes: (values.notes || '').trim() || null,
                };
                const cin = combineMyt(record.date, values.clock_in_time || '');
                const cout = combineMyt(record.date, values.clock_out_time || '');
                payload.clock_in = cin;
                payload.clock_out = cout;
                await onSave(record.id, payload);
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="half_day">Half Day</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="holiday">Holiday</SelectItem>
                            <SelectItem value="rest_day">Rest Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shift_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                          disabled={!editable || shifts.isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={shifts.isLoading ? 'Loading shifts...' : 'Select shift'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {(shifts.data || []).map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({String(s.start_time).slice(0, 5)}-{String(s.end_time).slice(0, 5)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Clock In</Label>
                  <Input
                    type="time"
                    step={60}
                    disabled={!editable}
                    {...form.register('clock_in_time')}
                  />
                </div>
                <div>
                  <Label>Clock Out</Label>
                  <Input
                    type="time"
                    step={60}
                    disabled={!editable}
                    {...form.register('clock_out_time')}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={!editable} placeholder="Optional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editable && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div>
                    {onDelete && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={async () => {
                          await onDelete(record.id);
                          onOpenChange(false);
                        }}
                        disabled={!!isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Close
                    </Button>
                    <Button type="submit" disabled={!!isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
              {!editable && (
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
