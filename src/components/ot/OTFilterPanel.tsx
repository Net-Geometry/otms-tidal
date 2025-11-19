import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Search, Calendar } from 'lucide-react';
import { OTFilters } from '@/hooks/useOTFilters';
import { MonthPicker } from './MonthPicker';
import { startOfMonth } from 'date-fns';

export interface OTFilterPanelProps {
  filters: OTFilters;
  selectedPreset: string;
  updateFilter: <K extends keyof OTFilters>(key: K, value: OTFilters[K]) => void;
  clearFilters: () => void;
  applyDatePreset: (preset: string) => void;
  applyMonthFilter: (date: Date | undefined) => void;
  activeFilterCount: number;
  onClose?: () => void;
}

export function OTFilterPanel({
  filters,
  selectedPreset,
  updateFilter,
  clearFilters,
  applyDatePreset,
  applyMonthFilter,
  activeFilterCount,
  onClose,
}: OTFilterPanelProps) {
  return (
    <div className="w-80 p-4 space-y-4">
      {/* Ticket Number Search */}
      <div className="space-y-1.5">
        <Label htmlFor="ticketNumber" className="text-xs font-medium">
          Ticket Number
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="ticketNumber"
            placeholder="Search ticket..."
            value={filters.ticketNumber || ''}
            onChange={(e) => updateFilter('ticketNumber', e.target.value || undefined)}
            className="pl-8 pr-8 h-9 text-sm"
          />
          {filters.ticketNumber && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => updateFilter('ticketNumber', undefined)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Month Picker */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Filter by Month</Label>
        <div className="flex items-center gap-2">
          <MonthPicker
            selectedMonth={
              filters.startDate && filters.endDate && selectedPreset === 'month-picker'
                ? startOfMonth(new Date(filters.startDate))
                : undefined
            }
            onMonthChange={(date) => {
              applyMonthFilter(date);
            }}
          />
          {filters.startDate && filters.endDate && selectedPreset === 'month-picker' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2"
              onClick={() => applyMonthFilter(undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Quick select a specific month
        </p>
      </div>

      {/* Or Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Date Range</Label>
        <Select value={selectedPreset} onValueChange={applyDatePreset}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Quick select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Today</span>
              </div>
            </SelectItem>
            <SelectItem value="last7days">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Last 7 Days</span>
              </div>
            </SelectItem>
            <SelectItem value="last30days">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Last 30 Days</span>
              </div>
            </SelectItem>
            <SelectItem value="thisMonth">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>This Month</span>
              </div>
            </SelectItem>
            <SelectItem value="lastMonth">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>Last Month</span>
              </div>
            </SelectItem>
            <SelectItem value="thisYear">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>This Year</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Custom Date Inputs */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="space-y-1">
            <Label htmlFor="startDate" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          Reset
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
