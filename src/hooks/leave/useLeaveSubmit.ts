import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eachDayOfInterval, format, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeaveType } from '@/types/leave';

/**
 * Send push notification for leave status change (non-blocking).
 * In-app notification is handled by DB trigger.
 */
async function sendLeavePushNotification(requestId: string, newStatus: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.functions.invoke('send-leave-push-notification', {
    body: { requestId, newStatus },
  });
}

export interface LeaveSubmitData {
  leave_type_id: string;
  start_date: string; // yyyy-mm-dd
  end_date: string; // yyyy-mm-dd
  is_half_day?: boolean;
  half_day_period?: 'morning' | 'afternoon' | null;
  reason?: string | null;
  attachment_urls?: string[];
}

function toDate(d: string) {
  return parseISO(d);
}

function uniqueUpperSuffix(len = 4) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

async function fetchLeaveType(leaveTypeId: string): Promise<LeaveType> {
  const db = supabase as any;
  const { data, error } = await db.from('leave_types').select('*').eq('id', leaveTypeId).single();
  if (error) throw error;
  return data as LeaveType;
}

async function getHolidayDateSet(startDate: string, endDate: string, userState?: string | null) {
  const db = supabase as any;
  const { data, error } = await db
    .from('employee_calendar_events')
    .select('holiday_date, state_code, event_source, is_personal_leave')
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate)
    .order('holiday_date', { ascending: true });

  if (error) throw error;

  const set = new Set<string>();
  for (const row of (data || []) as any[]) {
    const source = row.event_source as string | null;
    const isLeave = source === 'leave' || row.is_personal_leave;
    if (isLeave) continue;

    const stateCode = row.state_code as string | null;
    if (!userState) {
      if (!stateCode || stateCode === 'ALL') set.add(row.holiday_date);
      continue;
    }

    if (!stateCode || stateCode === 'ALL' || stateCode === userState) {
      set.add(row.holiday_date);
    }
  }

  return set;
}

function calculateBusinessDays(startDate: string, endDate: string, holidayDates: Set<string>) {
  const days = eachDayOfInterval({ start: toDate(startDate), end: toDate(endDate) });
  let total = 0;
  for (const day of days) {
    const iso = format(day, 'yyyy-MM-dd');
    if (isWeekend(day)) continue;
    if (holidayDates.has(iso)) continue;
    total += 1;
  }
  return total;
}

