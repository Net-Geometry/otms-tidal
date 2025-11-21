import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserPlus, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/otCalculations';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface Employee {
  status: string;
  basic_salary: number;
}

interface EmployeeStatsProps {
  employees: Employee[];
}

export function EmployeeStats({ employees }: EmployeeStatsProps) {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'active').length;

  // Fetch total OT for current month
  const { data: otData } = useQuery({
    queryKey: ['monthly-ot-total'],
    queryFn: async () => {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('ot_requests')
        .select('ot_amount')
        .gte('ot_date', startDate)
        .lte('ot_date', endDate)
        .in('status', ['supervisor_verified', 'hr_certified', 'management_approved']);

      if (error) throw error;

      const total = data?.reduce((sum, record) => sum + (record.ot_amount || 0), 0) || 0;
      return total;
    },
  });

  const totalMonthlyOT = otData || 0;

  const stats = [
    {
      title: 'Total Employees',
      value: totalEmployees,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Employees',
      value: activeEmployees,
      icon: UserCheck,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Pending Activation',
      value: totalEmployees - activeEmployees,
      icon: UserPlus,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Total OT per Month',
      value: formatCurrency(totalMonthlyOT),
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
