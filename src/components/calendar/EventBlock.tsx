import { format, isToday } from "date-fns";
import { HolidayItem } from "@/hooks/useHolidayCalendarView";
import { cn } from "@/lib/utils";

interface EventBlockProps {
  holiday: HolidayItem;
  onClick: () => void;
  isFullDay?: boolean;
}

export function EventBlock({ holiday, onClick, isFullDay = false }: EventBlockProps) {
  const isPersonalLeave = holiday.event_source === 'leave' || holiday.is_personal_leave;
  const isReplacement = Boolean(holiday.is_replacement) || holiday.description.toLowerCase().includes('cuti ganti');
  const isWeeklyOff = holiday.description.toLowerCase().includes("weekly off");
  const isNationalHoliday = holiday.state_code === "ALL";
  const isStateHoliday = holiday.state_code && holiday.state_code !== "ALL";

  const colorClasses = isPersonalLeave
    ? "from-emerald-500 to-emerald-600 border-emerald-400 dark:border-emerald-500"
    : isWeeklyOff
      ? "from-indigo-500 to-indigo-600 border-indigo-400 dark:border-indigo-500"
      : isNationalHoliday
        ? "from-orange-500 to-orange-600 border-orange-400 dark:border-orange-500"
        : isStateHoliday
          ? "from-yellow-500 to-yellow-600 border-yellow-400 dark:border-yellow-500"
          : "from-red-500 to-red-600 border-red-400 dark:border-red-500";

  const textClass = "text-white dark:text-white";

  if (isFullDay) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full px-2 py-1 rounded-md text-xs font-semibold transition-all duration-200",
          "bg-gradient-to-r", colorClasses,
          textClass,
          "hover:shadow-md hover:scale-[1.02] cursor-pointer"
        )}
      >
        <div className="truncate">{holiday.description}</div>
        {isReplacement && !isPersonalLeave && (
          <div className="text-[10px] opacity-90">Cuti Ganti</div>
        )}
        {isPersonalLeave && holiday.leave_status && (
          <div className="text-[10px] opacity-90">{holiday.leave_status}</div>
        )}
        {holiday.state_code && holiday.state_code !== "ALL" && (
          <div className="text-[10px] opacity-80">{holiday.state_code}</div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute left-0 right-0 mx-0.5 rounded-md px-2 py-1 text-xs font-semibold",
        "bg-gradient-to-r", colorClasses,
        textClass,
        "hover:shadow-lg hover:z-20 cursor-pointer transition-all duration-200",
        "border border-opacity-50"
      )}
      title={`${holiday.description}${isReplacement && !isPersonalLeave ? ' (Cuti Ganti)' : ''} - Click for details`}
    >
      <div className="truncate">{holiday.description}</div>
      {isReplacement && !isPersonalLeave && (
        <div className="text-[10px] opacity-90 truncate">(Cuti Ganti)</div>
      )}
      {isPersonalLeave && holiday.leave_status && (
        <div className="text-[10px] opacity-90 truncate">({holiday.leave_status})</div>
      )}
      {holiday.state_code && holiday.state_code !== "ALL" && (
        <div className="text-[10px] opacity-80 truncate">({holiday.state_code})</div>
      )}
    </button>
  );
}
