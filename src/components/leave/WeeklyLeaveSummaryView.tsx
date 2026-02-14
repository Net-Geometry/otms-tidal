import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWeeklyLeaveSummary } from '@/hooks/leave/useWeeklyLeaveSummary';
import { format, parseISO } from 'date-fns';

export function WeeklyLeaveSummaryView() {
  const { data: summaries = [], isLoading } = useWeeklyLeaveSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Leave Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Leave Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No weekly summaries generated yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => {
        const data = summary.summary_data;
        const departments = data?.departments || {};

        return (
          <Card key={summary.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Week: {format(parseISO(summary.week_start), 'dd MMM')} -{' '}
                  {format(parseISO(summary.week_end), 'dd MMM yyyy')}
                </CardTitle>
                <Badge variant="outline">{data.total_requests} request(s)</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Generated {format(parseISO(summary.generated_at), 'dd MMM yyyy, HH:mm')}
              </p>
            </CardHeader>
            <CardContent>
              {Object.keys(departments).length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved leave for this week.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(departments).map(([deptId, dept]) => (
                    <div key={deptId} className="rounded-md border p-3">
                      <h4 className="text-sm font-medium mb-2">{dept.department_name}</h4>
                      <div className="space-y-1">
                        {Object.entries(dept.by_leave_type).map(([ltId, lt]) => (
                          <div key={ltId} className="flex items-center justify-between text-sm">
                            <span>
                              {lt.leave_type_name}{' '}
                              <span className="text-muted-foreground">
                                ({lt.count} request{lt.count > 1 ? 's' : ''}, {lt.total_days} day
                                {lt.total_days !== 1 ? 's' : ''})
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {lt.employees.join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
