import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileStatsList } from '@/components/ui/mobile-stats-list';
import { Building2 } from 'lucide-react';

interface DepartmentData {
  department: string;
  hours: number;
  fill: string;
}

const COLORS = [
  'hsl(var(--info))',
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent))',
];

interface DepartmentOTChartProps {
  filterDate?: Date;
}

export function DepartmentOTChart({ filterDate = new Date() }: DepartmentOTChartProps) {
  const [data, setData] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();

  useEffect(() => {
    fetchDepartmentOTData();
  }, [filterDate]);

  const fetchDepartmentOTData = async () => {
    try {
      const startOfMonth = new Date(filterDate);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: otData, error } = await supabase
        .from('ot_requests')
        .select(`
          total_hours,
          employee_id,
          profiles!ot_requests_employee_id_fkey(
            department_id,
            departments!profiles_department_id_fkey(
              name
            )
          )
        `)
        .gte('ot_date', startOfMonth.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by department
      const deptMap = new Map<string, number>();
      otData?.forEach((item: any) => {
        const deptName = item.profiles?.departments?.name || 'No Department';
        deptMap.set(deptName, (deptMap.get(deptName) || 0) + (item.total_hours || 0));
      });

      const chartData: DepartmentData[] = Array.from(deptMap.entries()).map(([department, hours], index) => ({
        department,
        hours: Math.round(hours * 10) / 10,
        fill: COLORS[index % COLORS.length],
      }));

      setData(chartData);
    } catch (error) {
      console.error('Error fetching department OT data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = data.reduce((config, item) => ({
    ...config,
    [item.department]: {
      label: item.department,
      color: item.fill,
    },
  }), {
    hours: {
      label: "Hours",
    },
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Department OT Breakdown</CardTitle>
          <CardDescription>Visualize overtime distribution by department</CardDescription>
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
          <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Department OT Breakdown</CardTitle>
          <CardDescription>Visualize overtime distribution by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`${isMobile ? 'h-32' : 'h-[300px]'} flex items-center justify-center text-muted-foreground`}>
            No OT data available for {format(filterDate, 'MMMM yyyy')}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mobile list view for department breakdown
  if (isMobile) {
    const sortedData = [...data].sort((a, b) => b.hours - a.hours);
    const totalHours = data.reduce((sum, item) => sum + item.hours, 0);

    return (
      <MobileStatsList
        title="Department OT Breakdown"
        description="This month's distribution"
        items={sortedData.map((item, index) => {
          const percentage = totalHours > 0 ? (item.hours / totalHours * 100) : 0;
          return {
            id: index,
            label: item.department,
            value: `${item.hours}h`,
            subValue: `${percentage.toFixed(1)}%`,
            color: item.fill,
            icon: <Building2 className="h-3 w-3" />
          };
        })}
        totalLabel="Total"
        totalValue={`${totalHours.toFixed(1)}h`}
      />
    );
  }

  // Tablet layout - compact pie chart
  if (isTablet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department OT Breakdown</CardTitle>
          <CardDescription>Distribution by department</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={data}
                  dataKey="hours"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={(entry) => `${entry.hours}h`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="truncate">{item.department}: {item.hours}h</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department OT Breakdown</CardTitle>
        <CardDescription>Visualize overtime distribution by department</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={data}
                dataKey="hours"
                nameKey="department"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.hours}h`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
