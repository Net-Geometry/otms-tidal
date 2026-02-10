import { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { useAttendanceSettings } from '@/hooks/attendance/useAttendanceSettings';

const schema = z.object({
  late_threshold_minutes: z.coerce.number().min(0).default(10),
  monthly_cutoff_date: z.coerce.number().min(1).max(31).default(25),
  is_shift_mandatory: z.coerce.boolean().default(true),
  allow_early_clockin: z.coerce.boolean().default(true),
  allow_multiple_clockin: z.coerce.boolean().default(false),
});

type Values = z.infer<typeof schema>;

export function AttendanceSettings() {
  const settings = useAttendanceSettings();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      late_threshold_minutes: 10,
      monthly_cutoff_date: 25,
      is_shift_mandatory: true,
      allow_early_clockin: true,
      allow_multiple_clockin: false,
    },
  });

  useEffect(() => {
    if (!settings.data) return;
    form.reset({
      late_threshold_minutes: Number(settings.data.late_threshold_minutes || 10),
      monthly_cutoff_date: Number(settings.data.monthly_cutoff_date || 25),
      is_shift_mandatory: !!settings.data.is_shift_mandatory,
      allow_early_clockin: !!settings.data.allow_early_clockin,
      allow_multiple_clockin: !!settings.data.allow_multiple_clockin,
    });
  }, [settings.data, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {settings.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                await settings.updateSettings(values);
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="late_threshold_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Late Threshold (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthly_cutoff_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Cutoff Date</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="is_shift_mandatory"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Shift Mandatory</div>
                          <div className="text-xs text-muted-foreground">Require a shift for lateness calculation</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allow_early_clockin"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Allow Early Clock-in</div>
                          <div className="text-xs text-muted-foreground">Accept clock-ins before shift start</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allow_multiple_clockin"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        <div>
                          <div className="text-sm font-medium">Allow Multiple Clock-in</div>
                          <div className="text-xs text-muted-foreground">Enable second clock-in/out fields</div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={settings.isSaving}>
                  {settings.isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
