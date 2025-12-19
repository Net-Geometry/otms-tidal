import { format } from "date-fns";
import { CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HolidayItem } from "@/hooks/useHolidayCalendarView";

interface HolidayDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  holidays: HolidayItem[];
  onPreviousDay: () => void;
  onNextDay: () => void;
  hasPreviousHolidays: boolean;
  hasNextHolidays: boolean;
}

export function HolidayDetailsSheet({
  open,
  onOpenChange,
  selectedDate,
  holidays,
  onPreviousDay,
  onNextDay,
  hasPreviousHolidays,
  hasNextHolidays,
}: HolidayDetailsSheetProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const formattedDate = format(selectedDate, "MMMM do, yyyy");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[80vh]" : "sm:max-w-md overflow-y-auto"}
      >
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPreviousDay}
              disabled={!hasPreviousHolidays}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="text-base text-center flex-1">
              {formattedDate}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextDay}
              disabled={!hasNextHolidays}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {holidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-full mb-4">
                <CalendarX className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No Holidays</h3>
              <p className="text-sm text-muted-foreground">
                There are no holidays on this date.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {holidays.length} {holidays.length === 1 ? "Holiday" : "Holidays"}
              </p>
              <div className="space-y-3">
                {holidays.map((holiday) => {
                  const isWeeklyOff = holiday.description
                    .toLowerCase()
                    .includes("weekly off");
                  const isNationalHoliday = holiday.state_code === "ALL";
                  const isStateHoliday =
                    holiday.state_code && holiday.state_code !== "ALL";

                  const bgColor = isWeeklyOff
                    ? "from-indigo-100 dark:from-indigo-900 to-indigo-50 dark:to-indigo-800 border-indigo-200 dark:border-indigo-700"
                    : isNationalHoliday
                      ? "from-orange-100 dark:from-orange-900 to-orange-50 dark:to-orange-800 border-orange-200 dark:border-orange-700"
                      : isStateHoliday
                        ? "from-yellow-100 dark:from-yellow-900 to-yellow-50 dark:to-yellow-800 border-yellow-200 dark:border-yellow-700"
                        : "from-red-100 dark:from-red-900 to-pink-50 dark:to-red-800 border-red-200 dark:border-red-700";

                  const dotColor = isWeeklyOff
                    ? "from-indigo-500 to-indigo-600"
                    : isNationalHoliday
                      ? "from-orange-500 to-orange-600"
                      : isStateHoliday
                        ? "from-yellow-500 to-yellow-600"
                        : "from-red-500 to-red-600";

                  const badgeText = isWeeklyOff
                    ? "Weekly Holiday"
                    : isNationalHoliday
                      ? "National Holiday"
                      : isStateHoliday
                        ? `State Holiday (${holiday.state_code})`
                        : "Public Holiday";

                  return (
                    <div
                      key={holiday.id}
                      className={`flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r ${bgColor} border hover:shadow-md transition-shadow duration-200`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${dotColor} mt-1.5 flex-shrink-0 shadow-sm`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm break-words">
                          {holiday.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {badgeText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
