import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HolidayItemsTable, HolidayItem } from '@/components/hr/calendar/HolidayItemsTable';
import { WeeklyOffSelector } from '@/components/hr/calendar/WeeklyOffSelector';
import { StateHolidayGenerator } from '@/components/hr/calendar/StateHolidayGenerator';
import { ReplacementHolidayManager } from '@/components/hr/calendar/ReplacementHolidayManager';
import { EmployeeLeavePanel } from '@/components/hr/calendar/EmployeeLeavePanel';
import { useHolidayCalendar } from '@/hooks/hr/useHolidayCalendar';
import { useUpdateHolidayCalendar } from '@/hooks/hr/useUpdateHolidayCalendar';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CalendarIcon, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { CalendarFormTabs } from '@/components/hr/calendar/CalendarFormTabs';
import { HolidayPreviewSidebar } from '@/components/hr/calendar/HolidayPreviewSidebar';
import { CalendarValidation, UnsavedIndicator, getValidationIssues } from '@/components/hr/calendar/CalendarValidation';

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
  const [initialState, setInitialState] = useState<string>('');

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setYear(calendar.year);
      setDateFrom(calendar.date_from);
      setDateTo(calendar.date_to);
      setItems(calendar.items || []);
      setOriginalItems(calendar.items || []);
      
      const initial = JSON.stringify({
        name: calendar.name,
        dateFrom: calendar.date_from,
        dateTo: calendar.date_to,
        items: (calendar.items || []).map((i: any) => ({ d: i.description, hd: i.holiday_date, s: i.state_code || '' })).sort((a: any,b: any) => a.hd.localeCompare(b.hd))
      });
      setInitialState(initial);
    }
  }, [calendar]);

  const hasUnsavedChanges = useMemo(() => {
     if (!initialState) return false;
     const current = JSON.stringify({
        name,
        dateFrom,
        dateTo,
        items: items.map(i => ({ d: i.description, hd: i.holiday_date, s: i.state_code || '' })).sort((a,b) => a.hd.localeCompare(b.hd))
     });
     return current !== initialState;
  }, [name, dateFrom, dateTo, items, initialState]);

  const totalHolidays = items.length;

  const handleWeeklyOffsGenerate = (dates: string[]) => {
    const newItems = dates.map(date => ({
      holiday_date: date,
      description: 'Weekly Off',
      state_code: null,
      temp_id: `temp-${Date.now()}-${Math.random()}`,
    }));

    const beforeCount = items.length;
    const merged = [...items, ...newItems];
    const unique = merged.filter((item, index, self) =>
      index === self.findIndex(t => t.holiday_date === item.holiday_date)
    );

    const addedCount = unique.length - beforeCount;
    setItems(unique);

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} weekly off${addedCount !== 1 ? 's' : ''}`, {
        description: 'Check the Basic Info tab to see all holidays'
      });
      setWeeklyOffDays([]); // Clear selection after successful generation
    } else {
      toast.info('No new weekly offs added (all already exist)');
    }
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

    const { errors, warnings } = getValidationIssues(name, dateFrom, dateTo, totalHolidays, items.filter(i => i.description === 'Weekly Off').length);

    if (errors.length > 0) {
      errors.forEach(e => toast.error(e));
      return;
    }
    
    if (warnings.length > 0) {
      warnings.forEach(w => toast.warning(w));
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

  const basicInfo = (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Calendar Name *</Label>
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

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Holidays</h2>
        <HolidayItemsTable items={items} onRemove={handleRemoveItem} />
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Edit Holiday Calendar
              <UnsavedIndicator show={hasUnsavedChanges} />
            </h1>
            <p className="text-muted-foreground mt-1">
              Modify calendar details and manage holidays.
            </p>
          </div>
        </div>

        <CalendarFormTabs
          basicInfo={basicInfo}
          weekly={
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Generate Weekly Offs</h3>
              <p className="text-sm text-muted-foreground">Select days of the week to automatically generate weekly holidays for the calendar year.</p>
              <WeeklyOffSelector
                dateFrom={dateFrom}
                dateTo={dateTo}
                selectedDays={weeklyOffDays}
                onSelectionChange={setWeeklyOffDays}
                onGenerate={handleWeeklyOffsGenerate}
                onRemove={handleRemoveWeeklyOffs}
              />
            </div>
          }
          local={
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Generate State Holidays</h3>
              <p className="text-sm text-muted-foreground">Add Malaysian public holidays for the selected state to this calendar.</p>
              <StateHolidayGenerator
                year={year}
                onGenerate={handleStateHolidaysGenerate}
              />
            </div>
          }
          replacement={
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Replacement Holidays (Replacement Leave)</h3>
              <p className="text-sm text-muted-foreground">Manage replacement days when holidays fall on weekends.</p>
              <ReplacementHolidayManager initialYear={year} />
            </div>
          }
          leave={
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Employee Leave (View Only)</h3>
              <p className="text-sm text-muted-foreground">Preview employee leave data for reference.</p>
              <EmployeeLeavePanel year={year} />
            </div>
          }
          sidebar={<HolidayPreviewSidebar items={items} />}
          actions={
            <div className="flex gap-2">
              <CalendarValidation hasUnsavedChanges={hasUnsavedChanges} />
              <Button variant="outline" asChild>
                <Link to="/calendar">
                  <Eye className="mr-2 h-4 w-4" />
                  View Calendar
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate('/hr/calendar')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          }
        />
      </div>
    </AppLayout>
  );
}
