
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileStatsList } from '@/components/ui/mobile-stats-list';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { TrendingUp, Calendar } from 'lucide-react';

interface WeekData {
  week: string;
  hours: number;
}

interface SupervisorOTTrendChartProps {
  filterDate?: Date;
}

export function SupervisorOTTrendChart({ filterDate = new Date() }: SupervisorOTTrendChartProps) {
  const [data, setData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchTrendData();
  }, [filterDate]);

  const fetchTrendData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = startOfMonth(filterDate);
      const monthEnd = endOfMonth(filterDate);

      // Get all weeks in the current month
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

      // Fetch all OT requests for this month
      const { data: otRequests } = await supabase
        .from('ot_requests')
        .select('ot_date, total_hours')
        .eq('supervisor_id', user.id)
        .gte('ot_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('ot_date', format(monthEnd, 'yyyy-MM-dd'));

      // Group by week
      const weeklyData = weeks.map((weekStart, index) => {
        const weekEndDate = endOfWeek(weekStart);
        const weekLabel = `Week ${index + 1} `;

        const weekHours = otRequests?.reduce((sum, req) => {
          const reqDate = new Date(req.ot_date);
          if (reqDate >= weekStart && reqDate <= weekEndDate) {
            return sum + (req.total_hours || 0);
          }
          return sum;
        }, 0) || 0;

        return {
          week: weekLabel,
          hours: parseFloat(weekHours.toFixed(1))
        };
      });

      setData(weeklyData);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className={`${isMobile ? 'h-48' : 'h-64'} w-full`} />
        </CardContent>
      </Card>
    );
  }

  if (data.every(d => d.hours === 0)) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Monthly OT Trend</CardTitle>
          <CardDescription>Track your team's OT hours progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No OT data available for {format(filterDate, 'MMMM yyyy')}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mobile card view for supervisor trend
  if (isMobile) {
    const totalHours = data.reduce((sum, item) => sum + item.hours, 0);
    const currentWeekHours = data[data.length - 1]?.hours || 0; // Renamed from currentWeek
    const previousWeekHours = data[data.length - 2]?.hours || 0; // Renamed from previousWeek
    const trend = previousWeekHours > 0 ? ((currentWeekHours - previousWeekHours) / previousWeekHours * 100) : 0; // Renamed from weeklyChange

    return (
      <MobileStatsList
        title="Monthly OT Trend"
        description="Your team's progress this month"
        items={[
          {
            id: 'total',
            label: 'Total Hours',
            value: `${totalHours.toFixed(1)}h`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: 'hsl(var(--primary))'
          },
          {
            id: 'current',
            label: 'This Week',
            value: `${currentWeekHours.toFixed(1)}h`,
            icon: <Calendar className="h-4 w-4" />,
            color: 'hsl(var(--info))'
          },
          ...data.slice(-3).map((item, index) => ({
            id: index,
            label: item.week,
            value: `${item.hours}h`
          }))
        ]}
        trend={{
          value: trend,
          label: 'vs last week',
          positiveIsGood: false
        }}
        columns={2}
      />
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Monthly OT Trend</CardTitle>
        <CardDescription>Track how your team's OT hours have evolved</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              className="text-xs text-muted-foreground"
            />
            <YAxis
              className="text-xs text-muted-foreground"
              label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Line
              type="monotone"
              dataKey="hours"
              stroke="hsl(var(--info))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--info))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
