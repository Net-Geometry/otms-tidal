import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { ContentLoadingSkeleton } from '@/components/ContentLoadingSkeleton';
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards';
import { LeaveRequestForm, type LeaveRequestFormValues } from '@/components/leave/LeaveRequestForm';
import { LeaveRequestTable } from '@/components/leave/LeaveRequestTable';
import { useAuth } from '@/hooks/useAuth';
import { useHolidayCalendarView } from '@/hooks/useHolidayCalendarView';
import { useLeaveTypes } from '@/hooks/leave/useLeaveTypes';
import { useLeaveBalances } from '@/hooks/leave/useLeaveBalances';
import { useLeaveSubmit } from '@/hooks/leave/useLeaveSubmit';
import { useLeaveRequests } from '@/hooks/leave/useLeaveRequests';

export default function LeaveRequest() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const year = new Date().getFullYear();

  const { data: leaveTypes = [], isLoading: typesLoading } = useLeaveTypes();
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalances({ year });
  const submit = useLeaveSubmit();
  const history = useLeaveRequests({ filter: 'all' });

  const { data: calendarItems = [] } = useHolidayCalendarView(profile?.state);
  const holidayDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of calendarItems || []) {
      const source = item.event_source;
      const isLeave = source === 'leave' || item.is_personal_leave;
      if (isLeave) continue;
      set.add(item.holiday_date);
    }
    return set;
  }, [calendarItems]);

  const isLoading = typesLoading || balancesLoading;
  if (isLoading) {
    return (
      <AppLayout>
        <ContentLoadingSkeleton />
      </AppLayout>
    );
  }

  const handleSubmit = async (values: LeaveRequestFormValues) => {
    await submit.mutateAsync({
      leave_type_id: values.leave_type_id,
      start_date: values.start_date,
      end_date: values.end_date,
      is_half_day: values.is_half_day,
      half_day_period: values.half_day_period,
      reason: values.reason,
      attachment_urls: values.attachment_urls,
    });
    navigate('/leave/history');
  };

  return (
    <AppLayout>
      <PageLayout
        title="Leave Request"
        description="Submit a new leave request and review your recent leave history."
        onBack={() => navigate('/dashboard')}
      >
        <div className="space-y-6">
          <LeaveBalanceCards balances={balances} />

          <LeaveRequestForm
            leaveTypes={leaveTypes}
            balances={balances}
            holidayDates={holidayDates}
            onSubmit={handleSubmit}
            isSubmitting={submit.isPending}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">Recent Requests</div>
                <div className="text-sm text-muted-foreground">Your latest leave submissions</div>
              </div>
            </div>
            <LeaveRequestTable
              requests={(history.data || []).slice(0, 10)}
              isLoading={history.isLoading}
              role="employee"
              enableBatch={false}
              onCancel={async (requestId, reason) => {
                await history.cancelLeaveRequest({ requestId, reason });
              }}
              isCancelling={history.isCancelling}
            />
          </div>
        </div>
      </PageLayout>
    </AppLayout>
  );
}
