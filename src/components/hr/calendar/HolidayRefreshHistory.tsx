import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

import { holidayConfigService } from '@/services/HolidayConfigService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function HolidayRefreshHistory({ limit = 25 }: { limit?: number }) {
  const queryClient = useQueryClient();
  const [retryingYear, setRetryingYear] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['holiday-refresh-history', limit],
    queryFn: () => holidayConfigService.getRefreshHistory(limit),
  });

  const handleRetry = async (year: number) => {
    setRetryingYear(year);
    try {
      const resp = await holidayConfigService.manualRefresh(year);
      if (!resp.success) {
        toast.error('Retry failed', { description: resp.error });
      } else {
        toast.success(`Retry triggered for ${year}`);
      }
      await queryClient.invalidateQueries({ queryKey: ['holiday-refresh-history'] });
    } finally {
      setRetryingYear(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const items = (data || []) as any[];

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">No refresh history found.</div>;
  }

  const badgeVariant = (status: string) => {
    if (status === 'success') return 'default';
    if (status === 'partial') return 'secondary';
    if (status === 'failed') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Tip: monthly refresh runs on the 1st (UTC); Q4 population runs on Oct 1 (UTC).
      </div>

      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2">Started</th>
              <th className="p-2">Job</th>
              <th className="p-2">Year</th>
              <th className="p-2">Status</th>
              <th className="p-2">Scraped</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2 text-xs text-muted-foreground">
                  {row.started_at ? format(new Date(row.started_at), 'PP p') : '-'}
                </td>
                <td className="p-2 font-medium">{row.job_type}</td>
                <td className="p-2">{row.year}</td>
                <td className="p-2">
                  <Badge variant={badgeVariant(row.status)}>{row.status}</Badge>
                </td>
                <td className="p-2">{row.holidays_scraped ?? 0}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(row.year)}
                      disabled={retryingYear === row.year}
                    >
                      {retryingYear === row.year ? (
                        <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Retrying...</>
                      ) : (
                        <><RefreshCcw className="mr-2 h-3 w-3" />Retry</>
                      )}
                    </Button>
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(row.result ?? row.errors ?? {}, null, 2)}
                      </pre>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
