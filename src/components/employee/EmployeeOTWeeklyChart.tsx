import { useEffect, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileStatsList } from '@/components/ui/mobile-stats-list';

interface WeeklyData {
  week: string;
  hours: number;
}

interface EmployeeOTWeeklyChartProps {
  filterDate?: Date;
}

export function EmployeeOTWeeklyChart({ filterDate = new Date() }: EmployeeOTWeeklyChartProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();
  const [data, setData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWeeklyData();
    }
  }, [user, filterDate]);

  const fetchWeeklyData = async () => {
    if (!user) return;

    const monthStart = startOfMonth(filterDate);
    const monthEnd = endOfMonth(filterDate);

    const { data: requests, error } = await supabase
      .from('ot_requests')
      .select('ot_date, total_hours')
      .eq('employee_id', user.id)
      .gte('ot_date', monthStart.toISOString().split('T')[0])
      .lte('ot_date', monthEnd.toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching weekly data:', error);
      setLoading(false);
      return;
    }

    // Group by week
    const weeklyMap = new Map<number, number>();
    requests?.forEach(req => {
      const date = new Date(req.ot_date);
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const daysSinceFirst = Math.floor((date.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
      const weekNum = Math.floor(daysSinceFirst / 7) + 1;

      weeklyMap.set(weekNum, (weeklyMap.get(weekNum) || 0) + (req.total_hours || 0));
    });

    // Create data for all weeks (1-5)
    const weeklyData: WeeklyData[] = [];
    for (let i = 1; i <= 5; i++) {
      weeklyData.push({
        week: `Week ${i}`,
        hours: Number((weeklyMap.get(i) || 0).toFixed(1))
      });
    }

    setData(weeklyData);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle>Weekly OT Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.every(d => d.hours === 0)) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle>Weekly OT Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] flex items-center justify-center text-muted-foreground">
            No OT data available for {format(filterDate, 'MMMM yyyy')}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mobile card view for simple data
  if (isMobile) {
    return (
      <MobileStatsList
        title="Weekly OT Hours"
        items={data.map((item, index) => ({
          id: index,
          label: item.week,
          value: `${item.hours}h`
        }))}
        totalLabel="Total"
        totalValue={`${data.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h`}
        columns={2}
      />
    );
  }

  // Tablet layout - hybrid approach with compact chart
  if (isTablet) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle>Weekly OT Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Bar
                dataKey="hours"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                name="Hours"
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t flex justify-between text-sm">
            <span className="text-muted-foreground">Total Hours</span>
            <span className="font-semibold text-primary">
              {data.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md rounded-xl">
      <CardHeader>
        <CardTitle>Weekly OT Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="hours" fill="#5F26B4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
