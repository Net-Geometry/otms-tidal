import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinancePendingActionsProps {
  pendingPayrollCount: number;
  pendingClaimsCount: number;
}

export function FinancePendingActions({ pendingPayrollCount, pendingClaimsCount }: FinancePendingActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border p-4">
            <div className="text-sm font-medium text-muted-foreground">Payroll approvals pending</div>
            <div className="mt-2 text-3xl font-bold">{pendingPayrollCount}</div>
            <Button size="sm" variant="outline" asChild className="mt-3 w-full sm:w-auto">
              <NavLink to="/finance/wages">Open Wages Posting</NavLink>
            </Button>
          </div>

          <div className="rounded-md border p-4">
            <div className="text-sm font-medium text-muted-foreground">Claims approvals pending</div>
            <div className="mt-2 text-3xl font-bold">{pendingClaimsCount}</div>
            <Button size="sm" variant="outline" asChild className="mt-3 w-full sm:w-auto">
              <NavLink to="/finance/claims">Open Claims Posting</NavLink>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
