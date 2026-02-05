import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllStates } from '@/config/malaysia-states';

export type StatePreviewValue = 'AUTO' | string;

interface StatePreviewSelectorProps {
  value: StatePreviewValue;
  onChange: (value: StatePreviewValue) => void;
}

export function StatePreviewSelector({ value, onChange }: StatePreviewSelectorProps) {
  const states = getAllStates();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        State Preview
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as StatePreviewValue)}>
        <SelectTrigger className="h-8 w-[170px]">
          <SelectValue placeholder="Select state" />
        </SelectTrigger>
        <SelectContent className="z-50">
          <SelectItem value="AUTO">My state</SelectItem>
          {states.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label} ({s.value})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
