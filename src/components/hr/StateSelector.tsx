import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAvailableStates } from '@/hooks/hr/useCompanyLocations';
import { Badge } from '@/components/ui/badge';

interface StateSelectorProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  showStateName?: boolean;
}

/**
 * StateSelector component for employee work location
 * Shows Malaysian states and their codes
 */
export function StateSelector({
  value,
  onChange,
  disabled = false,
  showStateName = true,
}: StateSelectorProps) {
  const { data: states, isLoading } = useAvailableStates();

  return (
    <div className="space-y-2">
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder="Select work state/location" />
        </SelectTrigger>
        <SelectContent>
          {states?.map((state) => (
            <SelectItem key={state.code} value={state.code}>
              <div className="flex items-center gap-2">
                <span>{state.name}</span>
                <Badge variant="outline" className="text-xs">
                  {state.code}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showStateName && value && (
        <p className="text-xs text-muted-foreground">
          State Code: <span className="font-mono font-semibold">{value}</span>
        </p>
      )}
    </div>
  );
}
