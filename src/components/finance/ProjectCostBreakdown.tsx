import { useMemo } from 'react';
import { format } from 'date-fns';
import { Cell, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { COST_CATEGORY_LABELS, COST_SOURCE_TYPE_LABELS, type Project, type ProjectCostAllocation } from '@/types/finance';
import { formatCurrency } from '@/lib/otCalculations';

const COLORS = ['#14b8a6', '#f97316', '#3b82f6', '#eab308', '#8b5cf6', '#06b6d4', '#ef4444'];

interface ProjectCostBreakdownProps {
  project?: Project | null;
  allocations: ProjectCostAllocation[];
}

export function ProjectCostBreakdown({ project, allocations }: ProjectCostBreakdownProps) {
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of allocations) {
      map.set(row.cost_category, (map.get(row.cost_category) || 0) + Number(row.amount || 0));
    }

    return Array.from(map.entries()).map(([category, amount]) => ({
      category,
      label: COST_CATEGORY_LABELS[category as keyof typeof COST_CATEGORY_LABELS],
      amount,
    }));
  }, [allocations]);

  const total = allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  if (!project) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Select a project to view cost breakdown.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost by Category - {project.project_code}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {byCategory.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No cost allocations found for this project.</div>
          ) : (
            <>
              <ChartContainer
                config={{
                  amount: { label: 'Amount', color: 'hsl(var(--primary))' },
                }}
                className="h-[280px]"
              >
                <PieChart>
                  <Pie data={byCategory} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={95}>
                    {byCategory.map((entry, index) => (
                      <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>

              <div className="grid gap-2 text-sm">
                {byCategory.map((row, index) => (
                  <div key={row.category} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span>{row.label}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No allocations recorded.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount (RM)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.slice(0, 10).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(new Date(row.cost_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{COST_CATEGORY_LABELS[row.cost_category]}</TableCell>
                      <TableCell>{COST_SOURCE_TYPE_LABELS[row.source_type]}</TableCell>
                      <TableCell>{row.account ? `${row.account.account_code} - ${row.account.account_name}` : '-'}</TableCell>
                      <TableCell className="text-right">{Number(row.amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
