import { Cell, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/otCalculations';

const COLORS = ['#14b8a6', '#3b82f6', '#f97316', '#eab308', '#8b5cf6'];

interface FinanceProjectCostChartProps {
  data: Array<{
    id: string;
    project_code: string;
    project_name: string;
    amount: number;
  }>;
}

export function FinanceProjectCostChart({ data }: FinanceProjectCostChartProps) {
  const chartData = data.map((row) => ({
    name: `${row.project_code}`,
    amount: Number(row.amount || 0),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 5 Projects by Cost</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No project cost data available.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartContainer
              config={{
                amount: { label: 'Cost', color: '#14b8a6' },
              }}
              className="h-[260px] lg:col-span-3"
            >
              <PieChart>
                <Pie data={chartData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {chartData.map((row, index) => (
                    <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>

            <div className="space-y-2 lg:col-span-2">
              {data.map((row, index) => (
                <div key={row.id} className="rounded-md border p-2 text-sm min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-medium truncate">{row.project_code}</span>
                    </div>
                    <span className="flex-shrink-0">{formatCurrency(Number(row.amount || 0))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate pl-4.5" title={row.project_name}>{row.project_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
