import { useMemo, useState } from 'react';
import { format } from 'date-fns';

import type { HolidayItem } from '@/hooks/useHolidayCalendarView';
import { Button } from '@/components/ui/button';
import { HolidayCard } from '@/components/calendar/HolidayCard';
import { HolidayEditForm, type HolidayEditSource } from '@/components/calendar/HolidayEditForm';
import { useCreateHoliday } from '@/hooks/useCreateHoliday';
import { useUpdateHoliday } from '@/hooks/useUpdateHoliday';
import { useDeleteHoliday } from '@/hooks/useDeleteHoliday';

interface CalendarSidebarProps {
  selectedDate: Date;
  holidays: HolidayItem[];
  canManage: boolean;
}

export function CalendarSidebar({ selectedDate, holidays, canManage }: CalendarSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const dateLabel = format(selectedDate, 'EEE, MMM d, yyyy');
  const dateValue = format(selectedDate, 'yyyy-MM-dd');

  const sorted = useMemo(() => {
    return [...holidays].sort((a, b) => (a.description || '').localeCompare(b.description || ''));
  }, [holidays]);

  const isBusy = createHoliday.isPending || updateHoliday.isPending || deleteHoliday.isPending;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{dateLabel}</div>
            <div className="text-xs text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? 'event' : 'events'}
            </div>
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
              disabled={isBusy}
            >
              + Add Holiday
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {adding && canManage && (
          <HolidayEditForm
            source="company"
            submitLabel="Add"
            initialValues={{ date: dateValue, name: '', company_type: 'company', description: '' }}
            isSubmitting={isBusy}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              await createHoliday.mutateAsync({
                date: values.date,
                name: values.name,
                type: values.company_type ?? 'company',
                description: values.description ?? null,
              });
              setAdding(false);
            }}
          />
        )}

        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">No holidays on this date.</div>
        ) : (
          sorted.map((holiday) => {
            const source: HolidayEditSource = (holiday.event_source === 'company') ? 'company' : 'holiday';
            const isLeave = holiday.event_source === 'leave' || holiday.is_personal_leave;
            const canEditThis = canManage && !isLeave;

            const isMulti = (holiday.source_ids?.length ?? 1) > 1;
            const hideScopeFields = source === 'holiday' && isMulti;

            if (editingId === holiday.id && canEditThis) {
              return (
                <HolidayEditForm
                  key={holiday.id}
                  source={source}
                  submitLabel="Save"
                  hideScopeFields={hideScopeFields}
                  initialValues={
                    source === 'company'
                      ? {
                          date: holiday.holiday_date,
                          name: holiday.description,
                          company_type:
                            holiday.holiday_type === 'company'
                            || holiday.holiday_type === 'emergency'
                            || holiday.holiday_type === 'government'
                              ? holiday.holiday_type
                              : 'company',
                          description: '',
                        }
                      : {
                          date: holiday.holiday_date,
                          name: holiday.description,
                          state_code: holiday.state_code ?? 'ALL',
                          holiday_type:
                            holiday.holiday_type === 'federal'
                            || holiday.holiday_type === 'state'
                            || holiday.holiday_type === 'religious'
                              ? holiday.holiday_type
                              : 'federal',
                        }
                  }
                  isSubmitting={isBusy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (values) => {
                    if (source === 'company') {
                      await updateHoliday.mutateAsync({
                        id: holiday.id,
                        source: 'company',
                        date: values.date,
                        name: values.name,
                        type: values.company_type ?? 'company',
                        description: values.description ?? null,
                      });
                    } else {
                      await updateHoliday.mutateAsync({
                        id: holiday.id,
                        ids: holiday.source_ids,
                        source: 'holiday',
                        date: values.date,
                        name: values.name,
                        state_code: hideScopeFields ? null : (values.state_code ?? null),
                        holiday_type: hideScopeFields ? null : (values.holiday_type ?? null),
                      });
                    }
                    setEditingId(null);
                  }}
                />
              );
            }

            return (
              <HolidayCard
                key={holiday.id}
                holiday={holiday}
                canEdit={canEditThis}
                onEdit={() => {
                  setEditingId(holiday.id);
                  setAdding(false);
                }}
                onDelete={async () => {
                  if (!canEditThis) return;
                  const ok = window.confirm('Delete this holiday?');
                  if (!ok) return;

                  await deleteHoliday.mutateAsync({
                    id: holiday.id,
                    ids: holiday.source_ids,
                    source: source,
                  });
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
