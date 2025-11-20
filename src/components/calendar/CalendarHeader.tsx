import { useState } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: "week" | "day";
  onViewModeChange: (mode: "week" | "day") => void;
}

export function CalendarHeader({
  selectedDate,
  onDateChange,
  viewMode,
  onViewModeChange,
}: CalendarHeaderProps) {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handlePrevious = () => {
    const offset = viewMode === "week" ? -7 : -1;
    onDateChange(addDays(selectedDate, offset));
  };

  const handleNext = () => {
    const offset = viewMode === "week" ? 7 : 1;
    onDateChange(addDays(selectedDate, offset));
  };

  const getDateLabel = () => {
    if (viewMode === "week") {
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(selectedDate, "EEEE, MMMM d, yyyy");
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          onClick={handleToday}
          className="text-xs h-7 px-2"
          size="sm"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className="h-7 w-7"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-foreground text-center truncate">
          {getDateLabel()}
        </h2>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex gap-0.5 bg-secondary rounded-md p-0.5">
          <Button
            variant={viewMode === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("day")}
            className="h-6 text-xs px-2"
          >
            Day
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("week")}
            className="h-6 text-xs px-2"
          >
            Week
          </Button>
        </div>
      </div>
    </div>
  );
}
