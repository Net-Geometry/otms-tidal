import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, UserCheck, UserX } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DashboardCard } from '@/components/DashboardCard';

import { AttendanceTable } from '@/components/attendance/AttendanceTable';
import { useAttendanceRecords } from '@/hooks/attendance/useAttendanceRecords';
import { useAuth } from '@/hooks/useAuth';

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

export default function MyAttendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthValue());
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

  return (
    <AppLayout>
      <PageLayout
        title="My Attendance"
        description="View your attendance records and monthly summary."
        onBack={() => navigate('/dashboard')}
      >
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-sm font-medium mb-2">Month</div>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard title="Present" value={String(stats.present)} subtitle="This month" icon={UserCheck} />
            <DashboardCard title="Late" value={String(stats.late)} subtitle="This month" icon={Clock} />
            <DashboardCard title="Absent" value={String(stats.absent)} subtitle="This month" icon={UserX} />
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