export function useLeaveSubmit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LeaveSubmitData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Not authenticated');
      const user = authData.user;

      if (!input.start_date || !input.end_date) {
        throw new Error('Start date and end date are required');
      }

      const start = toDate(input.start_date);
      const end = toDate(input.end_date);
      if (start > end) {
        throw new Error('End date must be on or after start date');
      }

      const leaveType = await fetchLeaveType(input.leave_type_id);

      const isHalfDay = !!input.is_half_day;
      const halfDayPeriod = input.half_day_period ?? null;
      const attachments = input.attachment_urls || [];
      const year = start.getFullYear();

      if (isHalfDay && !leaveType.is_half_day_allowed) {
        throw new Error(`${leaveType.name} does not allow half-day requests`);
      }

      if (isHalfDay && input.start_date !== input.end_date) {
        throw new Error('Half-day leave must have the same start and end date');
      }

      if (isHalfDay && !halfDayPeriod) {
        throw new Error('Please select morning or afternoon for half-day leave');
      }

      if (leaveType.requires_attachment && attachments.length === 0) {
        throw new Error(`Attachment is required for ${leaveType.name}`);
      }

      // Fetch profile for supervisor + state + salary
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('supervisor_id, state, basic_salary')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Replacement leave salary check (Malaysian Employment Act: RM4,000 minimum)
      if (leaveType.code === 'replacement') {
        const salary = Number((profile as any)?.basic_salary || 0);
        if (salary < 4000) {
          throw new Error('Replacement leave is only available for employees with salary RM4,000 and above');
        }
      }

      // Days calculation (business days; half-day = 0.5)
      let totalDays = 0.5;
      if (!isHalfDay) {
        const holidayDates = await getHolidayDateSet(input.start_date, input.end_date, profile?.state);
        totalDays = calculateBusinessDays(input.start_date, input.end_date, holidayDates);

        if (totalDays <= 0) {
          throw new Error('Selected date range has no working days (weekends/holidays only)');
        }
      }

      if (leaveType.max_days != null && totalDays > Number(leaveType.max_days)) {
        throw new Error(`${leaveType.name} is limited to ${leaveType.max_days} day(s)`);
      }

      // Overlap check (exclude rejected/cancelled)
      const db = supabase as any;
      const { data: overlapping, error: overlapError } = await db
        .from('leave_requests')
        .select('id, ticket_number, start_date, end_date, status')
        .eq('employee_id', user.id)
        .lte('start_date', input.end_date)
        .gte('end_date', input.start_date)
        .not('status', 'in', '(rejected,cancelled)');

      if (overlapError) throw overlapError;
      if (overlapping && overlapping.length > 0) {
        throw new Error('This leave request overlaps with an existing leave request');
      }

      // Balance validation
      const { data: balanceRow, error: balanceError } = await db
        .from('leave_balances')
        .select('entitled_days, used_days, carried_forward, adjustment')
        .eq('employee_id', user.id)
        .eq('leave_type_id', input.leave_type_id)
        .eq('year', year)
        .maybeSingle();

      if (balanceError) throw balanceError;

      // Block UPL if Annual Leave still has remaining balance
      if (leaveType.code === 'unpaid') {
        const { data: alType } = await db
          .from('leave_types')
          .select('id')
          .eq('code', 'annual')
          .single();

        if (alType) {
          const { data: alBalance } = await db
            .from('leave_balances')
            .select('entitled_days, used_days, carried_forward, adjustment')
            .eq('employee_id', user.id)
            .eq('leave_type_id', alType.id)
            .eq('year', year)
            .maybeSingle();

          if (alBalance) {
            const alRemaining =
              Number(alBalance.entitled_days || 0) +
              Number(alBalance.carried_forward || 0) +
              Number(alBalance.adjustment || 0) -
              Number(alBalance.used_days || 0);

            if (alRemaining > 0) {
              throw new Error(
                `Cannot apply for Unpaid Leave while you still have ${alRemaining.toFixed(1)} day(s) of Annual Leave remaining. Please use your Annual Leave first.`
              );
            }
          }
        }
      }

      const isUnlimitedType = ['unpaid', 'replacement', 'emergency', 'half_day'].includes(leaveType.code);
      if (!isUnlimitedType) {
        if (!balanceRow) {
          throw new Error(`Leave balance for ${leaveType.name} is not initialized for ${year}. Please contact HR.`);
        }

        const remaining =
          Number(balanceRow.entitled_days || 0) +
          Number(balanceRow.carried_forward || 0) +
          Number(balanceRow.adjustment || 0) -
          Number(balanceRow.used_days || 0);

        if (remaining < totalDays) {
          throw new Error(`Insufficient ${leaveType.name} balance. Remaining: ${remaining.toFixed(1)} day(s)`);
        }
      }

      // Initial status: pending_supervisor or pending_hr (no supervisor / supervisor is management)
      let supervisorId: string | null = profile?.supervisor_id || null;
      let initialStatus: any = 'pending_supervisor';

      if (!supervisorId) {
        initialStatus = 'pending_hr';
      } else {
        const { data: svRoles, error: svRoleError } = await db
          .from('user_roles')
          .select('role')
          .eq('user_id', supervisorId)
          .eq('role', 'management')
          .limit(1);
        if (svRoleError) throw svRoleError;

        if (svRoles && svRoles.length > 0) {
          // Supervisor is SGM/management: skip supervisor step
          initialStatus = 'pending_hr';
        }
      }

      // Ticket number: LV-YYYYMMDD-RANDOM
      const dateStr = format(start, 'yyyyMMdd');
      const ticketNumber = `LV-${dateStr}-${uniqueUpperSuffix(4)}`;

      const { data: created, error: insertError } = await db
        .from('leave_requests')
        .insert([
          {
            ticket_number: ticketNumber,
            employee_id: user.id,
            leave_type_id: input.leave_type_id,
            start_date: input.start_date,
            end_date: input.end_date,
            is_half_day: isHalfDay,
            half_day_period: isHalfDay ? halfDayPeriod : null,
            total_days: totalDays,
            reason: input.reason || null,
            attachment_urls: attachments,
            supervisor_id: supervisorId,
            status: initialStatus,
          },
        ])
        .select('*')
        .single();

      if (insertError) throw insertError;

      // Push notification (non-blocking, failure doesn't affect submission)
      sendLeavePushNotification(created.id, initialStatus).catch((e) => {
        console.warn('Failed to send leave push notification:', e);
      });

      return created as any;
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-calendar-view'] });
      toast({
        title: 'Success',
        description: `Leave request ${created.ticket_number} submitted successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
