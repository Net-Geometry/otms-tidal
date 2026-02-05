import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StateCodeBadge } from '@/components/hr/calendar/StateCodeBadge';
import type { HolidayItem } from '@/hooks/useHolidayCalendarView';

interface HolidayCardProps {
  holiday: HolidayItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function HolidayCard({ holiday, canEdit, onEdit, onDelete }: HolidayCardProps) {
  const source = holiday.event_source ?? 'holiday';
  const isLeave = source === 'leave' || holiday.is_personal_leave;
  const isCompany = source === 'company';
  const states = holiday.state_codes || (holiday.state_code ? [holiday.state_code] : []);

  const typeLabel = isLeave
    ? 'Leave'
    : isCompany
      ? 'Company'
      : holiday.state_code === 'ALL'
        ? 'Public'
        : 'State';

  return (
    <div className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm break-words">{holiday.description}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={isLeave ? 'secondary' : isCompany ? 'default' : 'outline'}>
              {typeLabel}
            </Badge>
            {!isLeave && holiday.is_replacement && (
              <Badge variant="secondary">Replacement</Badge>
            )}
            {!isLeave && holiday.is_hr_modified && (
              <Badge variant="outline">Edited</Badge>
            )}
          </div>

          {!isLeave && (
            <div className="mt-2 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
              {states.includes('ALL') ? (
                <span>All states</span>
              ) : states.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {states.map((code) => (
                    <StateCodeBadge key={code} code={code} />
                  ))}
                </div>
              ) : (
                <span>No state</span>
              )}
            </div>
          )}
        </div>

        {canEdit && !isLeave && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
