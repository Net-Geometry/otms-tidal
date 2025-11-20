import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  compact?: boolean;
};

function Calendar({ className, classNames, showOutsideDays = true, compact = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: compact ? "space-y-3" : "space-y-3",
        caption: compact
          ? "flex justify-center pt-1 relative items-center mb-3 pb-2 border-b border-border"
          : "flex justify-center pt-1 relative items-center mb-6",
        caption_label: compact
          ? "text-sm font-semibold text-foreground"
          : "text-xl font-semibold text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: compact
          ? cn(
              buttonVariants({ variant: "ghost" }),
              "h-[26px] w-[26px] bg-secondary hover:bg-primary hover:text-primary-foreground text-primary border-0 rounded-md transition-all duration-200 p-0"
            )
          : cn(
              buttonVariants({ variant: "outline" }),
              "h-10 w-10 bg-card hover:bg-gradient-to-r hover:from-primary hover:to-primary hover:text-primary-foreground border-border hover:border-transparent transition-all duration-200"
            ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: compact ? "flex gap-1 mb-2" : "flex gap-2 mb-2",
        head_cell: compact
          ? "text-muted-foreground font-semibold text-[11px] flex-1 text-center py-1 tracking-[0.3px]"
          : "text-muted-foreground font-semibold text-sm flex-1 text-center",
        row: compact ? "flex w-full gap-1 mb-1" : "flex w-full gap-2 mb-2",
        cell: "flex-1 text-center text-base p-0 relative",
        day: compact
          ? "h-[34px] w-full p-0 font-medium text-[13px] text-foreground border-0 rounded-md hover:bg-secondary hover:text-primary transition-all duration-200 aria-selected:opacity-100 bg-transparent"
          : "h-12 w-full p-2 font-medium border border-border rounded-lg hover:scale-105 hover:shadow-[0_0_10px_rgba(95,38,180,0.15)] transition-all duration-200 aria-selected:opacity-100 bg-card text-sm",
        day_range_end: "day-range-end",
        day_selected: compact
          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold"
          : "ring-2 ring-primary/30 bg-primary/10 dark:bg-primary/20",
        day_today: compact
          ? "border border-primary bg-primary/10 text-primary font-semibold"
          : "ring-2 ring-primary/30 bg-primary/10 dark:bg-primary/20",
        day_outside:
          "day-outside text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className={compact ? "h-3 w-3" : "h-4 w-4"} />,
        IconRight: ({ ..._props }) => <ChevronRight className={compact ? "h-3 w-3" : "h-4 w-4"} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
