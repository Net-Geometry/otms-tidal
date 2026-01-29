import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CalendarFormTabsProps {
  basicInfo: ReactNode;
  weekly: ReactNode;
  local: ReactNode;
  replacement: ReactNode;
  leave: ReactNode;
  sidebar: ReactNode;
  actions?: ReactNode;
  className?: string;
  defaultValue?: string;
}

export function CalendarFormTabs({ 
  basicInfo, 
  weekly, 
  local, 
  replacement, 
  leave, 
  sidebar,
  actions,
  className,
  defaultValue = "basic"
}: CalendarFormTabsProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]", className)}>
      <Tabs defaultValue={defaultValue} className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <TabsList className="justify-start h-auto flex-wrap p-1 w-full sm:w-auto">
            <TabsTrigger value="basic" className="px-4 py-2">Basic Info</TabsTrigger>
            <TabsTrigger value="weekly" className="px-4 py-2">Generate Weekly Offs</TabsTrigger>
            <TabsTrigger value="local" className="px-4 py-2">Generate State Holidays</TabsTrigger>
            <TabsTrigger value="replacement" className="px-4 py-2">Replacement Days</TabsTrigger>
            <TabsTrigger value="leave" className="px-4 py-2">Leave (View Only)</TabsTrigger>
          </TabsList>
          {actions && <div className="shrink-0 ml-auto">{actions}</div>}
        </div>
        
        <div className="flex-1 border rounded-lg p-6 overflow-y-auto bg-card relative">
          <TabsContent value="basic" className="mt-0 h-full">{basicInfo}</TabsContent>
          <TabsContent value="weekly" className="mt-0 h-full">{weekly}</TabsContent>
          <TabsContent value="local" className="mt-0 h-full">{local}</TabsContent>
          <TabsContent value="replacement" className="mt-0 h-full">{replacement}</TabsContent>
          <TabsContent value="leave" className="mt-0 h-full">{leave}</TabsContent>
        </div>
      </Tabs>
      
      <div className="w-full lg:w-80 shrink-0 h-full lg:h-auto">
        {sidebar}
      </div>
    </div>
  );
}
