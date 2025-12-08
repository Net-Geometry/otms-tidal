import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, User, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/otCalculations';
import { startOfMonth, endOfMonth } from 'date-fns';

interface Insight {
  title: string;
  value: string;
  icon: any;
  trend: string;
  trendUp: boolean;
  borderColor: string;
}

interface QuickInsightsProps {
  filterDate?: Date;
}

export function QuickInsights({ filterDate = new Date() }: QuickInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [filterDate]);

  const fetchInsights = async () => {
    const monthStart = startOfMonth(filterDate);
    const monthEnd = endOfMonth(filterDate);
    const lastMonthStart = startOfMonth(new Date(filterDate.getFullYear(), filterDate.getMonth() - 1, 1));
    const lastMonthEnd = endOfMonth(new Date(filterDate.getFullYear(), filterDate.getMonth() - 1, 1));

    // Fetch current month data
    const { data: currentData } = await supabase
      .from('ot_requests')
      .select(`
        total_hours,
        ot_amount,
        employee_id,
        profiles!ot_requests_employee_id_fkey(
          full_name,
          department_id,
          departments!profiles_department_id_fkey(name)
        )
      `)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    // Fetch last month data for trends
    const { data: lastMonthData } = await supabase
      .from('ot_requests')
      .select('total_hours, employee_id')
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    if (currentData) {
      // Top OT Department
      const deptMap = new Map<string, number>();
      currentData.forEach((item: any) => {
        const deptName = item.profiles?.departments?.name || 'Unknown';
        deptMap.set(deptName, (deptMap.get(deptName) || 0) + (item.total_hours || 0));
      });
      const topDept = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1])[0];
      const topDeptName = topDept?.[0] || 'N/A';
      const topDeptHours = topDept?.[1] || 0;

      // Highest OT Earner
      const empMap = new Map<string, { name: string; amount: number }>();
      currentData.forEach((item: any) => {
        const empId = item.employee_id;
        const empName = item.profiles?.full_name || 'Unknown';
        const amount = item.ot_amount || 0;
        const existing = empMap.get(empId);
        if (existing) {
          existing.amount += amount;
        } else {
          empMap.set(empId, { name: empName, amount });
        }
      });
      const topEarner = Array.from(empMap.values()).sort((a, b) => b.amount - a.amount)[0];

      // Average OT per Employee
      const uniqueEmployees = new Set(currentData.map((item: any) => item.employee_id));
      const totalHours = currentData.reduce((sum: number, item: any) => sum + (item.total_hours || 0), 0);
      const avgHours = uniqueEmployees.size > 0 ? totalHours / uniqueEmployees.size : 0;

      // Calculate trend for average OT
      const lastMonthUniqueEmps = new Set(lastMonthData?.map((item: any) => item.employee_id) || []);
      const lastMonthTotal = lastMonthData?.reduce((sum: number, item: any) => sum + (item.total_hours || 0), 0) || 0;
      const lastMonthAvg = lastMonthUniqueEmps.size > 0 ? lastMonthTotal / lastMonthUniqueEmps.size : 0;
      const avgTrend = lastMonthAvg > 0 ? ((avgHours - lastMonthAvg) / lastMonthAvg) * 100 : 0;

      setInsights([
        {
          title: 'Top OT Department',
          value: topDeptName,
          icon: Briefcase,
          trend: topDeptHours > 0 ? `${topDeptHours.toFixed(1)} hrs` : 'N/A',
          trendUp: true,
          borderColor: 'border-l-[#5F26B4]',
        },
        {
          title: 'Highest OT Earner',
          value: topEarner?.name || 'N/A',
          icon: User,
          trend: topEarner ? formatCurrency(topEarner.amount) : 'N/A',
          trendUp: true,
          borderColor: 'border-l-[#10B981]',
        },
        {
          title: 'Average OT per Employee',
          value: avgHours > 0 ? `${avgHours.toFixed(1)} hrs` : '0.0 hrs',
          icon: Clock,
          trend: avgTrend !== 0 ? `${avgTrend >= 0 ? '+' : ''}${avgTrend.toFixed(1)}%` : 'N/A',
          trendUp: avgTrend >= 0,
          borderColor: 'border-l-[#F59E0B]',
        },
      ]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Insights</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Quick Insights</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight, index) => (
          <Card key={index} className={cn('border-l-4', insight.borderColor)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{insight.title}</p>
                  <h3 className="text-2xl font-bold mt-2">{insight.value}</h3>
                  <div className="flex items-center gap-1 mt-2">
                    {insight.trendUp ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      insight.trendUp ? 'text-success' : 'text-destructive'
                    )}>
                      {insight.trend}
                    </span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <insight.icon className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}