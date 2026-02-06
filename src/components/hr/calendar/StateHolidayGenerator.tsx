import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MALAYSIA_STATES } from '@/lib/malaysiaStates';
import { holidayConfigService } from '@/services/HolidayConfigService';
import { HolidayRefreshHistory } from '@/components/hr/calendar/HolidayRefreshHistory';
import { Loader2, Plus, Download, History, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StateHolidayGeneratorProps {
  year: number;
  onGenerate: (holidays: Array<{ holiday_date: string; description: string; state_code: string }>) => void;
}

export function StateHolidayGenerator({ year, onGenerate }: StateHolidayGeneratorProps) {
  const [stateCode, setStateCode] = useState<string>('ALL');
  const [manualDate, setManualDate] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [savedCompanyState, setSavedCompanyState] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    loadCompanyState();
  }, []);

  useEffect(() => {
    loadLastRefresh();
  }, [year]);

  const loadCompanyState = async () => {
    try {
      const config = await holidayConfigService.getCompanyConfig();
      if (config) {
        setSavedCompanyState(config.selected_state);
        setStateCode(config.selected_state);
      }
    } catch (error) {
      console.error('Error loading company state:', error);
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

  const handleSaveCompanyState = async () => {
    if (stateCode === 'ALL') {
      toast.error('Please select a specific state to save as company default');
      return;
    }

    setIsSavingConfig(true);
    try {
      await holidayConfigService.saveCompanyState(stateCode);
      setSavedCompanyState(stateCode);
      const stateName = MALAYSIA_STATES.find(s => s.value === stateCode)?.label;
      toast.success(`Company state saved: ${stateName}`);
    } catch (error) {
      toast.error('Failed to save company state configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRefreshDataset = async () => {
    setIsRefreshing(true);
    try {
      const resp = await holidayConfigService.manualRefresh(year);
      if (!resp.success) {
        toast.error('Holiday refresh failed', { description: resp.error });
      } else {
        toast.success('Holiday dataset updated');
        await loadLastRefresh();
      }
    } catch (error) {
      toast.error('Failed to trigger holiday refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFetchHolidays = async () => {
    // Auto-check freshness
    if (lastRefreshAt && differenceInDays(new Date(), new Date(lastRefreshAt)) > 30) {
       toast.message("Refreshing dataset first...", { description: "Data is older than 30 days" });
       await handleRefreshDataset();
    }

    setIsLoading(true);
    try {
      const holidays = await holidayConfigService.getHolidaysForState(stateCode as any, year);
      
      if (!holidays || holidays.length === 0) {
        // Try to refresh if empty
        const refreshResp = await holidayConfigService.manualRefresh(year);
        if (refreshResp.success) {
           const retryHolidays = await holidayConfigService.getHolidaysForState(stateCode as any, year);
           if (retryHolidays && retryHolidays.length > 0) {
             processHolidays(retryHolidays);
             return;
           }
        }
        toast.warning('No holidays found. Please check the year or try refreshing the dataset.');
        return;
      }

      processHolidays(holidays);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to fetch holidays');
    } finally {
      setIsLoading(false);
    }
  };
  
  const processHolidays = (holidays: any[]) => {
      const mapped = holidays.map((h: any) => ({
        holiday_date: h.date,
        description: h.name,
        state_code: h.state === 'ALL' ? 'ALL' : h.state,
      }));

      onGenerate(mapped);
      toast.success(`Added ${mapped.length} holidays`);
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
        state_code: stateCode === 'ALL' ? null : stateCode, // If ALL, maybe null or ALL? Original code used stateCode. Let's use null if ALL to be generic?
        // Actually original code used stateCode. Let's stick to it, but typically manual holidays might be specific or general.
        // If I select 'Johor' and add manual, it is likely for Johor.
      },
    ]);

    setManualDate('');
    setManualDescription('');
    toast.success('Holiday added');
  };

  const isStale = !lastRefreshAt || differenceInDays(new Date(), new Date(lastRefreshAt)) > 7;
  const selectedStateLabel = MALAYSIA_STATES.find(s => s.value === stateCode)?.label || stateCode;

  return (
    <div className="space-y-6">
       <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
             <div className="flex-1 space-y-2 w-full">
                <div className="flex justify-between">
                  <Label>Select State</Label>
                  {stateCode !== 'ALL' && stateCode !== savedCompanyState && (
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                      onClick={handleSaveCompanyState}
                      disabled={isSavingConfig}
                    >
                      {isSavingConfig ? "Saving..." : "Set as Default"}
                    </Button>
                  )}
                </div>
                <Select value={stateCode} onValueChange={setStateCode}>
                   <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                   </SelectTrigger>
                   <SelectContent>
                      {MALAYSIA_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                          {state.value === savedCompanyState && " (Default)"}
                        </SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>
             <Button onClick={handleFetchHolidays} disabled={isLoading} className="w-full sm:w-auto min-w-[200px]">
                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                Add Holidays for State
             </Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
             <Info className="h-3 w-3" />
             <span>Dataset updated: {lastRefreshAt ? format(new Date(lastRefreshAt), 'd MMM yyyy HH:mm') : 'Unknown'}</span>
             {isStale && (
                <span className="text-amber-500 font-medium ml-1">(Stale)</span>
             )}
             
             <div className="ml-auto flex items-center gap-2">
               <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={handleRefreshDataset} disabled={isRefreshing}>
                  {isRefreshing ? "Refreshing..." : "Refresh Now"}
               </Button>
               
               <Popover>
                  <PopoverTrigger asChild>
                     <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-muted"><History className="h-3 w-3" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="end">
                     <div className="p-3 border-b bg-muted/30"><h4 className="font-medium text-sm">Dataset Refresh History</h4></div>
                     <HolidayRefreshHistory />
                  </PopoverContent>
               </Popover>
             </div>
          </div>
       </div>
       
       <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Single Holiday
          </h4>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
             <div className="space-y-1.5 w-full sm:w-auto">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
             </div>
             <div className="space-y-1.5 flex-1 w-full sm:w-auto">
                <Label className="text-xs">Description</Label>
                <Input value={manualDescription} onChange={e => setManualDescription(e.target.value)} placeholder="Holiday Name" />
             </div>
             <Button variant="secondary" onClick={handleAddManual} className="w-full sm:w-auto">Add</Button>
          </div>
       </div>
    </div>
  );
}
