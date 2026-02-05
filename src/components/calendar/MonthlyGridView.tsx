import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  format,
  isToday,
} from "date-fns";
import { EventBlock } from "./EventBlock";
import { HolidayItem } from "@/hooks/useHolidayCalendarView";
import { EventTypeFilters } from "./EventTypeFilter";

interface MonthlyGridViewProps {
  selectedDate: Date;
  holidays: HolidayItem[];
  filters: EventTypeFilters;
  onDateClick: (date: Date) => void;
  onEventClick: (holiday: HolidayItem, date: Date) => void;
}

export function MonthlyGridView({
  selectedDate,
  holidays,
  filters,
  onDateClick,
  onEventClick,
}: MonthlyGridViewProps) {
  // Get the start and end of the month
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Get the start and end of the calendar grid (includes days from adjacent months)
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Get all days to display
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter holidays based on selected filters
  const filteredHolidays = holidays.filter((h) => {
    const source = h.event_source;
    const isLeave = source === 'leave' || h.is_personal_leave;
    if (isLeave) return filters.leave;
    if (source === 'company') return filters.company;
    if (h.state_code === 'ALL') return filters.public;
    return filters.state;
  });

  // Get holidays for a specific day
  const getHolidaysForDay = (day: Date): HolidayItem[] => {
    return filteredHolidays.filter((h) =>
      isSameDay(parseISO(h.holiday_date), day)
    );
  };

  // Group days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-background p-4">
      {/* Day names header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-muted-foreground text-sm py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {weeks.map((week) =>
          week.map((day) => {
            const isCurrentMonth = isSameMonth(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayHolidays = getHolidaysForDay(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateClick(day)}
                className={`
                  relative rounded-lg border-2 p-2 text-left transition-all duration-200
                  flex flex-col cursor-pointer min-h-[120px]
                  ${
                    isTodayDate
                      ? "border-primary bg-primary/5 hover:bg-primary/10"
                      : isCurrentMonth
                        ? "border-border bg-card hover:bg-accent"
                        : "border-border/30 bg-muted/30 hover:bg-muted/50"
                  }
                  ${!isCurrentMonth ? "opacity-50" : ""}
                `}
              >
                {/* Day number */}
                <div
                  className={`
                    font-bold mb-1
                    ${isTodayDate ? "text-primary" : "text-foreground"}
                    ${!isCurrentMonth ? "text-muted-foreground" : ""}
                  `}
                >
                  {format(day, "d")}
                </div>

                {/* Holiday events */}
                <div className="flex-1 space-y-0.5 overflow-hidden flex flex-col">
                  {dayHolidays.slice(0, 2).map((holiday) => (
                    <div
                      key={holiday.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(holiday, day);
                      }}
                      className="flex-shrink-0"
                    >
                      <EventBlock
                        holiday={holiday}
                        onClick={() => onEventClick(holiday, day)}
                        isFullDay={true}
                      />
                    </div>
                  ))}

                  {/* Show overflow indicator */}
                  {dayHolidays.length > 2 && (
                    <div className="text-[10px] text-muted-foreground font-medium px-2 py-1">
                      +{dayHolidays.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
