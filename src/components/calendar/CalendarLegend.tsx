import { Card } from "@/components/ui/card";

export function CalendarLegend() {
  return (
    <Card className="p-6 rounded-xl shadow-md bg-card border border-border">
      <div className="flex flex-wrap gap-8 items-center justify-center text-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FEE2E2] to-[#FECACA] dark:from-[#7F1D1D] dark:to-[#991B1B] border border-red-200 dark:border-red-800 shadow-sm" />
          <span className="text-foreground font-medium">Public Holiday</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E0E7FF] to-[#C7D2FE] dark:from-[#312E81] dark:to-[#3730A3] border border-indigo-200 dark:border-indigo-800 shadow-sm" />
          <span className="text-foreground font-medium">Weekly Holiday</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] dark:from-[#54340E] dark:to-[#78350F] border border-yellow-200 dark:border-yellow-800 shadow-sm" />
          <span className="text-foreground font-medium">State Holiday</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border-2 border-[#A78BFA] dark:border-[#C4B5FD] shadow-sm bg-card" />
          <span className="text-foreground font-medium">Today</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border-2 border-[#C4B5FD] dark:border-[#A78BFA] shadow-sm bg-card" />
          <span className="text-foreground font-medium">Selected</span>
        </div>
      </div>
    </Card>
  );
}
