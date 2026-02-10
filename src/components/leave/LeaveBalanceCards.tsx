import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaveBalance } from '@/types/leave';

function getTone(balance: LeaveBalance) {
  const remaining = Number(balance.remaining || 0);
  const entitled = Number(balance.entitled_days || 0) + Number(balance.carried_forward || 0) + Number(balance.adjustment || 0);

  if (entitled <= 0) {
    return 'neutral';
  }

  const ratio = remaining / entitled;
  if (ratio <= 0.15) return 'danger';
  if (ratio <= 0.35) return 'warning';
  return 'good';
}

function toneClass(tone: string) {
  if (tone === 'danger') return 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20';
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20';
  return '';
}

export function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => {
        const tone = getTone(b);
        const name = b.leave_type?.name || 'Leave';
        return (
          <Card key={b.id} className={toneClass(tone)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Entitled</div>
                  <div className="font-semibold">{Number(b.entitled_days || 0).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Used</div>
                  <div className="font-semibold">{Number(b.used_days || 0).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Remaining</div>
                  <div className="font-semibold">{Number(b.remaining || 0).toFixed(1)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
