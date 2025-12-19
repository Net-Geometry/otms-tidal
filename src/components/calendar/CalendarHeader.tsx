import { useState, useEffect } from "react";
import { format, addDays, addMonths, startOfWeek, setMonth, setYear, getDaysInMonth } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  viewMode: "week" | "day" | "month";
  onViewModeChange: (mode: "week" | "day" | "month") => void;
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

  const handleMonthChange = (monthValue: string) => {
    const monthIndex = parseInt(monthValue) - 1; // Convert 1-12 to 0-11
    const newDate = setMonth(selectedDate, monthIndex);

    // Preserve day, or use last day of month if target month has fewer days
    const daysInNewMonth = getDaysInMonth(newDate);
    if (selectedDate.getDate() > daysInNewMonth) {
      const lastDayDate = new Date(newDate.getFullYear(), monthIndex + 1, 0);
      onDateChange(lastDayDate);
    } else {
      onDateChange(newDate);
    }
  };

  const handleYearChange = (yearValue: string) => {
    const newDate = setYear(selectedDate, parseInt(yearValue));

    // Preserve day, or use last day of month if February has fewer days
    const daysInNewMonth = getDaysInMonth(newDate);
    if (selectedDate.getDate() > daysInNewMonth) {
      const lastDayDate = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0);
      onDateChange(lastDayDate);
    } else {
      onDateChange(newDate);
    }
  };

  const getDateLabel = () => {
    if (viewMode === "month") {
      // Month view format
      return isMobile
        ? format(selectedDate, "MMM yyyy")
        : format(selectedDate, "MMMM yyyy");
    }
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
      <div className={`flex items-center gap-2 ${isMobile ? "w-full justify-center" : ""}`}>
        <Select value={(selectedDate.getMonth() + 1).toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className={`border-border focus:border-primary focus:ring-primary ${isMobile ? "w-[100px]" : "w-[140px]"}`}>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent className="z-50">
            {MONTHS.map((month, index) => (
              <SelectItem key={index} value={(index + 1).toString()}>
                {isMobile ? month.slice(0, 3) : month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
          <SelectTrigger className={`border-border focus:border-primary focus:ring-primary ${isMobile ? "w-[90px]" : "w-[110px]"}`}>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="z-50">
            {Array.from({ length: 11 }, (_, i) => selectedDate.getFullYear() - 5 + i).map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("month")}
            className={`${isMobile ? "h-8 text-xs px-3" : "h-6 text-xs px-2"}`}
          >
            {isMobile ? "M" : "Month"}
          </Button>
        </div>
      </div>
    </div>
  );
}
