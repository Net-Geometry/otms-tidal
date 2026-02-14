import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Cake, Palmtree, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHRCalendarView } from '@/hooks/hr/useHRCalendarView';
import { cn } from '@/lib/utils';

export function HRCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: events = [], isLoading } = useHRCalendarView(year);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group events by date
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const monthEvents = eventsByDate.get(event.date) || [];
    monthEvents.push(event);
    eventsByDate.set(event.date, monthEvents);
  }

  // Filter events for current month for the list view
  const currentMonthEvents = events.filter((e) => {
    const d = parseISO(e.date);
    return isSameMonth(d, currentDate);
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Cake className="h-4 w-4 text-pink-500" />
            <span>Birthday</span>
          </div>
          <div className="flex items-center gap-1">
            <Palmtree className="h-4 w-4 text-blue-500" />
            <span>Leave</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-green-500" />
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium border-b">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateStr) || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={dateStr}
                className={cn(
                  'min-h-[100px] p-1 border-b border-r',
                  !isCurrentMonth && 'bg-muted/30',
                  isTodayDate && 'bg-blue-50/50'
                )}
              >
                <div
                  className={cn(
                    'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                    isTodayDate && 'bg-blue-500 text-white'
                  )}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded truncate',
                        event.type === 'birthday' && 'bg-pink-100 text-pink-800',
                        event.type === 'leave' && 'bg-blue-100 text-blue-800',
                        event.type === 'holiday' && 'bg-green-100 text-green-800'
                      )}
                      title={event.title}
                    >
                      {event.type === 'birthday' && '🎂 '}
                      {event.type === 'leave' && '🏖️ '}
                      {event.type === 'holiday' && '📅 '}
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List for Current Month */}
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Events for {format(currentDate, 'MMMM yyyy')}</h4>
        {currentMonthEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground">No events this month</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentMonthEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0',
                    event.type === 'birthday' && 'border-pink-300 bg-pink-50',
                    event.type === 'leave' && 'border-blue-300 bg-blue-50',
                    event.type === 'holiday' && 'border-green-300 bg-green-50'
                  )}
                >
                  {format(parseISO(event.date), 'dd MMM')}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{event.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{event.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-pink-600">
            {currentMonthEvents.filter((e) => e.type === 'birthday').length}
          </div>
          <div className="text-sm text-muted-foreground">Birthdays</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {currentMonthEvents.filter((e) => e.type === 'leave').length}
          </div>
          <div className="text-sm text-muted-foreground">Leave Days</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {currentMonthEvents.filter((e) => e.type === 'holiday').length}
          </div>
          <div className="text-sm text-muted-foreground">Holidays</div>
        </div>
      </div>
    </div>
  );
}
