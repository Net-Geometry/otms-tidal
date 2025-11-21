import { useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, subDays, startOfYear, subMonths, format } from 'date-fns';

export interface OTFilters {
  startDate?: string;
  endDate?: string;
  ticketNumber?: string;
}

const defaultFilters: OTFilters = {};

export function useOTFilters() {
  const [filters, setFilters] = useState<OTFilters>(defaultFilters);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const updateFilter = useCallback(<K extends keyof OTFilters>(
    key: K,
    value: OTFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Clear preset when manually changing dates
    if (key === 'startDate' || key === 'endDate') {
      setSelectedPreset('');
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedPreset('');
  }, []);

  const applyDatePreset = useCallback((preset: string) => {
    const today = new Date();
    let start: Date | undefined;
    let end: Date | undefined = today;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'last7days':
        start = subDays(today, 6);
        break;
      case 'last30days':
        start = subDays(today, 29);
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(today, 1));
        end = endOfMonth(subMonths(today, 1));
        break;
      case 'thisYear':
        start = startOfYear(today);
        break;
    }

    setFilters(prev => ({
      ...prev,
      startDate: start?.toISOString().split('T')[0],
      endDate: end?.toISOString().split('T')[0],
    }));
    setSelectedPreset(preset);
  }, []);

  const applyMonthFilter = useCallback((date: Date | undefined) => {
    if (!date) {
      // Clear month filter
      setFilters(prev => ({
        ...prev,
        startDate: undefined,
        endDate: undefined,
      }));
      setSelectedPreset('');
      return;
    }

    const start = startOfMonth(date);
    const end = endOfMonth(date);

    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }));
    setSelectedPreset('month-picker');
  }, []);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.ticketNumber) count++;
    return count;
  }, [filters]);

  const getDateRangeLabel = useCallback(() => {
    const presetLabels: Record<string, string> = {
      'today': 'Today',
      'last7days': 'Last 7 Days',
      'last30days': 'Last 30 Days',
      'thisMonth': 'This Month',
      'lastMonth': 'Last Month',
      'thisYear': 'This Year',
      'month-picker': 'Month',
    };

    if (selectedPreset && presetLabels[selectedPreset]) {
      return presetLabels[selectedPreset];
    }

    if (filters.startDate && filters.endDate) {
      const start = format(new Date(filters.startDate), 'MMM d');
      const end = format(new Date(filters.endDate), 'MMM d, yyyy');
      return `${start} - ${end}`;
    }

    if (filters.startDate) {
      return `From ${format(new Date(filters.startDate), 'MMM d, yyyy')}`;
    }

    if (filters.endDate) {
      return `Until ${format(new Date(filters.endDate), 'MMM d, yyyy')}`;
    }

    return '';
  }, [filters, selectedPreset]);

  return {
    filters,
    selectedPreset,
    updateFilter,
    clearFilters,
    applyDatePreset,
    applyMonthFilter,
    getDateRangeLabel,
    activeFilterCount: getActiveFilterCount(),
  };
}
