import { useState, useEffect } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const isMobile = useIsMobile();
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
    if (isMobile) {
      // Shorter format on mobile
      if (viewMode === "week") {
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "d")}`;
      }
      return format(selectedDate, "MMM d, yyyy");
    }
    if (viewMode === "week") {
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(selectedDate, "EEEE, MMMM d, yyyy");
  };

  return (
    <div className={`flex items-center justify-between gap-2 py-2 flex-wrap ${isMobile ? "gap-3" : ""}`}>
      <div className={`flex items-center ${isMobile ? "gap-2 h-10" : "gap-1"}`}>
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          className={isMobile ? "h-10 w-10" : "h-7 w-7"}
        >
          <ChevronLeft className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
        </Button>
        {!isMobile && (
          <Button
            variant="outline"
            onClick={handleToday}
            className={`text-xs h-7 px-2`}
            size="sm"
          >
            Today
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className={isMobile ? "h-10 w-10" : "h-7 w-7"}
        >
          <ChevronRight className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
        </Button>
      </div>

      <div className={`flex-1 min-w-0 ${isMobile ? "flex-basis-100 order-3 w-full" : ""}`}>
        <h2 className={`font-semibold text-foreground text-center truncate ${isMobile ? "text-xs" : "text-sm"}`}>
          {getDateLabel()}
        </h2>
      </div>

      <div className={`flex items-center ${isMobile ? "h-10" : ""}`}>
        <div className={`flex ${isMobile ? "gap-1 bg-secondary rounded-md p-1" : "gap-0.5 bg-secondary rounded-md p-0.5"}`}>
          <Button
            variant={viewMode === "day" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("day")}
            className={`${isMobile ? "h-8 text-xs px-3" : "h-6 text-xs px-2"}`}
          >
            {isMobile ? "D" : "Day"}
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("week")}
            className={`${isMobile ? "h-8 text-xs px-3" : "h-6 text-xs px-2"}`}
          >
            {isMobile ? "W" : "Week"}
          </Button>
        </div>
      </div>
    </div>
  );
}
