import { Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/otCalculations';

interface PettyCashBalanceCardProps {
  balance: number;
  floatAmount: number;
  utilizationPct: number;
  totalTopUps: number;
  totalExpenditures: number;
}

export function PettyCashBalanceCard({
  balance,
  floatAmount,
  utilizationPct,
  totalTopUps,
  totalExpenditures,
}: PettyCashBalanceCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Petty Cash Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-3xl font-bold">{formatCurrency(balance || 0)}</div>
          <p className="text-xs text-muted-foreground">Configured float: {formatCurrency(floatAmount || 0)}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Utilization</span>
            <span>{Number(utilizationPct || 0).toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(utilizationPct, 100)} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Top-ups</div>
            <div className="font-semibold text-green-600">{formatCurrency(totalTopUps || 0)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Expenditures</div>
            <div className="font-semibold">{formatCurrency(totalExpenditures || 0)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
