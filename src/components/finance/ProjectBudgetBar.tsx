import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/otCalculations';

interface ProjectBudgetBarProps {
  budget: number;
  spent: number;
}

function getColorClass(pct: number) {
  if (pct > 100) return '[&>div]:bg-red-500';
  if (pct >= 80) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-green-600';
}

export function ProjectBudgetBar({ budget, spent }: ProjectBudgetBarProps) {
  const safeBudget = Number(budget || 0);
  const safeSpent = Number(spent || 0);
  const pct = safeBudget > 0 ? (safeSpent / safeBudget) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{safeBudget > 0 ? `${pct.toFixed(1)}%` : '0.0%'}</span>
        <span>{formatCurrency(safeSpent)} / {formatCurrency(safeBudget)}</span>
      </div>
      <Progress value={Math.min(pct, 100)} className={getColorClass(pct)} />
    </div>
  );
}
