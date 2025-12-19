import { format, addDays, startOfWeek, isSameDay, parseISO, startOfDay, endOfDay } from "date-fns";
import { useState, useEffect } from "react";
import { EventBlock } from "./EventBlock";
import { HolidayItem } from "@/hooks/useHolidayCalendarView";
import { EventTypeFilters } from "./EventTypeFilter";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

interface TimeGridViewProps {
  viewMode: "week" | "day";
  selectedDate: Date;
  holidays: HolidayItem[];
  filters: EventTypeFilters;
  onEventClick: (holiday: HolidayItem, date: Date) => void;
  startHour?: number;
  endHour?: number;
}

export function TimeGridView({
  viewMode,
  selectedDate,
  holidays,
  filters,
  onEventClick,
  startHour = 8,
  endHour = 19,
}: TimeGridViewProps) {
  const isMobile = useIsMobile();

  // Force day view on mobile for better usability
  const effectiveViewMode = isMobile ? "day" : viewMode;

  // Get days to display
  const days =
    effectiveViewMode === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i))
      : [selectedDate];

  // Filter holidays based on selected filters
  const filteredHolidays = holidays.filter((h) => {
    const isWeeklyOff = h.description.toLowerCase().includes("weekly off");
    const isNationalHoliday = h.state_code === "ALL";
    const isStateHoliday = h.state_code && h.state_code !== "ALL";

    if (isWeeklyOff && !filters.weeklyHolidays) return false;
    if (isNationalHoliday && !filters.nationalHolidays) return false;
    if (isStateHoliday && !filters.stateHolidays) return false;
    if (!isWeeklyOff && !isNationalHoliday && !isStateHoliday && !filters.publicHolidays) return false;

    return true;
  });

  // Get holidays for each day
  const getHolidaysForDay = (day: Date): HolidayItem[] => {
    return filteredHolidays.filter((h) =>
      isSameDay(parseISO(h.holiday_date), day)
    );
  };

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-background">
      {/* Header with day names */}
      <div className="flex border-b border-border flex-shrink-0 bg-card/50">
        <div className={`${isMobile ? "w-12" : "w-20"} border-r border-border flex-shrink-0`} /> {/* Time column space */}
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`flex-1 border-r border-border last:border-r-0 ${isMobile ? "px-0.5 py-1" : "px-1 py-1"} text-center`}
          >
            <div className={`font-semibold text-muted-foreground uppercase ${isMobile ? "text-[8px] sm:text-[10px]" : "text-[11px]"}`}>
              {format(day, isMobile ? "E" : "EEE")}
            </div>
            <div className={`font-bold leading-tight ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"} ${isMobile ? "text-base sm:text-sm" : "text-sm"}`}>
              {format(day, "d")}
            </div>
            {getHolidaysForDay(day).length > 0 && (
              <div className={`text-orange-600 dark:text-orange-400 font-medium ${isMobile ? "text-[7px]" : "text-[9px]"}`}>
                {isMobile ? getHolidaysForDay(day).length : `${getHolidaysForDay(day).length} holiday`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Time labels */}
        <div className={`${isMobile ? "w-12" : "w-20"} border-r border-border flex-shrink-0 bg-secondary/50`}>
          {hours.map((hour) => (
            <div
              key={hour}
              className={`flex-1 flex items-center justify-center text-muted-foreground font-medium border-b border-border/50 ${isMobile ? "text-[9px] px-0.5" : "text-xs px-1"}`}
              style={{ minHeight: isMobile ? "50px" : `${100 / hours.length}%` }}
            >
              <span className={isMobile ? "text-[8px]" : ""}>
                {hour % 12 === 0 ? 12 : hour % 12}
                <span className={isMobile ? "text-[7px]" : ""}>{hour >= 12 ? "p" : "a"}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 border-r border-border last:border-r-0 relative flex flex-col"
            >
              {/* Time slots */}
              {hours.map((hour) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={`flex-1 border-b border-border/50 hover:bg-primary/5 transition-colors relative ${isMobile ? "min-h-[50px]" : ""}`}
                >
                  {/* Holiday block if exists */}
                  {getHolidaysForDay(day).length > 0 && hour === hours[0] && (
                    <div className={isMobile ? "absolute inset-1" : "absolute top-0.5 left-0.5 right-0.5"}>
                      {getHolidaysForDay(day).slice(0, 1).map((holiday) => (
                        <EventBlock
                          key={`${day.toISOString()}-${holiday.id}`}
                          holiday={holiday}
                          onClick={() => onEventClick(holiday, day)}
                          isFullDay={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
