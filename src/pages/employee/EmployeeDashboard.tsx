import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { EnhancedEmployeeDashboardCard } from '@/components/employee/EnhancedEmployeeDashboardCard';
import { EmployeeOTWeeklyChart } from '@/components/employee/EmployeeOTWeeklyChart';
import { EmployeeOTStatusChart } from '@/components/employee/EmployeeOTStatusChart';
import { QuickTips } from '@/components/employee/QuickTips';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, RefreshCcw, CheckCircle2, Plus, History } from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    totalHours: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    hasData: false,
  });
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');

  const filterDate = useMemo(() => {
    return new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchProfile();
    }
  }, [user, filterDate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (data) setFullName(data.full_name);
  };

  const fetchStats = async () => {
    if (!user) return;

    const monthStart = startOfMonth(filterDate);
    const monthEnd = endOfMonth(filterDate);

    const { data, error } = await supabase
      .from('ot_requests')
      .select('total_hours, status')
      .eq('employee_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    if (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
      return;
    }

    const hasData = data && data.length > 0;
    const totalHours = data?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const pendingRequests = data?.filter(req =>
      req.status === 'pending_verification'
    ).length || 0;
    const approvedRequests = data?.filter(req =>
      req.status === 'hr_certified' || req.status === 'bod_approved' || req.status === 'supervisor_verified'
    ).length || 0;

    setStats({ totalHours, pendingRequests, approvedRequests, hasData });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Employee Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Here's your OT overview.` : "Welcome back! Here's your OT overview."}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Filter by Month</h3>
          <MonthYearFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </>
          ) : stats.hasData ? (
            <>
              <EnhancedEmployeeDashboardCard
                title="Total OT Hours"
                value={stats.totalHours.toFixed(1)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={Clock}
                variant="purple"
              />
              <EnhancedEmployeeDashboardCard
                title="Pending Requests"
                value={stats.pendingRequests}
                subtitle="Awaiting approval"
                icon={RefreshCcw}
                variant="yellow"
              />
              <EnhancedEmployeeDashboardCard
                title="Approved Requests"
                value={stats.approvedRequests}
                subtitle={format(filterDate, 'MMMM yyyy')}
                icon={CheckCircle2}
                variant="green"
              />
            </>
          ) : (
            <>
              <div className="opacity-50 pointer-events-none">
                <EnhancedEmployeeDashboardCard
                  title="Total OT Hours"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={Clock}
                  variant="purple"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedEmployeeDashboardCard
                  title="Pending Requests"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={RefreshCcw}
                  variant="yellow"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedEmployeeDashboardCard
                  title="Approved Requests"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  icon={CheckCircle2}
                  variant="green"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-bold mb-4">Monthly OT Overview</h2>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <EmployeeOTWeeklyChart filterDate={filterDate} />
            <EmployeeOTStatusChart filterDate={filterDate} />
          </div>
        </div>

        <QuickTips />

      </PageLayout>
    </AppLayout >
  );
}
