import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HolidayItemsTable, HolidayItem } from '@/components/hr/calendar/HolidayItemsTable';
import { WeeklyOffSelector } from '@/components/hr/calendar/WeeklyOffSelector';
import { StateHolidayGenerator } from '@/components/hr/calendar/StateHolidayGenerator';
import { ReplacementHolidayManager } from '@/components/hr/calendar/ReplacementHolidayManager';
import { EmployeeLeavePanel } from '@/components/hr/calendar/EmployeeLeavePanel';
import { useHolidayCalendar } from '@/hooks/hr/useHolidayCalendar';
import { useUpdateHolidayCalendar } from '@/hooks/hr/useUpdateHolidayCalendar';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarIcon, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EditHolidayCalendar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: calendar, isLoading, error } = useHolidayCalendar(id);
  const { mutate: updateCalendar, isPending } = useUpdateHolidayCalendar();

  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [originalItems, setOriginalItems] = useState<HolidayItem[]>([]);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([]);

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setYear(calendar.year);
      setDateFrom(calendar.date_from);
      setDateTo(calendar.date_to);
      setItems(calendar.items || []);
      setOriginalItems(calendar.items || []);
    }
  }, [calendar]);

  const totalHolidays = items.length;

  const handleWeeklyOffsGenerate = (dates: string[]) => {
    const newItems = dates.map(date => ({
      holiday_date: date,
      description: 'Weekly Off',
      state_code: null,
      temp_id: `temp-${Date.now()}-${Math.random()}`,
    }));

    const merged = [...items, ...newItems];
    const unique = merged.filter((item, index, self) =>
      index === self.findIndex(t => t.holiday_date === item.holiday_date)
    );
    
    setItems(unique);
    toast.success(`Added ${dates.length} weekly offs`);
  };

  const handleRemoveWeeklyOffs = (dates: string[]) => {
    const removeSet = new Set(dates);
    const before = items.length;
    const next = items.filter(i => !(i.description === 'Weekly Off' && removeSet.has(i.holiday_date)));
    setItems(next);
    const removed = before - next.length;
    if (removed > 0) {
      toast.success(`Removed ${removed} weekly off${removed !== 1 ? 's' : ''}`);
    } else {
      toast.info('No matching weekly offs found to remove');
    }
  };

  const handleStateHolidaysGenerate = (holidays: Array<{ holiday_date: string; description: string; state_code: string }>) => {
    const newItems = holidays.map(h => ({
      ...h,
      temp_id: `temp-${Date.now()}-${Math.random()}`,
    }));

    const merged = [...items, ...newItems];
    const unique = merged.filter((item, index, self) =>
      index === self.findIndex(t => 
        t.holiday_date === item.holiday_date && 
        t.description === item.description &&
        (t.state_code || '') === (item.state_code || '')
      )
    );
    
    setItems(unique);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!id) return;

    if (!name.trim()) {
      toast.error('Please enter a calendar name');
      return;
    }

    if (!dateFrom || !dateTo) {
      toast.error('Please select date range');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      toast.error('Date from must be before date to');
      return;
    }

    // Find removed items
    const removedItemIds = originalItems
      .filter(original => original.id && !items.find(item => item.id === original.id))
      .map(item => item.id!);

    updateCalendar(
      {
        id,
        name,
        year,
        date_from: dateFrom,
        date_to: dateTo,
        total_holidays: totalHolidays,
        items: items.map(({ temp_id, ...item }) => item),
        removedItemIds,
      },
      {
        onSuccess: () => {
          navigate('/hr/calendar');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load holiday calendar. Please try again.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Edit Holiday Calendar
            </h1>
            <p className="text-muted-foreground mt-1">
              Update holiday calendar details
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/hr/calendar')}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Holiday List Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2026 Johor Calendar"
            />
          </div>
          <div className="space-y-2">
            <Label>Total Holidays</Label>
            <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
              <Badge variant="secondary" className="text-lg">
                {totalHolidays}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-from">From Date *</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">To Date *</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <Accordion type="multiple" className="space-y-4">
          <AccordionItem value="weekly" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <span className="text-lg font-semibold">Add Weekly Holidays</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
                <WeeklyOffSelector
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  selectedDays={weeklyOffDays}
                  onSelectionChange={setWeeklyOffDays}
                  onGenerate={handleWeeklyOffsGenerate}
                  onRemove={handleRemoveWeeklyOffs}
                />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="state" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <span className="text-lg font-semibold">Add Local Holidays</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <StateHolidayGenerator
                year={year}
                onGenerate={handleStateHolidaysGenerate}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="replacement" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <span className="text-lg font-semibold">Replacement Holidays (Cuti Ganti)</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <ReplacementHolidayManager initialYear={year} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="leave" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <span className="text-lg font-semibold">Employee Leave (Display Only)</span>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <EmployeeLeavePanel year={year} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Holidays</h2>
          <HolidayItemsTable items={items} onRemove={handleRemoveItem} />
        </div>
      </div>
    </AppLayout>
  );
}
