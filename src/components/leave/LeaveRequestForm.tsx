import { useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { eachDayOfInterval, format, isWeekend, parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { FileUpload } from '@/components/ot/FileUpload';
import type { LeaveBalance, LeaveType } from '@/types/leave';

const schema = z.object({
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_half_day: z.boolean().default(false),
  half_day_period: z.enum(['morning', 'afternoon']).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  attachment_urls: z.array(z.string().url('Invalid file URL')).default([]),
});

export type LeaveRequestFormValues = z.infer<typeof schema>;

function computeBusinessDays(startDate: string, endDate: string, holidayDates?: Set<string>) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start > end) return 0;

  const days = eachDayOfInterval({ start, end });
  let total = 0;
  for (const d of days) {
    const iso = format(d, 'yyyy-MM-dd');
    if (isWeekend(d)) continue;
    if (holidayDates?.has(iso)) continue;
    total += 1;
  }
  return total;
}

function projectEntitledDays(
  currentEntitled: number,
  monthlyRate: number,
  maxDays: number,
  leaveStartDate: string
): number {
  const now = new Date();
  const leaveDate = parseISO(leaveStartDate);
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const leaveMonth = leaveDate.getFullYear() * 12 + leaveDate.getMonth();
  const monthsAhead = Math.max(0, leaveMonth - currentMonth);

  if (monthsAhead === 0) return currentEntitled;

  return Math.min(currentEntitled + monthlyRate * monthsAhead, maxDays);
}

