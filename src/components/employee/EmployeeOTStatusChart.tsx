import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile, useIsTablet, useDeviceType } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileStatsList } from '@/components/ui/mobile-stats-list';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface StatusData {
  name: string;
  value: number;
  color: string;
}

export function EmployeeOTStatusChart() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const deviceType = useDeviceType();
  const [data, setData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStatusData();
    }
  }, [user]);

  const fetchStatusData = async () => {
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: requests, error } = await supabase
      .from('ot_requests')
      .select('status')
      .eq('employee_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    if (error) {
      console.error('Error fetching status data:', error);
      setLoading(false);
      return;
    }

    const approvedCount = requests?.filter(r =>
      r.status === 'hr_certified' || r.status === 'management_approved' || r.status === 'supervisor_verified'
    ).length || 0;
    const pendingCount = requests?.filter(r =>
      r.status === 'pending_verification'
    ).length || 0;
    const rejectedCount = requests?.filter(r =>
      r.status === 'rejected'
    ).length || 0;

    const statusData: StatusData[] = [
      { name: 'Approved', value: approvedCount, color: '#22C55E' },
      { name: 'Pending', value: pendingCount, color: '#EAB308' },
      { name: 'Rejected', value: rejectedCount, color: '#EF4444' }
    ].filter(item => item.value > 0);

    setData(statusData);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle>Request Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Request Status</CardTitle>
        </CardHeader>
        <CardContent className={`${isMobile ? 'h-32' : 'h-[260px]'} flex items-center justify-center`}>
          <p className="text-muted-foreground">No OT requests this month</p>
        </CardContent>
      </Card>
    );
  }

  // Mobile list view
  if (isMobile) {
    const getIcon = (name: string) => {
      switch (name) {
        case 'Approved': return <CheckCircle className="h-4 w-4 text-success" />;
        case 'Pending': return <Clock className="h-4 w-4 text-warning" />;
        case 'Rejected': return <XCircle className="h-4 w-4 text-destructive" />;
        default: return null;
      }
    };

    return (
      <MobileStatsList
        title="Request Status"
        items={data.map((item, index) => ({
          id: index,
          label: item.name,
          value: item.value,
          icon: getIcon(item.name),
          color: item.color
        }))}
      />
    );
  }

  // Tablet layout - compact pie chart with legend
  if (isTablet) {
    return (
      <Card className="shadow-md rounded-xl">
        <CardHeader>
          <CardTitle>Request Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value} requests`,
                  name
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.name}:</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md rounded-xl">
      <CardHeader>
        <CardTitle>Request Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
