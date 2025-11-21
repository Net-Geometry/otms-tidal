interface TimeSlotHeaderProps {
  startHour?: number;
  endHour?: number;
}

export function TimeSlotHeader({ startHour = 8, endHour = 19 }: TimeSlotHeaderProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="relative">
      {/* Time labels */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-background border-r border-border">
        {hours.map((hour) => (
          <div
            key={hour}
            className="h-24 flex items-start justify-end pr-2 pt-0.5 text-xs text-muted-foreground font-medium"
          >
            {hour % 12 === 0 ? 12 : hour % 12}{hour >= 12 ? "PM" : "AM"}
          </div>
        ))}
      </div>

      {/* Grid lines */}
      <div className="ml-16">
        {hours.map((hour) => (
          <div
            key={`line-${hour}`}
            className="h-24 border-b border-border/50"
          />
        ))}
      </div>
    </div>
  );
}