export function LeaveRequestForm({
  leaveTypes,
  balances,
  holidayDates,
  onSubmit,
  isSubmitting,
}: {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  holidayDates?: Set<string>;
  onSubmit: (values: LeaveRequestFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}) {
  const leaveTypeById = useMemo(() => {
    const map = new Map<string, LeaveType>();
    for (const lt of leaveTypes) map.set(lt.id, lt);
    return map;
  }, [leaveTypes]);

  const balanceByLeaveTypeId = useMemo(() => {
    const map = new Map<string, LeaveBalance>();
    for (const b of balances) map.set(b.leave_type_id, b);
    return map;
  }, [balances]);

  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leave_type_id: '',
      start_date: '',
      end_date: '',
      is_half_day: false,
      half_day_period: null,
      reason: null,
      attachment_urls: [],
    },
  });

  const watched = form.watch();
  const selectedType = watched.leave_type_id ? leaveTypeById.get(watched.leave_type_id) : undefined;
  const selectedBalance = watched.leave_type_id ? balanceByLeaveTypeId.get(watched.leave_type_id) : undefined;

  const totalDaysPreview = useMemo(() => {
    if (!watched.start_date || !watched.end_date) return 0;
    if (watched.is_half_day) return 0.5;
    return computeBusinessDays(watched.start_date, watched.end_date, holidayDates);
  }, [holidayDates, watched.end_date, watched.is_half_day, watched.start_date]);

  const remainingPreview = selectedBalance ? Number(selectedBalance.remaining || 0) : null;
  const isUnlimitedType = !!selectedType && ['unpaid', 'replacement', 'emergency', 'half_day'].includes(selectedType.code);

  const projectedRemaining = useMemo(() => {
    if (!selectedType || !selectedBalance || !watched.start_date) return null;
    if (selectedType.accrual_type !== 'monthly') return null;

    const projected = projectEntitledDays(
      Number(selectedBalance.entitled_days || 0),
      Number(selectedType.monthly_accrual_rate || 0),
      Number(selectedType.default_days || 0),
      watched.start_date
    );

    const currentEntitled = Number(selectedBalance.entitled_days || 0);
    if (projected <= currentEntitled) return null; // no projection needed

    return (
      projected +
      Number(selectedBalance.carried_forward || 0) +
      Number(selectedBalance.adjustment || 0) -
      Number(selectedBalance.used_days || 0)
    );
  }, [selectedType, selectedBalance, watched.start_date]);

  const handleSubmit = async (values: LeaveRequestFormValues) => {
    const lt = leaveTypeById.get(values.leave_type_id);
    if (!lt) {
      form.setError('leave_type_id', { message: 'Invalid leave type' });
      return;
    }

    if (values.is_half_day && !lt.is_half_day_allowed) {
      form.setError('is_half_day', { message: `${lt.name} does not allow half-day` });
      return;
    }

    if (values.is_half_day && values.start_date !== values.end_date) {
      form.setError('end_date', { message: 'Half-day leave must have the same start and end date' });
      return;
    }

    if (values.is_half_day && !values.half_day_period) {
      form.setError('half_day_period', { message: 'Select morning or afternoon' });
      return;
    }

    if (lt.requires_attachment && (values.attachment_urls || []).length === 0) {
      form.setError('attachment_urls', { message: `Attachment is required for ${lt.name}` });
      return;
    }

    if (!values.is_half_day) {
      if (totalDaysPreview <= 0) {
        form.setError('end_date', { message: 'Selected date range has no working days' });
        return;
      }
    }

    if (lt.max_days != null && totalDaysPreview > Number(lt.max_days)) {
      form.setError('end_date', { message: `${lt.name} is limited to ${lt.max_days} day(s)` });
      return;
    }

    if (!isUnlimitedType) {
      const effectiveRemaining = projectedRemaining ?? remainingPreview;
      if (effectiveRemaining != null && effectiveRemaining < totalDaysPreview) {
        const label = projectedRemaining != null
          ? `Insufficient projected balance (${effectiveRemaining.toFixed(1)} day(s) at ${format(parseISO(values.start_date), 'MMM yyyy')})`
          : `Insufficient balance (remaining ${effectiveRemaining.toFixed(1)} day(s))`;
        form.setError('leave_type_id', { message: label });
        return;
      }
    }

    await onSubmit(values);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Leave Request</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="leave_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave Type *</FormLabel>
                  <FormControl>
                    <Select value={field.value || undefined} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((lt) => (
                          <SelectItem key={lt.id} value={lt.id}>
                            {lt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {selectedType && (
                    <div className="text-xs text-muted-foreground">
                      {isUnlimitedType ? (
                        <span>Unlimited / not balance-restricted</span>
                      ) : projectedRemaining != null ? (
                        <span>
                          Current: {remainingPreview != null ? remainingPreview.toFixed(1) : '0.0'} day(s)
                          {' | '}
                          Projected at {format(parseISO(watched.start_date), 'MMM yyyy')}:{' '}
                          {projectedRemaining.toFixed(1)} day(s)
                        </span>
                      ) : (
                        <span>
                          Remaining: {remainingPreview != null ? remainingPreview.toFixed(1) : 'Not initialized'} day(s)
                        </span>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value} onChange={field.onChange} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value} onChange={field.onChange} disabled={isSubmitting || watched.is_half_day} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Half Day</Label>
                <div className="text-xs text-muted-foreground">Use for morning/afternoon only</div>
              </div>
              <FormField
                control={form.control}
                name="is_half_day"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting || (selectedType ? !selectedType.is_half_day_allowed : false)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watched.is_half_day && (
              <FormField
                control={form.control}
                name="half_day_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Half Day Period *</FormLabel>
                    <FormControl>
                      <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v)} disabled={isSubmitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="rounded-md bg-muted/40 border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground">Estimated Leave Days</div>
                <div className="font-semibold">{totalDaysPreview.toFixed(1)} day(s)</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Business days (weekends and holidays excluded)
              </div>
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Optional"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attachment_urls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Attachments
                    {selectedType?.requires_attachment ? ' *' : ''}
                  </FormLabel>
                  <FormControl>
                    <FileUpload
                      onUploadComplete={(urls) => field.onChange(urls)}
                      onRemove={(index) => {
                        const cur = field.value || [];
                        field.onChange(cur.filter((_, i) => i !== index));
                      }}
                      currentFiles={field.value || []}
                      maxFiles={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={!!isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
