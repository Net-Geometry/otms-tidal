import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileStatsList } from '@/components/ui/mobile-stats-list';
import { TrendingUp, Calendar } from 'lucide-react';

interface MonthData {
  month: string;
  hours: number;
}

export function OTTrendChart() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();

  useEffect(() => {
    fetchOTTrendData();
  }, []);

  const fetchOTTrendData = async () => {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: otData, error } = await supabase
        .from('ot_requests')
        .select('ot_date, total_hours')
        .gte('ot_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('ot_date');

      if (error) throw error;

      // Group by month
      const monthMap = new Map<string, number>();
      otData?.forEach(item => {
        const date = new Date(item.ot_date);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (item.total_hours || 0));
      });

      const chartData = Array.from(monthMap.entries()).map(([month, hours]) => ({
        month,
        hours: Math.round(hours * 10) / 10,
      }));

      setData(chartData);
    } catch (error) {
      console.error('Error fetching OT trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    hours: {
      label: "OT Hours",
      color: "hsl(var(--info))",
    },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Monthly OT Trend</CardTitle>
          <CardDescription>Track total overtime hours per month</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className={`${isMobile ? 'h-[200px]' : 'h-[300px]'} w-full`} />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Monthly OT Trend</CardTitle>
          <CardDescription>Track total overtime hours per month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`${isMobile ? 'h-32' : 'h-[300px]'} flex items-center justify-center text-muted-foreground`}>
            No OT data available for the last 6 months
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate metrics for mobile and tablet views
  const totalHours = data.reduce((sum, item) => sum + item.hours, 0);
  const avgHours = totalHours / data.length;
  const trend = data.length > 1 ?
    ((data[data.length - 1].hours - data[0].hours) / data[0].hours * 100) : 0;

  // Mobile card view for trend data
  if (isMobile) {

    return (
      <MobileStatsList
        title="Monthly OT Trend"
        description="Last 6 months overview"
        items={[
          {
            id: 'total',
            label: 'Total Hours',
            value: `${totalHours.toFixed(1)}h`,
            icon: <TrendingUp className="h-4 w-4" />,
            color: 'hsl(var(--info))'
          },
          {
            id: 'avg',
            label: 'Avg/Month',
            value: `${avgHours.toFixed(1)}h`,
            icon: <Calendar className="h-4 w-4" />,
            color: 'hsl(var(--primary))'
          },
          ...data.slice(-3).map((item, index) => ({
            id: index,
            label: item.month,
            value: `${item.hours}h`
          }))
        ]}
        trend={{
          value: trend,
          label: 'vs start',
          positiveIsGood: false
        }}
        columns={2}
      />
    );
  }

  // Tablet layout - compact chart
  if (isTablet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly OT Trend</CardTitle>
          <CardDescription>Track total overtime hours</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex items-center justify-between pt-3 border-t text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${trend >= 0 ? 'text-success' : 'text-destructive'}`} />
              <span className={`font-medium ${trend >= 0 ? 'text-success' : 'text-destructive'}`}>
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </div>
            <span className="text-muted-foreground">
              Total: {data.reduce((sum, item) => sum + item.hours, 0)}h
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly OT Trend</CardTitle>
        <CardDescription>Track total overtime hours per month</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="hsl(var(--info))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--info))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
