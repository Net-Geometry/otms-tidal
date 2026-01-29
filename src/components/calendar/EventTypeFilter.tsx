import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface EventTypeFilters {
  publicHolidays: boolean;
  nationalHolidays: boolean;
  weeklyHolidays: boolean;
  stateHolidays: boolean;
  personalLeave: boolean;
  replacementHolidays: boolean;
}

interface EventTypeFilterProps {
  filters: EventTypeFilters;
  onChange: (filters: EventTypeFilters) => void;
}

export function EventTypeFilter({ filters, onChange }: EventTypeFilterProps) {
  const handleChange = (key: keyof EventTypeFilters, value: boolean) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-semibold text-foreground uppercase tracking-wide flex-shrink-0">
        Show:
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="public-holidays"
            checked={filters.publicHolidays}
            onCheckedChange={(checked) =>
              handleChange("publicHolidays", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="public-holidays"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-red-500 to-red-600" />
            Public Holiday
          </Label>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="national-holidays"
            checked={filters.nationalHolidays}
            onCheckedChange={(checked) =>
              handleChange("nationalHolidays", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="national-holidays"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-orange-500 to-orange-600" />
            National Holiday
          </Label>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="weekly-holidays"
            checked={filters.weeklyHolidays}
            onCheckedChange={(checked) =>
              handleChange("weeklyHolidays", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="weekly-holidays"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-indigo-500 to-indigo-600" />
            Weekly Holiday
          </Label>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="state-holidays"
            checked={filters.stateHolidays}
            onCheckedChange={(checked) =>
              handleChange("stateHolidays", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="state-holidays"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-yellow-500 to-yellow-600" />
            State Holiday
          </Label>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="replacement-holidays"
            checked={filters.replacementHolidays}
            onCheckedChange={(checked) =>
              handleChange("replacementHolidays", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="replacement-holidays"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-purple-500 to-purple-600" />
            Cuti Ganti
          </Label>
        </div>

        <div className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            id="personal-leave"
            checked={filters.personalLeave}
            onCheckedChange={(checked) =>
              handleChange("personalLeave", checked as boolean)
            }
            className="h-4 w-4"
          />
          <Label
            htmlFor="personal-leave"
            className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
          >
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-emerald-500 to-emerald-600" />
            Personal Leave
          </Label>
        </div>
      </div>
    </div>
  );
}
