import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { holidayConfigService } from '@/services/HolidayConfigService';
import { HolidayRefreshHistory } from '@/components/hr/calendar/HolidayRefreshHistory';

export function ManageHolidaysPanel() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const year = new Date().getFullYear();
      const resp = await holidayConfigService.manualRefresh(year);
      if (!resp.success) {
        toast.error('Refresh failed', { description: resp.error });
      } else {
        toast.success(`Refresh triggered for ${year}`);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Manage holidays">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Holidays</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing...</>
              ) : (
                'Refresh From Source'
              )}
            </Button>
            <Button asChild type="button">
              <Link to="/hr/holidays">Open Holiday Management</Link>
            </Button>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Refresh History</div>
            <HolidayRefreshHistory />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
