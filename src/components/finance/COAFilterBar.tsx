import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/types/finance';

export interface COAFilters {
  accountType: AccountType | 'all';
  activity: 'all' | 'active' | 'inactive';
  search: string;
}

interface COAFilterBarProps {
  filters: COAFilters;
  onChange: (filters: COAFilters) => void;
  onAddAccount: () => void;
}

export function COAFilterBar({ filters, onChange, onAddAccount }: COAFilterBarProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search account code, name, description..."
            className="pl-9"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        </div>

        <Select
          value={filters.accountType}
          onValueChange={(value) => onChange({ ...filters, accountType: value as AccountType | 'all' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Account type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Account Types</SelectItem>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.activity}
          onValueChange={(value) => onChange({ ...filters, activity: value as 'all' | 'active' | 'inactive' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={onAddAccount}>Add Account</Button>
      </div>
    </div>
  );
}
