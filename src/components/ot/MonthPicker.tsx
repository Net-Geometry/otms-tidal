import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface MonthPickerProps {
  selectedMonth: Date | undefined;
  onMonthChange: (date: Date | undefined) => void;
}

export function MonthPicker({ selectedMonth, onMonthChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-start text-sm"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedMonth ? format(selectedMonth, 'MMMM yyyy') : 'Select month...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedMonth}
          onSelect={(date) => {
            onMonthChange(date);
            setOpen(false);
          }}
          defaultMonth={selectedMonth || new Date()}
          disabled={(date) => date > new Date()}
          className="pointer-events-auto"
        />
        <div className="text-center text-xs text-muted-foreground px-3 py-2 border-t">
          Select a month to filter OT history
        </div>
      </PopoverContent>
    </Popover>
  );
}
