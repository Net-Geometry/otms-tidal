import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface EventTypeFilters {
  public: boolean;
  state: boolean;
  company: boolean;
  leave: boolean;
}

interface EventTypeFilterProps {
  filters: EventTypeFilters;
  onChange: (filters: EventTypeFilters) => void;
}

export function EventTypeFilter({ filters, onChange }: EventTypeFilterProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isTablet = useMediaQuery("(min-width: 768px)");

  const handleChange = (key: keyof EventTypeFilters, value: boolean) => {
    onChange({ ...filters, [key]: value });
  };

  const filtersList: Array<{ id: string; key: keyof EventTypeFilters; label: string; color: string }> = [
    { id: "public", key: "public", label: "Public", color: "from-red-500 to-red-600" },
    { id: "state", key: "state", label: "State", color: "from-yellow-500 to-yellow-600" },
    { id: "company", key: "company", label: "Company", color: "from-indigo-500 to-indigo-600" },
    { id: "leave", key: "leave", label: "Leave", color: "from-emerald-500 to-emerald-600" },
  ];

  const FilterItem = ({
    id,
    label,
    colorClass,
    checked,
    onToggle,
  }: {
    id: string;
    label: string;
    colorClass: string;
    checked: boolean;
    onToggle: (checked: boolean) => void;
  }) => (
    <div className="flex items-center gap-2 cursor-pointer group">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onToggle(c === true)}
        className="h-4 w-4"
      />
      <Label
        htmlFor={id}
        className="text-sm font-medium cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors"
      >
        <div className={`w-3 h-3 rounded-sm bg-gradient-to-br ${colorClass}`} />
        {label}
      </Label>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-foreground uppercase tracking-wide flex-shrink-0">
          Show:
        </span>
        <div className="flex items-center gap-3">
          {filtersList.map((f) => (
            <FilterItem
              key={f.id}
              id={f.id}
              label={f.label}
              colorClass={f.color}
              checked={filters[f.key]}
              onToggle={(c) => handleChange(f.key, c)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Show:
        </span>
        <div className="grid grid-cols-3 gap-3">
          {filtersList.map((f) => (
            <FilterItem
              key={f.id}
              id={f.id}
              label={f.label}
              colorClass={f.color}
              checked={filters[f.key]}
              onToggle={(c) => handleChange(f.key, c)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Filter className="mr-2 h-4 w-4" /> Filter Events
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pt-6">
        <SheetHeader className="mb-4">
          <SheetTitle>Filter Events</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {filtersList.map((f) => (
            <div key={f.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50">
              <Checkbox
                id={`mobile-${f.id}`}
                checked={filters[f.key]}
                onCheckedChange={(c) => handleChange(f.key, c === true)}
                className="h-5 w-5"
              />
              <Label htmlFor={`mobile-${f.id}`} className="flex items-center gap-3 font-medium text-base flex-1">
                <div className={`w-4 h-4 rounded-sm bg-gradient-to-br ${f.color}`} />
                {f.label}
              </Label>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
