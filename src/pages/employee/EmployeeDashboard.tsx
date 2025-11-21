import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { EnhancedEmployeeDashboardCard } from '@/components/employee/EnhancedEmployeeDashboardCard';
import { EmployeeOTWeeklyChart } from '@/components/employee/EmployeeOTWeeklyChart';
import { EmployeeOTStatusChart } from '@/components/employee/EmployeeOTStatusChart';
import { QuickTips } from '@/components/employee/QuickTips';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, RefreshCcw, CheckCircle2, Plus, History } from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalHours: 0,
    pendingRequests: 0,
    approvedRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchProfile();
    }
  }, [user]);

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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ot_requests')
      .select('total_hours, status')
      .eq('employee_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    if (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
      return;
    }

    const totalHours = data?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const pendingRequests = data?.filter(req =>
      req.status === 'pending_verification'
    ).length || 0;
    const approvedRequests = data?.filter(req =>
      req.status === 'hr_certified' || req.status === 'bod_approved' || req.status === 'supervisor_verified'
    ).length || 0;

    setStats({ totalHours, pendingRequests, approvedRequests });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Employee Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Here's your OT overview for this month.` : "Welcome back! Here's your OT overview for this month."}
      >


        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </>
          ) : (
            <>
              <EnhancedEmployeeDashboardCard
                title="Total OT Hours"
                value={stats.totalHours.toFixed(1)}
                subtitle="This month"
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
                subtitle="This month"
                icon={CheckCircle2}
                variant="green"
              />
            </>
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-bold mb-4">Monthly OT Overview</h2>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <EmployeeOTWeeklyChart />
            <EmployeeOTStatusChart />
          </div>
        </div>

        <QuickTips />

      </PageLayout>
    </AppLayout >
  );
}
