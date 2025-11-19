import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X, Search } from 'lucide-react';
import { OTFilters } from '@/hooks/useOTFilters';
import { MonthPicker } from './MonthPicker';
import { startOfMonth } from 'date-fns';

export interface OTFilterPanelProps {
  filters: OTFilters;
  selectedPreset: string;
  updateFilter: <K extends keyof OTFilters>(key: K, value: OTFilters[K]) => void;
  clearFilters: () => void;
  applyMonthFilter: (date: Date | undefined) => void;
  activeFilterCount: number;
  onClose?: () => void;
}

export function OTFilterPanel({
  filters,
  selectedPreset,
  updateFilter,
  clearFilters,
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
