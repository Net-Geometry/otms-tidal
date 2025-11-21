import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { DashboardCard } from '@/components/DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, AlertCircle, Plus, History } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export default function Dashboard() {
  const { user, roles, hasRole, isLoadingRoles, getDefaultRoute } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalHours: 0,
    pending: 0,
    approved: 0
  });
  const [loading, setLoading] = useState(true);

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
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const isEmployee = hasRole('employee');
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const query = supabase
        .from('ot_requests')
        .select('total_hours, status');

      if (isEmployee) {
        query.eq('employee_id', user.id);
      }

      query.gte('ot_date', startOfMonth.toISOString());

      const { data, error } = await query;

      if (error) throw error;

      const totalHours = data?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
      const pending = data?.filter(req => req.status === 'pending_verification').length || 0;
      const approved = data?.filter(req => req.status === 'hr_certified' || req.status === 'bod_approved').length || 0;

      setStats({ totalHours, pending, approved });
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
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your OT status.
          </p>
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              icon={Clock}
              title="Total OT Hours"
              value={stats.totalHours.toFixed(2)}
              subtitle="Current month"
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
              subtitle="This month"
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}