import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Clock, UserCheck, UserX } from 'lucide-react';

import { DashboardCard } from '@/components/DashboardCard';
import { supabase } from '@/integrations/supabase/client';

export function AttendanceDashboardCards() {
  const { data: stats } = useQuery({
    queryKey: ['attendance-stats-today'],
    queryFn: async () => {
      const db = supabase as any;
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await db
        .from('attendance_records')
        .select('status, is_late')
        .eq('date', today);
      if (error) throw error;

      const rows = (data || []) as any[];
      const present = rows.filter((r) => r.status === 'present').length;
      const late = rows.filter((r) => r.status === 'late' || r.is_late).length;
      const absent = rows.filter((r) => r.status === 'absent').length;

      return { present, late, absent };
    },
    staleTime: 30 * 1000,
  });

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardCard title="Present Today" value={String(stats?.present ?? '-')} subtitle="Checked in" icon={UserCheck} />
      <DashboardCard title="Late Today" value={String(stats?.late ?? '-')} subtitle="Beyond threshold" icon={Clock} />
      <DashboardCard title="Absent Today" value={String(stats?.absent ?? '-')} subtitle="No clock-in" icon={UserX} />
    </div>
  );
}
