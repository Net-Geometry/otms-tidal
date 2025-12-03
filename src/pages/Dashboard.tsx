import { useEffect, useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, AlertCircle, Plus, History } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function Dashboard() {
  const { user, roles, hasRole, isLoadingRoles, getDefaultRoute } = useAuth();
  const navigate = useNavigate();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    totalHours: 0,
    pending: 0,
    approved: 0,
    hasData: false,
  });
  const [loading, setLoading] = useState(true);

  const filterDate = useMemo(() => {
    return new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
  }, [selectedMonth, selectedYear]);

  // Wait for roles to load
  if (isLoadingRoles) {
    return <LoadingSkeleton />;
  }

  // If user has a role-specific dashboard, redirect them there
  if (user && roles.length > 0) {
    const defaultRoute = getDefaultRoute();
    // Only redirect if they should go to a specific role dashboard
    if (defaultRoute !== '/dashboard') {
      return <Navigate to={defaultRoute} replace />;
    }
  }

  useEffect(() => {
    fetchStats();
  }, [user, filterDate]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const isEmployee = hasRole('employee');
      const monthStart = startOfMonth(filterDate);
      const monthEnd = endOfMonth(filterDate);

      const query = supabase
        .from('ot_requests')
        .select('total_hours, status');

      if (isEmployee) {
        query.eq('employee_id', user.id);
      }

      query.gte('ot_date', monthStart.toISOString().split('T')[0]);
      query.lte('ot_date', monthEnd.toISOString().split('T')[0]);

      const { data, error } = await query;

      if (error) throw error;

      const hasData = data && data.length > 0;
      const totalHours = data?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
      const pending = data?.filter(req => req.status === 'pending_verification').length || 0;
      const approved = data?.filter(req => req.status === 'hr_certified' || req.status === 'bod_approved').length || 0;

      setStats({ totalHours, pending, approved, hasData });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const isEmployee = hasRole('employee');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's an overview of your OT status.
            </p>
          </div>
          <MonthYearFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />
        </div>

        {isEmployee && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Submit new overtime or view your request history</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={() => navigate('/ot/submit')}>
                <Plus className="h-4 w-4 mr-2" />
                Submit OT Request
              </Button>
              <Button variant="outline" onClick={() => navigate('/ot/history')}>
                <History className="h-4 w-4 mr-2" />
                View OT History
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : stats.hasData ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              icon={Clock}
              title="Total OT Hours"
              value={stats.totalHours.toFixed(2)}
              subtitle={format(filterDate, 'MMMM yyyy')}
            />
            <DashboardCard
              icon={AlertCircle}
              title="Pending Requests"
              value={stats.pending}
              subtitle="Awaiting verification"
            />
            <DashboardCard
              icon={CheckCircle}
              title="Approved Requests"
              value={stats.approved}
              subtitle={format(filterDate, 'MMMM yyyy')}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="opacity-50 pointer-events-none">
              <DashboardCard
                icon={Clock}
                title="Total OT Hours"
                value="-"
                subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
              />
            </div>
            <div className="opacity-50 pointer-events-none">
              <DashboardCard
                icon={AlertCircle}
                title="Pending Requests"
                value="-"
                subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
              />
            </div>
            <div className="opacity-50 pointer-events-none">
              <DashboardCard
                icon={CheckCircle}
                title="Approved Requests"
                value="-"
                subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}