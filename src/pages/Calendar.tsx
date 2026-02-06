import { useEffect, useMemo, useState } from "react";
import { isSameDay, parseISO } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { TimeGridView } from "@/components/calendar/TimeGridView";
import { MonthlyGridView } from "@/components/calendar/MonthlyGridView";
import { EventTypeFilter, type EventTypeFilters } from "@/components/calendar/EventTypeFilter";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { ManageHolidaysPanel } from "@/components/calendar/ManageHolidaysPanel";
import { StatePreviewSelector, type StatePreviewValue } from "@/components/calendar/StatePreviewSelector";
import { useHolidayCalendarView } from "@/hooks/useHolidayCalendarView";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day" | "month">("month");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventFilters, setEventFilters] = useState<EventTypeFilters>({
    public: true,
    state: true,
    company: true,
    leave: true,
  });

  const isMobile = useMediaQuery("(max-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { profile } = useAuth();
  const { hasRole } = useAuth();

  const canManage = hasRole("hr") || hasRole("admin");
  const [statePreview, setStatePreview] = useState<StatePreviewValue>("AUTO");

  const effectiveState = useMemo(() => {
    if (!canManage) return profile?.state;
    if (statePreview === "AUTO") return profile?.state;
    return statePreview;
  }, [canManage, profile?.state, statePreview]);

  const { data: holidays, isLoading, error } = useHolidayCalendarView(effectiveState);

  const visibleHolidays = useMemo(() => {
    return (holidays || []).filter((h) => {
      const source = h.event_source;
      const isLeave = source === 'leave' || h.is_personal_leave;
      if (isLeave) return eventFilters.leave;
      if (source === 'company') return eventFilters.company;
      if (h.state_code === 'ALL') return eventFilters.public;
      return eventFilters.state;
    });
  }, [eventFilters, holidays]);

  const selectedHolidays = useMemo(() => {
    return visibleHolidays.filter((h) => isSameDay(parseISO(h.holiday_date), selectedDate));
  }, [selectedDate, visibleHolidays]);

  // Close sidebar on mobile automatically
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const handleEventClick = (_holiday: unknown, date: Date) => {
    setSelectedDate(date);
    if (isMobile) setSidebarOpen(true);
  };

  const handleMonthDateClick = (date: Date) => {
    setSelectedDate(date);
    if (isMobile) setSidebarOpen(true);
  };

  return (
    <AppLayout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header - Combined into single row */}
        <div className="border-b border-border flex-shrink-0 px-3 py-2">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#5F26B4] to-[#8B5CF6] bg-clip-text text-transparent">Calendar</h1>
            <CalendarHeader
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {canManage ? <ManageHolidaysPanel /> : <div className="w-8" />}
          </div>

          {/* Filters inline with header */}
          <div className="flex flex-col gap-2">
            <EventTypeFilter filters={eventFilters} onChange={setEventFilters} />
            {canManage && (
              <div className="flex items-center justify-between gap-2">
                <StatePreviewSelector value={statePreview} onChange={setStatePreview} />
                <div className="text-xs text-muted-foreground">
                  Previewing: {statePreview === 'AUTO' ? (profile?.state || 'N/A') : statePreview}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading calendar...</div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-destructive text-center">
              Failed to load calendar data. Please try again later.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex">
            <div className="flex-1 overflow-hidden">
              {viewMode === "month" ? (
                <MonthlyGridView
                  selectedDate={selectedDate}
                  holidays={visibleHolidays}
                  filters={eventFilters}
                  onDateClick={handleMonthDateClick}
                  onEventClick={handleEventClick}
                />
              ) : (
                <TimeGridView
                  viewMode={viewMode}
                  selectedDate={selectedDate}
                  holidays={visibleHolidays}
                  filters={eventFilters}
                  onEventClick={handleEventClick}
                  startHour={9}
                  endHour={19}
                />
              )}
            </div>

            {isDesktop && (
              <div className="w-[380px] border-l bg-background">
                <CalendarSidebar
                  selectedDate={selectedDate}
                  holidays={selectedHolidays}
                  canManage={canManage}
                />
              </div>
            )}

            {!isDesktop && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="bottom" className="max-h-[80vh] p-0">
                  <SheetHeader className="px-4 pt-4">
                    <SheetTitle>Details</SheetTitle>
                  </SheetHeader>
                  <div className="h-[70vh]">
                    <CalendarSidebar
                      selectedDate={selectedDate}
                      holidays={selectedHolidays}
                      canManage={canManage}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
