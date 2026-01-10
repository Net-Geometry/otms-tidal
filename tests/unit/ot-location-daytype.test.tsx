import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type HolidayRow = { state: string; name?: string };

const testState = vi.hoisted(() => {
  const holidayOverridesByDate = new Map<string, unknown>();
  const malaysianHolidaysByDate = new Map<string, HolidayRow[]>();

  const from = vi.fn((table: string) => {
    if (table === 'ot_settings') {
      return {
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { ot_submission_cutoff_day: 10 }, error: null })
          ),
        })),
      };
    }

    if (table === 'holiday_overrides') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, dateStr: string) => ({
            single: vi.fn(() =>
              Promise.resolve({ data: holidayOverridesByDate.get(dateStr) ?? null, error: null })
            ),
          })),
        })),
      };
    }

    if (table === 'malaysian_holidays') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, dateStr: string) =>
            Promise.resolve({ data: malaysianHolidaysByDate.get(dateStr) ?? [], error: null })
          ),
        })),
      };
    }

    return {
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
  });

  return { from, holidayOverridesByDate, malaysianHolidaysByDate };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: testState.from,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { state: 'WPKL' },
  }),
}));

vi.mock('@/hooks/useSupervisors', () => ({
  useSupervisors: () => ({ data: [] }),
}));

vi.mock('@/utils/otValidation', () => ({
  canSubmitOTForDate: () => ({ isAllowed: true }),
}));

vi.mock('@/components/hr/StateSelector', () => ({
  StateSelector: ({
    value,
    onChange,
    disabled,
  }: {
    value?: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      data-testid="ot-location-state"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select</option>
      <option value="WPKL">WPKL</option>
      <option value="JHR">JHR</option>
      <option value="SGR">SGR</option>
    </select>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date?: Date) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect?.(new Date(2026, 11, 11))}>
        Select 2026-12-11
      </button>
      <button type="button" onClick={() => onSelect?.(new Date(2026, 11, 12))}>
        Select 2026-12-12
      </button>
    </div>
  ),
}));

describe('OTForm - OT location & day type (state holiday)', () => {
  beforeEach(() => {
    testState.from.mockClear();
    testState.holidayOverridesByDate.clear();
    testState.malaysianHolidaysByDate.clear();
  });

  it('renders OT Location (State) field and defaults to profile state', async () => {
    const { OTForm } = await import('@/components/ot/OTForm');

    render(
      <OTForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        employeeId="EMP-1"
        fullName="Test User"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('OT Location (State) *')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('ot-location-state')).toHaveValue('WPKL');
    });
  });

  it('shows State Holiday when selected location has a holiday on the selected date', async () => {
    const { OTForm } = await import('@/components/ot/OTForm');

    testState.malaysianHolidaysByDate.set('2026-12-12', [{ state: 'JHR', name: 'Johor Holiday' }]);

    render(
      <OTForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        employeeId="EMP-1"
        fullName="Test User"
        onCancel={vi.fn()}
        defaultValues={{
          ot_date: new Date(2026, 11, 12),
          ot_location_state: 'JHR',
        }}
      />
    );

    expect(await screen.findByText('State Holiday')).toBeInTheDocument();
  });

  it('recalculates day type when OT location changes', async () => {
    const user = userEvent.setup();
    const { OTForm } = await import('@/components/ot/OTForm');

    testState.malaysianHolidaysByDate.set('2026-12-14', [{ state: 'JHR', name: 'Johor Holiday' }]);

    render(
      <OTForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        employeeId="EMP-1"
        fullName="Test User"
        onCancel={vi.fn()}
        defaultValues={{
          ot_date: new Date(2026, 11, 14),
          ot_location_state: 'WPKL',
        }}
      />
    );

    // Not a holiday for WPKL → should remain Weekday
    expect(await screen.findByText('Weekday')).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('ot-location-state'), 'JHR');

    expect(await screen.findByText('State Holiday')).toBeInTheDocument();
  });

  it('recalculates day type when OT date changes', async () => {
    const user = userEvent.setup();
    const { OTForm } = await import('@/components/ot/OTForm');

    testState.malaysianHolidaysByDate.set('2026-12-12', [{ state: 'JHR', name: 'Johor Holiday' }]);

    render(
      <OTForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        employeeId="EMP-1"
        fullName="Test User"
        onCancel={vi.fn()}
        defaultValues={{
          ot_location_state: 'JHR',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Select 2026-12-11' }));
    expect(await screen.findByText('Weekday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select 2026-12-12' }));
    expect(await screen.findByText('State Holiday')).toBeInTheDocument();
  });

  it('submits ot_location_state in payload', async () => {
    const user = userEvent.setup();
    const { OTForm } = await import('@/components/ot/OTForm');

    const onSubmit = vi.fn();

    render(
      <OTForm
        onSubmit={onSubmit}
        isSubmitting={false}
        employeeId="EMP-1"
        fullName="Test User"
        onCancel={vi.fn()}
        defaultValues={{
          ot_date: new Date(2026, 11, 14),
          ot_location_state: 'JHR',
          start_time: '09:00',
          end_time: '10:00',
          reason_dropdown: 'System maintenance',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Submit OT Request' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          ot_date: '2026-12-14',
          ot_location_state: 'JHR',
        })
      );
    });
  });
});

