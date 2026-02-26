import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  parseISO,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHRCalendarView, type HRCalendarEvent } from '@/hooks/hr/useHRCalendarView';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Style map                                                          */
/* ------------------------------------------------------------------ */

const STYLE = {
  holiday: {
    dot: 'bg-emerald-400',
    pill: 'border-l-2 border-l-emerald-500/80 bg-emerald-500/10 text-emerald-300',
    tag: 'bg-emerald-500/15 text-emerald-400',
    label: 'Holiday',
  },
  leave: {
    dot: 'bg-sky-400',
    pill: 'border-l-2 border-l-sky-500/80 bg-sky-500/10 text-sky-300',
    tag: 'bg-sky-500/15 text-sky-400',
    label: 'Leave',
  },
  birthday: {
    dot: 'bg-amber-400',
    pill: 'border-l-2 border-l-amber-500/80 bg-amber-500/10 text-amber-300',
    tag: 'bg-amber-500/15 text-amber-400',
    label: 'Birthday',
  },
} as const;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HRCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const { data: rawEvents = [], isLoading } = useHRCalendarView(year);

  /* ---- Deduplicate same-name events on same date ---- */
  const events = useMemo(() => {
    const seen = new Map<string, HRCalendarEvent>();
    for (const e of rawEvents) {
      const key = `${e.date}::${e.title}`;
      if (!seen.has(key)) seen.set(key, e);
    }
    return Array.from(seen.values());
  }, [rawEvents]);

  /* ---- Calendar grid helpers ---- */
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);
  const totalCells = leadingBlanks + days.length;
  const trailingBlanks = (7 - (totalCells % 7)) % 7;

  /* ---- Events grouped by date ---- */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, HRCalendarEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || [];
  }, [selectedDate, eventsByDate]);

  /* ---- Month stats ---- */
  const stats = useMemo(() => {
    const out = { holiday: 0, leave: 0, birthday: 0 };
    for (const e of events) {
      if (isSameMonth(parseISO(e.date), currentDate)) {
        out[e.type]++;
      }
    }
    return out;
  }, [events, currentDate]);

  /* ---- Upcoming events (next 5 from today) ---- */
  const upcoming = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return events
      .filter((e) => e.date >= todayStr && isSameMonth(parseISO(e.date), currentDate))
      .slice(0, 6);
  }, [events, currentDate]);

  /* ---------------------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading calendar...
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Legend with inline counts */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {(['holiday', 'leave', 'birthday'] as const).map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', STYLE[type].dot)} />
                <span>{STYLE[type].label}</span>
                <span
                  className={cn(
                    'tabular-nums font-medium',
                    type === 'holiday' && 'text-emerald-400',
                    type === 'leave' && 'text-sky-400',
                    type === 'birthday' && 'text-amber-400',
                  )}
                >
                  {stats[type]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Calendar grid ---- */}
        <div className="rounded-lg border border-border/40 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted/40">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  'py-2 text-center text-[11px] font-medium uppercase tracking-widest',
                  i === 0 || i === 6
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground/70',
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div
                key={`lb-${i}`}
                className="min-h-[88px] border-b border-r border-border/20 bg-muted/10"
              />
            ))}

            {/* actual days */}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate.get(dateStr) || [];
              const today = isToday(day);
              const selected = isSameDay(day, selectedDate);
              const weekend = getDay(day) === 0 || getDay(day) === 6;

              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDate(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedDate(day);
                  }}
                  className={cn(
                    'min-h-[88px] p-1.5 border-b border-r border-border/20 transition-colors cursor-pointer group',
                    weekend && 'bg-muted/5',
                    selected && 'bg-primary/[0.06] ring-1 ring-inset ring-primary/25',
                    !selected && 'hover:bg-muted/20',
                  )}
                >
                  {/* Day number + overflow count */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium transition-colors',
                        today && 'bg-primary text-primary-foreground',
                        !today && weekend && 'text-muted-foreground/50',
                        !today && !weekend && 'text-foreground/80 group-hover:text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums pr-0.5">
                        +{dayEvents.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Event pills (max 2) */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <Tooltip key={event.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'text-[10px] leading-snug pl-1.5 pr-1 py-[3px] rounded-[3px] truncate',
                              STYLE[event.type].pill,
                            )}
                          >
                            {event.title}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[220px]">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-muted-foreground">
                            {format(parseISO(event.date), 'EEEE, d MMM')} &middot;{' '}
                            {STYLE[event.type].label}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* trailing blanks */}
            {Array.from({ length: trailingBlanks }).map((_, i) => (
              <div
                key={`tb-${i}`}
                className="min-h-[88px] border-b border-r border-border/20 bg-muted/10"
              />
            ))}
          </div>
        </div>

        {/* ---- Bottom panels ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Selected day detail (wider) */}
          <div className="lg:col-span-3 rounded-lg border border-border/40 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">
                  {format(selectedDate, 'EEEE, d MMMM')}
                </h4>
                {isToday(selectedDate) && (
                  <span className="text-[10px] uppercase tracking-wider font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Today
                  </span>
                )}
              </div>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground/60">No events</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        STYLE[event.type].dot,
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{event.title}</p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded shrink-0',
                        STYLE[event.type].tag,
                      )}
                    >
                      {STYLE[event.type].label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming events (narrower) */}
          <div className="lg:col-span-2 rounded-lg border border-border/40 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
              <h4 className="text-sm font-medium">Upcoming</h4>
            </div>

            {upcoming.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground/60">Nothing upcoming</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {upcoming.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedDate(parseISO(event.date))}
                    className="flex items-center gap-2.5 px-4 py-2 w-full text-left hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-[11px] tabular-nums text-muted-foreground/70 w-10 shrink-0">
                      {format(parseISO(event.date), 'dd/MM')}
                    </span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        STYLE[event.type].dot,
                      )}
                    />
                    <span className="text-sm truncate">{event.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
