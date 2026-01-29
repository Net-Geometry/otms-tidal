import { useState, useEffect } from "react";
import { isSameDay, parseISO, addDays, addMonths } from "date-fns";
import { Link } from "react-router-dom";
import { Edit } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MiniCalendarSidebar } from "@/components/calendar/MiniCalendarSidebar";
import { TimeGridView } from "@/components/calendar/TimeGridView";
import { MonthlyGridView } from "@/components/calendar/MonthlyGridView";
import { EventTypeFilter, type EventTypeFilters } from "@/components/calendar/EventTypeFilter";
import { HolidayDetailsSheet } from "@/components/calendar/HolidayDetailsSheet";
import { useHolidayCalendarView } from "@/hooks/useHolidayCalendarView";
import { useAuth } from "@/hooks/useAuth";
import { useActiveHolidayCalendar } from "@/hooks/hr/useActiveHolidayCalendar";
import { useEmployeeCalendarAssignment } from "@/hooks/hr/useEmployeeCalendarAssignment";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day" | "month">("week");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [eventFilters, setEventFilters] = useState<EventTypeFilters>({
    publicHolidays: true,
    nationalHolidays: true,
    weeklyHolidays: true,
    stateHolidays: true,
    personalLeave: true,
    replacementHolidays: true,
  });

  const isMobile = useMediaQuery("(max-width: 768px)");
  const { user, profile } = useAuth();
  const { hasRole } = useAuth();

  // Get the employee's assigned calendar (auto-matched to location or manually assigned)
  const { data: assignedCalendar, isLoading: isAssignmentLoading } = useEmployeeCalendarAssignment(user?.id);

  // For HR/admin, also show the active calendar option
  const { data: activeCalendar, isLoading: isCalendarLoading } = useActiveHolidayCalendar();

  // Use employee's assigned calendar, or fall back to active calendar for admin
  const calendarToUse = assignedCalendar?.calendar_id || activeCalendar?.id;

  // Get user's state from profile for filtering state-specific holidays
  const userState = profile?.state;

  const { data: holidays, isLoading, error } = useHolidayCalendarView(calendarToUse, userState);

  // Get dates with holidays for navigation and mini calendar
  const datesWithHolidays = holidays?.map(h => parseISO(h.holiday_date)) || [];

  const selectedHolidays = holidays?.filter(h =>
    isSameDay(parseISO(h.holiday_date), selectedDate)
  ) || [];

  // Close sidebar on mobile automatically
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const findPreviousHolidayDate = (currentDate: Date): Date | null => {
    let checkDate = addDays(currentDate, -1);
    while (checkDate > addDays(new Date(), -365)) {
      if (datesWithHolidays.some(d => isSameDay(d, checkDate))) {
        return checkDate;
      }
      checkDate = addDays(checkDate, -1);
    }
    return null;
  };

  const findNextHolidayDate = (currentDate: Date): Date | null => {
    let checkDate = addDays(currentDate, 1);
    while (checkDate < addDays(new Date(), 365)) {
      if (datesWithHolidays.some(d => isSameDay(d, checkDate))) {
        return checkDate;
      }
      checkDate = addDays(checkDate, 1);
    }
    return null;
  };

  const handlePreviousDay = () => {
    const previousDate = findPreviousHolidayDate(selectedDate);
    if (previousDate) {
      setSelectedDate(previousDate);
    }
  };

  const handleNextDay = () => {
    const nextDate = findNextHolidayDate(selectedDate);
    if (nextDate) {
      setSelectedDate(nextDate);
    }
  };

  const hasPreviousHolidays = findPreviousHolidayDate(selectedDate) !== null;
  const hasNextHolidays = findNextHolidayDate(selectedDate) !== null;

  const handleEventClick = (holiday: any, date: Date) => {
    setSelectedDate(date);
    setSelectedHoliday(holiday);
    setSheetOpen(true);
    // Switch to week view when clicking event from month view
    if (viewMode === "month") {
      setViewMode("week");
    }
  };

  const handleMonthDateClick = (date: Date) => {
    setSelectedDate(date);
    // Switch to week view when clicking a date from month view
    setViewMode("week");
  };

  return (
    <AppLayout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header - Combined into single row */}
        <div className="border-b border-border flex-shrink-0 px-3 py-2">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#5F26B4] to-[#8B5CF6] bg-clip-text text-transparent">
              Calendar
              {assignedCalendar && (
                <span className="text-xs text-muted-foreground font-normal block">
                  {assignedCalendar.calendar_name}
                </span>
              )}
            </h1>
            <CalendarHeader
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {(hasRole("hr") || hasRole("admin")) && activeCalendar && (
              <Button
                asChild
                disabled={isAssignmentLoading || isCalendarLoading}
                size="sm"
                className="bg-gradient-to-r from-[#5F26B4] to-[#8B5CF6] hover:from-[#4A1D8F] hover:to-[#7C3AED] shadow-[0_2px_8px_rgba(95,38,180,0.2)] transition-all duration-200 flex-shrink-0"
              >
                <Link to={`/hr/calendar/${activeCalendar.id}/edit`}>
                  <Edit className="mr-1 h-3 w-3" />
                  Edit
                </Link>
              </Button>
            )}
          </div>

          {/* Filters inline with header */}
          <EventTypeFilter filters={eventFilters} onChange={setEventFilters} />
        </div>

        {/* Main Content */}
        {isAssignmentLoading || isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading calendar...</div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-destructive text-center">
              Failed to load calendar data. Please try again later.
            </div>
          </div>
        ) : viewMode === "month" ? (
          <MonthlyGridView
            selectedDate={selectedDate}
            holidays={holidays || []}
            filters={eventFilters}
            onDateClick={handleMonthDateClick}
            onEventClick={handleEventClick}
          />
        ) : (
          <TimeGridView
            viewMode={viewMode}
            selectedDate={selectedDate}
            holidays={holidays || []}
            filters={eventFilters}
            onEventClick={handleEventClick}
            startHour={9}
            endHour={19}
          />
        )}

        {/* Holiday Details Sheet */}
        <HolidayDetailsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          selectedDate={selectedDate}
          holidays={selectedHoliday ? [selectedHoliday] : selectedHolidays}
          onPreviousDay={handlePreviousDay}
          onNextDay={handleNextDay}
          hasPreviousHolidays={hasPreviousHolidays}
          hasNextHolidays={hasNextHolidays}
        />
      </div>
    </AppLayout>
  );
}
