import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface MiniCalendarSidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  datesWithHolidays: Date[];
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export function MiniCalendarSidebar({
  selectedDate,
  onDateSelect,
  datesWithHolidays,
  isOpen = true,
  onToggle,
}: MiniCalendarSidebarProps) {
  const isMobile = useIsMobile();
  const [displayMonth, setDisplayMonth] = useState(selectedDate);

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const hasHoliday = (date: Date) => datesWithHolidays.some(d => isSameDay(d, date));
  const isSelected = (date: Date) => isSameDay(date, selectedDate);

  const handlePrevMonth = () => {
    setDisplayMonth(addMonths(displayMonth, -1));
  };

  const handleNextMonth = () => {
    setDisplayMonth(addMonths(displayMonth, 1));
  };

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // On mobile, hide sidebar by default and show only toggle
  if (isMobile && !isOpen) {
    return (
      <div className="hidden sm:flex h-full border-r border-border flex-col items-center py-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle?.(true)}
          className="h-10 w-10"
          title="Open calendar sidebar"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Hide entire sidebar on mobile when not explicitly opened
  if (isMobile && !isOpen) {
    return null;
  }

  return (
    <div className={`${isMobile ? "fixed inset-0 bg-background z-40 p-4 overflow-y-auto" : "w-64 border-r border-border"} flex flex-col gap-4 ${isMobile ? "" : "p-4"}`}>
      {/* Toggle Button - Only on mobile */}
      {isMobile && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Calendar</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle?.(false)}
            className="h-9 w-9"
            title="Close calendar sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Mini Calendar */}
      <div className={`border border-border rounded-lg ${isMobile ? "p-4" : "p-3"} bg-card`}>
        {/* Month Navigation */}
        <div className={`flex items-center justify-between mb-4 ${isMobile ? "gap-2" : ""}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className={isMobile ? "h-9 w-9" : "h-8 w-8"}
          >
            <ChevronLeft className={isMobile ? "h-5 w-5" : "h-3 w-3"} />
          </Button>
          <h3 className={`font-semibold text-foreground ${isMobile ? "text-base" : "text-sm"}`}>
            {format(displayMonth, isMobile ? "MMM yyyy" : "MMMM yyyy")}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className={isMobile ? "h-9 w-9" : "h-8 w-8"}
          >
            <ChevronRight className={isMobile ? "h-5 w-5" : "h-3 w-3"} />
          </Button>
        </div>

        {/* Week Days Header */}
        <div className={`grid grid-cols-7 gap-1 mb-2 ${isMobile ? "gap-2" : ""}`}>
          {weekDays.map((day) => (
            <div
              key={day}
              className={`text-center font-semibold text-muted-foreground ${isMobile ? "text-sm" : "text-xs"}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className={`grid grid-cols-7 gap-1 ${isMobile ? "gap-2" : ""}`}>
          {/* Empty cells for days before month start */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className={isMobile ? "h-10" : "aspect-square"} />
          ))}

          {/* Month days */}
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => {
                onDateSelect(day);
                // Close on mobile after selection
                if (isMobile) {
                  onToggle?.(false);
                }
              }}
              className={cn(
                `${isMobile ? "h-10 min-h-10" : "aspect-square"} rounded-md font-medium transition-colors flex items-center justify-center relative`,
                isMobile ? "text-sm" : "text-xs",
                isSelected(day)
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                  : hasHoliday(day)
                    ? "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800"
                    : "text-foreground hover:bg-secondary"
              )}
            >
              {format(day, "d")}
              {hasHoliday(day) && !isSelected(day) && (
                <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-orange-600 dark:bg-orange-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className={`flex-1 ${isMobile ? "h-10 text-sm" : "text-xs h-8"}`}
          onClick={() => {
            const today = new Date();
            setDisplayMonth(today);
            onDateSelect(today);
            if (isMobile) {
              onToggle?.(false);
            }
          }}
        >
          Today
        </Button>
      </div>
    </div>
  );
}
