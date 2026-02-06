export type CalendarEventSource = 'holiday' | 'company' | 'leave' | string;

export interface CalendarEventItem {
  id: string;
  calendar_id?: string | null;
  holiday_date: string;
  description: string;
  state_code?: string | null;
  event_source?: CalendarEventSource;
  is_personal_leave?: boolean;
  is_replacement?: boolean;
  holiday_type?: string | null;
  leave_type?: string | null;
  leave_status?: string | null;
  is_hr_modified?: boolean;

  // Added by consolidation
  state_codes?: string[];
  source_ids?: string[];
}

function hashString(input: string): string {
  // djb2-ish; stable and good enough for synthetic ids.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function computePrimaryStateCode(stateCodes: string[]): string | null {
  if (stateCodes.includes('ALL')) return 'ALL';
  if (stateCodes.length === 1) return stateCodes[0];
  if (stateCodes.length > 1) return 'MULTI';
  return null;
}

export function consolidateHolidays(items: CalendarEventItem[]): CalendarEventItem[] {
  const passthrough: CalendarEventItem[] = [];
  const grouped = new Map<string, CalendarEventItem[]>();

  for (const item of items) {
    const source = item.event_source ?? 'holiday';
    const isLeave = source === 'leave' || Boolean(item.is_personal_leave);

    if (isLeave) {
      passthrough.push({
        ...item,
        state_codes: item.state_code ? [item.state_code] : [],
        source_ids: [item.id],
      });
      continue;
    }

    const key = `${source}|${item.holiday_date}|${item.description}`;
    const arr = grouped.get(key);
    if (arr) arr.push(item);
    else grouped.set(key, [item]);
  }

  const consolidated: CalendarEventItem[] = [];

  for (const [key, group] of grouped.entries()) {
    if (group.length === 1) {
      const g = group[0];
      consolidated.push({
        ...g,
        state_codes: g.state_code ? [g.state_code] : [],
        source_ids: [g.id],
      });
      continue;
    }

    const first = group[0];
    const stateCodes = Array.from(
      new Set(group.map((g) => g.state_code).filter((s): s is string => Boolean(s)))
    ).sort();

    consolidated.push({
      ...first,
      id: `c:${hashString(key)}`,
      state_code: computePrimaryStateCode(stateCodes),
      state_codes: stateCodes,
      source_ids: group.map((g) => g.id),
      is_replacement: group.some((g) => Boolean(g.is_replacement)),
      is_hr_modified: group.some((g) => Boolean(g.is_hr_modified)),
      holiday_type: group.find((g) => g.holiday_type != null)?.holiday_type ?? first.holiday_type ?? null,
    });
  }

  const result = [...passthrough, ...consolidated];
  result.sort((a, b) => {
    const ad = a.holiday_date;
    const bd = b.holiday_date;
    if (ad < bd) return -1;
    if (ad > bd) return 1;
    return (a.description || '').localeCompare(b.description || '');
  });

  return result;
}
