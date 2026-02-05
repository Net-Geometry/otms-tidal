import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllStatesWithNational } from '@/config/malaysia-states';

export type HolidayEditSource = 'holiday' | 'company';

const holidayTypeEnum = z.enum(['federal', 'state', 'religious']);
const companyTypeEnum = z.enum(['company', 'emergency', 'government']);

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  state_code: z.string().nullable().optional(),
  holiday_type: holidayTypeEnum.nullable().optional(),
  company_type: companyTypeEnum.nullable().optional(),
  description: z.string().nullable().optional(),
});

export type HolidayEditValues = z.infer<typeof schema>;

interface HolidayEditFormProps {
  source: HolidayEditSource;
  initialValues: Partial<HolidayEditValues>;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: HolidayEditValues) => void | Promise<void>;
  isSubmitting?: boolean;
  hideScopeFields?: boolean;
}

export function HolidayEditForm({
  source,
  initialValues,
  submitLabel,
  onCancel,
  onSubmit,
  isSubmitting,
  hideScopeFields,
}: HolidayEditFormProps) {
  const states = useMemo(() => getAllStatesWithNational(), []);

  const form = useForm<HolidayEditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initialValues.date ?? '',
      name: initialValues.name ?? '',
      state_code: initialValues.state_code ?? null,
      holiday_type: initialValues.holiday_type ?? null,
      company_type: initialValues.company_type ?? null,
      description: initialValues.description ?? null,
    },
  });

  const { register, handleSubmit, formState, setValue, watch } = form;
  const selectedState = watch('state_code');

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="space-y-3 rounded-md border bg-card p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Date</div>
          <Input type="date" {...register('date')} />
          {formState.errors.date?.message && (
            <div className="text-xs text-destructive">{formState.errors.date.message}</div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Name</div>
          <Input placeholder="Holiday name" {...register('name')} />
          {formState.errors.name?.message && (
            <div className="text-xs text-destructive">{formState.errors.name.message}</div>
          )}
        </div>
      </div>

      {source === 'holiday' && !hideScopeFields ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">State</div>
            <Select
              value={selectedState ?? 'ALL'}
              onValueChange={(v) => setValue('state_code', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent className="z-50">
                {states.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Type</div>
            <Select
              value={watch('holiday_type') ?? 'federal'}
              onValueChange={(v) => setValue('holiday_type', v as HolidayEditValues['holiday_type'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="federal">federal</SelectItem>
                <SelectItem value="state">state</SelectItem>
                <SelectItem value="religious">religious</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : source === 'company' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Type</div>
            <Select
              value={watch('company_type') ?? 'company'}
              onValueChange={(v) => setValue('company_type', v as HolidayEditValues['company_type'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="company">company</SelectItem>
                <SelectItem value="emergency">emergency</SelectItem>
                <SelectItem value="government">government</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Details</div>
            <Input placeholder="Optional" {...register('description')} />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
