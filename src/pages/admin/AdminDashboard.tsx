import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Users, Clock, DollarSign, FileText, Shield } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOTHours: 0,
    totalExpenditure: 0,
    systemHealth: 100,
    activeEmployees: 0,
    pendingRequests: 0,
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
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Fetch total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch active employees
    const { count: activeEmployees } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Fetch OT requests
    const { data: otRequests } = await supabase
      .from('ot_requests')
      .select('total_hours, ot_amount, status')
      .gte('created_at', startOfMonth.toISOString());

    const totalOTHours = otRequests?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
    const totalExpenditure = otRequests?.reduce((sum, req) => sum + (req.ot_amount || 0), 0) || 0;
    const pendingRequests = otRequests?.filter(req =>
      req.status === 'pending_verification' || req.status === 'supervisor_verified'
    ).length || 0;

    setStats({
      totalUsers: totalUsers || 0,
      totalOTHours,
      totalExpenditure,
      systemHealth: 100,
      activeEmployees: activeEmployees || 0,
      pendingRequests,
    });
    setLoading(false);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Admin Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Complete system overview and administration.` : 'Welcome back! Complete system overview and administration.'}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/hr/settings')} className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Settings
            </Button>
            <Button onClick={() => navigate('/hr/employees')} variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
            <Button onClick={() => navigate('/hr/ot-reports')} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              View All Data
            </Button>
          </div>
        }
      >

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <DashboardCard
                title="Total Users"
                value={stats.totalUsers}
                subtitle={`${stats.activeEmployees} active`}
                icon={Users}
              />
              <DashboardCard
                title="Pending Requests"
                value={stats.pendingRequests}
                subtitle="Awaiting action"
                icon={FileText}
              />
              <DashboardCard
                title="Total OT Hours"
                value={stats.totalOTHours.toFixed(1)}
                subtitle="This month"
                icon={Clock}
              />
              <DashboardCard
                title="Total Expenditure"
                value={formatCurrency(stats.totalExpenditure)}
                subtitle="This month"
                icon={DollarSign}
              />
              <DashboardCard
                title="System Health"
                value={`${stats.systemHealth}%`}
                subtitle="All systems operational"
                icon={Shield}
              />
            </>
          )}
        </div>
      </PageLayout>
    </AppLayout>
  );
}
