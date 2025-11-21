import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OTFilters } from '@/hooks/useOTFilters';
import { format, subMonths, startOfMonth } from 'date-fns';

export interface OTFilterPanelProps {
  filters: OTFilters;
  selectedPreset: string;
  applyMonthFilter: (date: Date | undefined) => void;
  activeFilterCount: number;
  onClose?: () => void;
}

// Generate month options (last 12 months from current month)
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const monthDate = subMonths(startOfMonth(now), i);
    options.push({
      value: monthDate.toISOString(),
      label: format(monthDate, 'MMMM yyyy'),
    });
  }
  
  return options;
};

export function OTFilterPanel({
  filters,
  selectedPreset,
  applyMonthFilter,
  activeFilterCount,
  onClose,
}: OTFilterPanelProps) {
  const monthOptions = generateMonthOptions();

  return (
    <div className="w-80 p-4 space-y-4">
      {/* Month Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Select Month</Label>
        <Select
          value={
            filters.startDate && filters.endDate && selectedPreset === 'month-picker'
              ? new Date(filters.startDate).toISOString()
              : undefined
          }
          onValueChange={(value) => {
            if (value) {
              applyMonthFilter(new Date(value));
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.startDate && filters.endDate && selectedPreset === 'month-picker' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => applyMonthFilter(undefined)}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => applyMonthFilter(undefined)}
          disabled={activeFilterCount === 0}
        >
          Clear
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
