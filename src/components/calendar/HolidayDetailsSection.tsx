import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarX } from "lucide-react";
import { HolidayItem } from "@/hooks/useHolidayCalendarView";

interface HolidayDetailsSectionProps {
  selectedDate: Date;
  holidays: HolidayItem[];
}

export function HolidayDetailsSection({ selectedDate, holidays }: HolidayDetailsSectionProps) {
  const formattedDate = format(selectedDate, "MMMM do, yyyy");

  return (
    <Card className="rounded-xl shadow-md bg-card border border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Holidays on {formattedDate}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-full mb-4">
              <CalendarX className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-2 text-lg">No Holidays</h3>
            <p className="text-sm text-muted-foreground">
              There are no public holidays on this date.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {holidays.map((holiday) => {
              const isWeeklyOff = holiday.description.toLowerCase().includes('weekly off');
              const isNationalHoliday = holiday.state_code === 'ALL';
              const isStateHoliday = holiday.state_code && holiday.state_code !== 'ALL';

              const bgColor = isWeeklyOff
                ? 'from-indigo-100 dark:from-indigo-900 to-indigo-50 dark:to-indigo-800 border-indigo-200 dark:border-indigo-700'
                : isNationalHoliday
                ? 'from-orange-100 dark:from-orange-900 to-orange-50 dark:to-orange-800 border-orange-200 dark:border-orange-700'
                : isStateHoliday
                ? 'from-yellow-100 dark:from-yellow-900 to-yellow-50 dark:to-yellow-800 border-yellow-200 dark:border-yellow-700'
                : 'from-red-100 dark:from-red-900 to-pink-50 dark:to-red-800 border-red-200 dark:border-red-700';

              const dotColor = isWeeklyOff
                ? 'from-indigo-500 to-indigo-600'
                : isNationalHoliday
                ? 'from-orange-500 to-orange-600'
                : isStateHoliday
                ? 'from-yellow-500 to-yellow-600'
                : 'from-red-500 to-red-600';

              return (
                <div key={holiday.id} className={`flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r ${bgColor} border hover:shadow-md transition-shadow duration-200`}>
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${dotColor} mt-1.5 flex-shrink-0 shadow-sm`} />
                  <div>
                    <p className="font-semibold text-foreground text-base">{holiday.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isWeeklyOff ? 'Weekly Holiday' : isNationalHoliday ? 'National Holiday' : isStateHoliday ? `State Holiday (${holiday.state_code})` : 'Public Holiday'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
