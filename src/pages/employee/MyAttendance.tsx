import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogIn, LogOut, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import { ClockInDialog } from '@/components/attendance/ClockInDialog';
import { useAttendanceRecords } from '@/hooks/attendance/useAttendanceRecords';
import { useAuth } from '@/hooks/useAuth';
import { useClockIn } from '@/hooks/attendance/useClockIn';

function currentMonthValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function monthRange(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

function formatMonthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1);
  return d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
}

function shiftMonth(yyyyMm: string, delta: number) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function useLiveTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function MyAttendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthValue());
  const clockIn = useClockIn();
  const [clockInOpen, setClockInOpen] = useState(false);
  const now = useLiveTime();
  const { start, end } = monthRange(month);

  const records = useAttendanceRecords({
    employeeId: user?.id || undefined,
    startDate: start,
    endDate: end,
  });

  const stats = useMemo(() => {
    const rows = records.data || [];
    const present = rows.filter((r) => r.status === 'present').length;
    const late = rows.filter((r) => r.status === 'late' || r.is_late).length;
    const absent = rows.filter((r) => r.status === 'absent').length;
    return { present, late, absent };
  }, [records.data]);

  // Clock button state
  const isDone = clockIn.hasClockIn && clockIn.hasClockOut;
  const isClockOut = clockIn.hasClockIn && !clockIn.hasClockOut;

  const timeStr = now.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateStr = now.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <AppLayout>
      <PageLayout
        title="My Attendance"
        description="View your attendance records and monthly summary."
        onBack={() => navigate('/dashboard')}
      >
        {/* Hero Clock Section */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col items-center py-4 md:py-6">
            {/* Live time */}
            <p className="text-sm text-muted-foreground mb-1">{dateStr}</p>
            <p className="text-3xl md:text-4xl font-mono font-bold tracking-tight tabular-nums mb-5">
              {timeStr}
            </p>

            {/* Hero button */}
            {isDone ? (
              <div
                className={cn(
                  'w-36 h-36 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center',
                  'border-4 border-muted bg-muted/30 text-muted-foreground',
                )}
              >
                <UserCheck className="h-8 w-8 mb-1" />
                <span className="text-sm font-semibold">Done</span>
              </div>
            ) : isClockOut ? (
              <button
                onClick={() => clockIn.clockOut()}
                disabled={clockIn.isClockingOut}
                className={cn(
                  'w-36 h-36 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center',
                  'border-4 border-destructive bg-destructive/5 text-destructive',
                  'hover:bg-destructive/10 active:scale-95 transition-all',
                  'min-h-[44px] cursor-pointer disabled:opacity-50',
                )}
              >
                <LogOut className="h-8 w-8 mb-1" />
                <span className="text-sm font-semibold">
                  {clockIn.isClockingOut ? 'Saving...' : 'Clock Out'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setClockInOpen(true)}
                className={cn(
                  'w-36 h-36 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center',
                  'border-4 border-green-600 bg-green-600 text-white',
                  'hover:bg-green-700 hover:border-green-700 active:scale-95 transition-all',
                  'shadow-lg shadow-green-600/25',
                  'min-h-[44px] cursor-pointer',
                )}
              >
                <LogIn className="h-8 w-8 mb-1" />
                <span className="text-sm font-semibold">Clock In</span>
              </button>
            )}

            {/* Today status line */}
            {clockIn.todayRecord && (
              <p className="text-xs text-muted-foreground mt-4">
                In: {clockIn.todayRecord.clock_in
                  ? new Date(clockIn.todayRecord.clock_in).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '--:--'}
                {clockIn.todayRecord.clock_out && (
                  <>
                    {' | Out: '}
                    {new Date(clockIn.todayRecord.clock_out).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </>
                )}
              </p>
            )}
          </div>
        </Card>

        <ClockInDialog
          open={clockInOpen}
          onOpenChange={setClockInOpen}
          onClockIn={clockIn.clockIn}
          isClockingIn={clockIn.isClockingIn}
        />

        {/* Compact Stats Row */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <Card className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden md:flex h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Present</p>
                <p className="text-xl md:text-2xl font-bold">{stats.present}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden md:flex h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Late</p>
                <p className="text-xl md:text-2xl font-bold">{stats.late}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden md:flex h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center shrink-0">
                <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Absent</p>
                <p className="text-xl md:text-2xl font-bold">{stats.absent}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Month Picker + Records */}
        <Card className="p-4 md:p-6 space-y-4">
          {/* Compact month picker */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm md:text-base font-semibold">{formatMonthLabel(month)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= currentMonthValue()}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <AttendanceTable
            records={records.data || []}
            isLoading={records.isLoading}
            showEmployee={false}
          />
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
