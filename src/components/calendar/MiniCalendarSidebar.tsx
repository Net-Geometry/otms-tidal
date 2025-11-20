import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  if (!isOpen) {
    return (
      <div className="w-14 border-r border-border flex flex-col items-center py-4 gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle?.(true)}
          className="h-8 w-8"
          title="Open calendar sidebar"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border flex flex-col gap-4 p-4">
      {/* Toggle Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle?.(false)}
          className="h-8 w-8"
          title="Close calendar sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Mini Calendar */}
      <div className="border border-border rounded-lg p-3 bg-card">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <h3 className="text-sm font-semibold text-foreground">
            {format(displayMonth, "MMMM yyyy")}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month start */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Month days */}
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "aspect-square rounded-md text-xs font-medium transition-colors flex items-center justify-center relative",
                isSelected(day)
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                  : hasHoliday(day)
                    ? "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800"
                    : "text-foreground hover:bg-secondary"
              )}
            >
              {format(day, "d")}
              {hasHoliday(day) && !isSelected(day) && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-600 dark:bg-orange-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 text-xs h-8"
          onClick={() => {
            const today = new Date();
            setDisplayMonth(today);
            onDateSelect(today);
          }}
        >
          Today
        </Button>
      </div>
    </div>
  );
}
