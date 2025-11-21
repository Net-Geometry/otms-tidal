import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { EnhancedDashboardCard } from '@/components/hr/EnhancedDashboardCard';
import { OTTrendChart } from '@/components/hr/charts/OTTrendChart';
import { OTCostChart } from '@/components/management/charts/OTCostChart';
import { QuickInsights } from '@/components/management/QuickInsights';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';

export default function ManagementDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOTHours: 0,
    totalExpenditure: 0,
    complianceRate: 0,
    monthlyTrend: '+0%',
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) setFullName(data.full_name);
    } catch (err) {
      console.error('Profile fetch exception:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const startOfLastMonth = new Date(startOfMonth);
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

      // Current month data
      const { data: currentMonthData, error: currentError } = await supabase
        .from('ot_requests')
        .select('total_hours, ot_amount, status')
        .gte('created_at', startOfMonth.toISOString());

      if (currentError) {
        console.error('Error fetching current month data:', currentError);
        setLoading(false);
        return;
      }

      // Last month data for trend
      const { data: lastMonthData, error: lastError } = await supabase
        .from('ot_requests')
        .select('total_hours')
        .gte('created_at', startOfLastMonth.toISOString())
        .lt('created_at', startOfMonth.toISOString());

      if (lastError) {
        console.error('Error fetching last month data:', lastError);
        setLoading(false);
        return;
      }

      const totalOTHours = currentMonthData?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 0;
      const totalExpenditure = currentMonthData?.reduce((sum, req) => sum + (req.ot_amount || 0), 0) || 0;

      const approvedCount = currentMonthData?.filter(req =>
        req.status === 'hr_certified' || req.status === 'management_approved'
      ).length || 0;
      const totalCount = currentMonthData?.length || 1;
      const complianceRate = Math.round((approvedCount / totalCount) * 100);

      const lastMonthHours = lastMonthData?.reduce((sum, req) => sum + (req.total_hours || 0), 0) || 1;
      const trend = lastMonthHours > 0 ? ((totalOTHours - lastMonthHours) / lastMonthHours) * 100 : 0;
      const monthlyTrend = `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`;

      setStats({
        totalOTHours,
        totalExpenditure,
        complianceRate,
        monthlyTrend,
      });
      setLoading(false);
    } catch (err) {
      console.error('Stats fetch exception:', err);
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Management Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {fullName ? `Welcome back, ${fullName}!` : 'Welcome back!'} Here's your executive overview.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <EnhancedDashboardCard
                icon={Clock}
                title="Organization OT Hours"
                value={stats.totalOTHours.toFixed(1)}
                subtitle="This month"
                variant="info"
              />
              <EnhancedDashboardCard
                icon={DollarSign}
                title="Total Expenditure"
                value={formatCurrency(stats.totalExpenditure)}
                subtitle="OT payments this month"
                variant="primary"
              />
              <EnhancedDashboardCard
                icon={CheckCircle}
                title="Compliance Rate"
                value={`${stats.complianceRate}%`}
                subtitle="Approved requests"
                variant="success"
              />
              <EnhancedDashboardCard
                icon={TrendingUp}
                title="Monthly Trend"
                value={stats.monthlyTrend}
                subtitle="vs last month"
                variant="warning"
              />
            </>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-1">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Visual summary of organizational overtime and expenditure performance
          </p>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <OTTrendChart />
            <OTCostChart />
          </div>
        </div>

        <div>
          <QuickInsights />
        </div>
      </div>
    </AppLayout>
  );
}