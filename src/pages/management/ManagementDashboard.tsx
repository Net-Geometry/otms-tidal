import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { EnhancedDashboardCard } from '@/components/hr/EnhancedDashboardCard';
import { OTTrendChart } from '@/components/hr/charts/OTTrendChart';
import { OTCostChart } from '@/components/management/charts/OTCostChart';
import { MonthYearFilter } from '@/components/MonthYearFilter';
import { QuickInsights } from '@/components/management/QuickInsights';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';

export default function ManagementDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentDate.getFullYear().toString());
  const [stats, setStats] = useState({
    totalOTHours: 0,
    totalExpenditure: 0,
    complianceRate: 0,
    monthlyTrend: '+0%',
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
      const monthStart = startOfMonth(filterDate);
      const monthEnd = endOfMonth(filterDate);
      const lastMonthStart = startOfMonth(new Date(filterDate.getFullYear(), filterDate.getMonth() - 1, 1));
      const lastMonthEnd = endOfMonth(new Date(filterDate.getFullYear(), filterDate.getMonth() - 1, 1));

      // Current month data
      const { data: currentMonthData, error: currentError } = await supabase
        .from('ot_requests')
        .select('total_hours, ot_amount, status')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (currentError) {
        console.error('Error fetching current month data:', currentError);
        setLoading(false);
        return;
      }

      // Last month data for trend
      const { data: lastMonthData, error: lastError } = await supabase
        .from('ot_requests')
        .select('total_hours')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString());

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
      const hasData = currentMonthData && currentMonthData.length > 0;

      setStats({
        totalOTHours,
        totalExpenditure,
        complianceRate,
        monthlyTrend,
        hasData,
      });
      setLoading(false);
    } catch (err) {
      console.error('Stats fetch exception:', err);
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageLayout
        title="Management Dashboard"
        description={fullName ? `Welcome back, ${fullName}! Here's your executive overview.` : "Welcome back! Here's your executive overview."}
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

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : stats.hasData ? (
            <>
              <EnhancedDashboardCard
                icon={Clock}
                title="Organization OT Hours"
                value={stats.totalOTHours.toFixed(1)}
                subtitle={format(filterDate, 'MMMM yyyy')}
                variant="info"
              />
              <EnhancedDashboardCard
                icon={DollarSign}
                title="Total Expenditure"
                value={formatCurrency(stats.totalExpenditure)}
                subtitle={format(filterDate, 'MMMM yyyy')}
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
          ) : (
            <>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  icon={Clock}
                  title="Organization OT Hours"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  variant="info"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  icon={DollarSign}
                  title="Total Expenditure"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  variant="primary"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  icon={CheckCircle}
                  title="Compliance Rate"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  variant="success"
                />
              </div>
              <div className="opacity-50 pointer-events-none">
                <EnhancedDashboardCard
                  icon={TrendingUp}
                  title="Monthly Trend"
                  value="-"
                  subtitle={`No OT data available for ${format(filterDate, 'MMMM yyyy')}`}
                  variant="warning"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-1">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Visual summary of organizational overtime and expenditure performance
          </p>
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <OTTrendChart filterDate={filterDate} />
            <OTCostChart filterDate={filterDate} />
          </div>
        </div>

        <div>
          <QuickInsights filterDate={filterDate} />
        </div>
      </PageLayout>
    </AppLayout>
  );
}