import { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HolidayItem } from './HolidayItemsTable';
import { format } from 'date-fns';

interface HolidayPreviewSidebarProps {
  items: HolidayItem[];
  currentDate?: Date;
}

export function HolidayPreviewSidebar({ items, currentDate }: HolidayPreviewSidebarProps) {
  const { markedDates, holidayCounts, sortedItems } = useMemo(() => {
    const counts = {
      total: items.length,
      weekly: 0,
      state: 0,
      federal: 0,
    };

    const sorted = [...items].sort((a, b) => 
      new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
    );

    items.forEach(item => {
      if (item.description === 'Weekly Off') {
        counts.weekly++;
      } else if (item.state_code) {
        counts.state++;
      } else {
        counts.federal++;
      }
    });
    
    // Group dates for modifiers
    const weeklyOffDates = items
      .filter(i => i.description === 'Weekly Off')
      .map(i => new Date(i.holiday_date + 'T00:00:00'));
      
    const otherHolidayDates = items
      .filter(i => i.description !== 'Weekly Off')
      .map(i => new Date(i.holiday_date + 'T00:00:00'));

    return {
      markedDates: {
        weekly: weeklyOffDates,
        holiday: otherHolidayDates
      },
      holidayCounts: counts,
      sortedItems: sorted
    };
  }, [items]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Calendar Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <Calendar
            mode="default"
            selected={undefined}
            month={currentDate}
            modifiers={{
              weekly: markedDates.weekly,
              holiday: markedDates.holiday
            }}
            modifiersClassNames={{
              weekly: "bg-muted text-muted-foreground",
              holiday: "bg-primary text-primary-foreground font-bold"
            }}
            className="rounded-md border-none shadow-none w-full"
            compact
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col p-2 bg-muted rounded-md">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-bold">{holidayCounts.total}</span>
        </div>
        <div className="flex flex-col p-2 bg-primary/10 rounded-md">
          <span className="text-xs text-muted-foreground">Holiday</span>
          <span className="font-bold text-primary">{holidayCounts.state + holidayCounts.federal}</span>
        </div>
        <div className="flex flex-col p-2 bg-secondary rounded-md">
          <span className="text-xs text-muted-foreground">Weekly</span>
          <span className="font-bold">{holidayCounts.weekly}</span>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium">Holidays List</CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1 h-[200px]">
          <div className="p-2 space-y-1">
            {sortedItems.map((item, i) => (
              <div key={item.id || item.temp_id || i} className="flex items-center justify-between p-2 text-sm border rounded-md hover:bg-muted/50">
                <div className="flex flex-col overflow-hidden">
                   <span className="font-medium">{format(new Date(item.holiday_date + 'T00:00:00'), 'd MMM')}</span>
                   <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={item.description}>{item.description}</span>
                </div>
                {item.state_code && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1 shrink-0">{item.state_code}</Badge>
                )}
              </div>
            ))}
             {sortedItems.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  No holidays added
                </div>
             )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
