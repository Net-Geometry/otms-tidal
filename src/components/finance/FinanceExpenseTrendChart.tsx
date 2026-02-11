import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface FinanceExpenseTrendChartProps {
  data: Array<{
    month: string;
    label: string;
    payroll: number;
    claims: number;
    pettyCash: number;
  }>;
}

export function FinanceExpenseTrendChart({ data }: FinanceExpenseTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expense Trend (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No trend data available.
          </div>
        ) : (
          <ChartContainer
            config={{
              payroll: { label: 'Payroll', color: '#2563eb' },
              claims: { label: 'Claims', color: '#14b8a6' },
              pettyCash: { label: 'Petty Cash', color: '#f97316' },
            }}
            className="h-[260px]"
          >
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="payroll" stackId="expenses" fill="var(--color-payroll)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="claims" stackId="expenses" fill="var(--color-claims)" />
              <Bar dataKey="pettyCash" stackId="expenses" fill="var(--color-pettyCash)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
