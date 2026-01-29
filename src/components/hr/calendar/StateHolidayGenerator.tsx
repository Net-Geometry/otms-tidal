import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MALAYSIA_STATES } from '@/lib/malaysiaStates';
import { holidayConfigService } from '@/services/HolidayConfigService';
import { HolidayRefreshHistory } from '@/components/hr/calendar/HolidayRefreshHistory';
import { Loader2, Save, Settings2, Clock, Download, History, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StateHolidayGeneratorProps {
  year: number;
  onGenerate: (holidays: Array<{ holiday_date: string; description: string; state_code: string }>) => void;
}

export function StateHolidayGenerator({ year, onGenerate }: StateHolidayGeneratorProps) {
  const [stateCode, setStateCode] = useState<string>('ALL');
  const [manualDate, setManualDate] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [savedCompanyState, setSavedCompanyState] = useState<string | null>(null);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [scrapingHolidays, setScrapingHolidays] = useState(false);
  const [refreshingDataset, setRefreshingDataset] = useState(false);

  // Load saved company state configuration on mount
  useEffect(() => {
    loadCompanyState();
  }, []);

  useEffect(() => {
    loadLastRefresh();
  }, [year]);

  const loadCompanyState = async () => {
    setLoadingConfig(true);
    try {
      const config = await holidayConfigService.getCompanyConfig();
      if (config) {
        setSavedCompanyState(config.selected_state);
        setConfigUpdatedAt(config.updated_at);
        setStateCode(config.selected_state); // Pre-select the saved state
      }
    } catch (error) {
      console.error('Error loading company state:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadLastRefresh = async () => {
    try {
      const history = await holidayConfigService.getRefreshHistory(25);
      const latest = history.find((h: any) => h.year === year && h.completed_at);
      setLastRefreshAt(latest?.completed_at || null);
    } catch {
      setLastRefreshAt(null);
    }
  };

  const getNextMonthlyRefreshUTC = () => {
    // Cron: 0 2 1 * * (2 AM UTC on the 1st)
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 2, 0, 0));
    if (now >= next) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
    return next;
  };

  const getNextQ4RefreshUTC = () => {
    // Cron: 0 3 1 10 * (3 AM UTC on Oct 1)
    const now = new Date();
    const yearNow = now.getUTCFullYear();
    const octThisYear = new Date(Date.UTC(yearNow, 9, 1, 3, 0, 0));
    return now < octThisYear ? octThisYear : new Date(Date.UTC(yearNow + 1, 9, 1, 3, 0, 0));
  };

  const handleSaveCompanyState = async () => {
    if (stateCode === 'ALL') {
      toast.error('Please select a specific state to save as company default');
      return;
    }

    setSavingConfig(true);
    try {
      await holidayConfigService.saveCompanyState(stateCode);
      setSavedCompanyState(stateCode);
      const stateName = MALAYSIA_STATES.find(s => s.value === stateCode)?.label;
      toast.success(`Company state saved: ${stateName}`, {
        description: 'This state will be used as the default for future holiday generation'
      });
    } catch (error) {
      console.error('Error saving company state:', error);
      toast.error('Failed to save company state configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRefreshDataset = async () => {
    setRefreshingDataset(true);
    try {
      const resp = await holidayConfigService.manualRefresh(year);
      if (!resp.success) {
        toast.error('Holiday refresh failed', { description: resp.error });
      } else {
        toast.success('Holiday refresh triggered');
      }
      await loadLastRefresh();
    } catch (error) {
      console.error('Error triggering refresh:', error);
      toast.error('Failed to trigger holiday refresh');
    } finally {
      setRefreshingDataset(false);
    }
  };

  const handleFetchHolidays = async () => {
    setScrapingHolidays(true);
    try {
      const holidays = await holidayConfigService.getHolidaysForState(stateCode as any, year);
      if (!holidays || holidays.length === 0) {
        toast.warning('No holidays found in database (try Refresh Dataset)');
        return;
      }

      const mapped = holidays.map((h: any) => ({
        holiday_date: h.date,
        description: h.name,
        state_code: h.state === 'ALL' ? 'ALL' : h.state,
      }));

      onGenerate(mapped);
      toast.success(`Added ${mapped.length} holiday${mapped.length !== 1 ? 's' : ''} from holiday dataset`);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to fetch holidays');
    } finally {
      setScrapingHolidays(false);
    }
  };

  const handleAddManual = () => {
    if (!manualDate || !manualDescription) {
      toast.error('Please fill in date and description');
      return;
    }

    onGenerate([
      {
        holiday_date: manualDate,
        description: manualDescription,
        state_code: stateCode,
      },
    ]);

    setManualDate('');
    setManualDescription('');
    toast.success('Holiday added');
  };

  return (
    <div className="space-y-6">
      {/* Company State Configuration Section */}
      {savedCompanyState && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
              <Settings2 className="h-4 w-4" />
              <span>
                <strong>Company Default State:</strong>{' '}
                {MALAYSIA_STATES.find(s => s.value === savedCompanyState)?.label}
              </span>
            </div>
            {configUpdatedAt && (
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-200">
                <Clock className="h-3 w-3" />
                <span>Last updated: {format(new Date(configUpdatedAt), 'PPp')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <RefreshCcw className="h-4 w-4" />
              <span className="font-semibold">Holiday Dataset</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {lastRefreshAt ? `Last refresh: ${format(new Date(lastRefreshAt), 'PPp')}` : 'Last refresh: (no audit data)'}
            </div>
            <div className="text-xs text-muted-foreground">
              Next monthly refresh (UTC): {format(getNextMonthlyRefreshUTC(), 'PPp')}
            </div>
            <div className="text-xs text-muted-foreground">
              Next Q4 population (UTC): {format(getNextQ4RefreshUTC(), 'PPp')}
            </div>
          </div>

          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  Refresh History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Holiday Refresh History</DialogTitle>
                </DialogHeader>
                <HolidayRefreshHistory />
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefreshDataset}
              disabled={refreshingDataset}
            >
              {refreshingDataset ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing...</>
              ) : (
                <><RefreshCcw className="mr-2 h-4 w-4" />Refresh Dataset</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Malaysia State</Label>
          <Select value={stateCode} onValueChange={setStateCode} disabled={loadingConfig}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {MALAYSIA_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stateCode !== 'ALL' && stateCode !== savedCompanyState && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleSaveCompanyState}
              disabled={savingConfig}
              className="h-auto p-0 text-xs"
            >
              {savingConfig ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-1 h-3 w-3" /> Save as company default</>
              )}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Input type="number" value={year} disabled />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="default"
            onClick={handleFetchHolidays}
            disabled={scrapingHolidays || loadingConfig}
            className="w-full"
          >
            {scrapingHolidays ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" />Fetch Holidays</>
            )}
          </Button>
        </div>
      </div>

      <div className="border-t pt-4">
        <Label className="text-base mb-4 block">Add Manual Holiday</Label>
        <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="manual-date">Date</Label>
            <Input
              id="manual-date"
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-desc">Description</Label>
            <Input
              id="manual-desc"
              type="text"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Holiday name"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddManual}
            >
              Add Holiday
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
