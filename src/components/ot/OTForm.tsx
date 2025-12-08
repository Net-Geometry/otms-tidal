import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from './FileUpload';
import { TimePickerInput } from './TimePickerInput';
import { calculateTotalHours, getDayTypeColor, getDayTypeLabel } from '@/lib/otCalculations';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSupervisors } from '@/hooks/useSupervisors';
import { canSubmitOTForDate } from '@/utils/otValidation';

// Fixed schema with optional attachments for all employees
const OTFormSchema = z.object({
  ot_date: z.date({
    required_error: 'OT date is required',
  }),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  reason: z.string()
    .max(500, 'Reason cannot exceed 500 characters')
    .optional(),
  attachment_urls: z.array(z.string().url('Invalid file URL'))
    .max(5, 'Maximum 5 attachments allowed')
    .optional()
    .default([]),
  reason_dropdown: z.enum([
    'System maintenance',
    'Project deadline',
    'Unexpected breakdown',
    'Client support',
    'Staff shortage',
    'Other'
  ], {
    required_error: 'Please select a reason for overtime',
  }),
  respective_supervisor_id: z.string().uuid().optional().or(z.literal('none')),
}).refine((data) => {
  if (data.reason_dropdown === 'Other') {
    return data.reason && data.reason.trim().length >= 10;
  }
  return true;
}, {
  message: 'Please provide a detailed reason (minimum 10 characters)',
  path: ['reason'],
}).refine((data) => {
  // Validate that end_time is after start_time
  if (data.start_time && data.end_time) {
    const [startHour, startMinute] = data.start_time.split(':').map(Number);
    const [endHour, endMinute] = data.end_time.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    return endTimeInMinutes > startTimeInMinutes;
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['end_time'],
});

type OTFormValues = z.infer<typeof OTFormSchema>;

interface OTFormProps {
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  employeeId: string;
  fullName: string;
  onCancel: () => void;
  defaultValues?: Partial<OTFormValues>;
}

export function OTForm({ onSubmit, isSubmitting, employeeId, fullName, onCancel, defaultValues }: OTFormProps) {
  const [totalHours, setTotalHours] = useState<number>(0);
  const [dayType, setDayType] = useState<string>('weekday');
  const [cutoffDay, setCutoffDay] = useState<number>(10);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Use the custom hook to fetch supervisors, excluding the employee's direct supervisor
  const { data: supervisors = [] } = useSupervisors({ employeeId });

  // Fetch cutoff day from settings
  useEffect(() => {
    const fetchCutoffDay = async () => {
      try {
        const { data, error } = await supabase
          .from('ot_settings')
          .select('ot_submission_cutoff_day')
          .single();

        if (error) {
          setCutoffDay(10); // Fallback to default
        } else if (data?.ot_submission_cutoff_day) {
          setCutoffDay(data.ot_submission_cutoff_day);
        }
      } catch (err) {
        setCutoffDay(10); // Fallback to default
      }
    };

    fetchCutoffDay();
  }, []);

  const form = useForm<OTFormValues>({
    resolver: zodResolver(OTFormSchema),
    defaultValues: defaultValues || {
      reason: '',
      respective_supervisor_id: 'none',
      attachment_urls: [],
    },
  });

  const startTime = form.watch('start_time');
  const endTime = form.watch('end_time');
  const otDate = form.watch('ot_date');

  useEffect(() => {
    if (startTime && endTime) {
      const hours = calculateTotalHours(startTime, endTime);
      setTotalHours(hours);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (otDate) {
      determineDayType(otDate);
    }
  }, [otDate]);

  const determineDayType = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    // Check if public holiday
    const { data: holiday } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('holiday_date', dateStr)
      .single();

    if (holiday) {
      setDayType('public_holiday');
    } else if (dayOfWeek === 0) {
      setDayType('sunday');
    } else if (dayOfWeek === 6) {
      setDayType('saturday');
    } else {
      setDayType('weekday');
    }
  };

  const handleSubmit = (values: OTFormValues) => {
    const finalReason = values.reason_dropdown === 'Other'
      ? values.reason?.trim() || 'Other'
      : values.reason_dropdown;

    onSubmit({
      ot_date: format(values.ot_date, 'yyyy-MM-dd'),
      start_time: values.start_time,
      end_time: values.end_time,
      total_hours: totalHours,
      day_type: dayType,
      reason: finalReason,
      respective_supervisor_id: values.respective_supervisor_id === 'none' ? null : values.respective_supervisor_id,
      attachment_urls: values.attachment_urls,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-5">
        {/* Employee Information Card */}
        <Card className="bg-card p-3 sm:p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 sm:mb-1">
                Employee ID
              </label>
              <Input
                type="text"
                value={employeeId}
                readOnly
                className="bg-muted h-10 sm:h-9 text-base sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 sm:mb-1">
                Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                readOnly
                className="bg-muted h-10 sm:h-9 text-base sm:text-sm"
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name="ot_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>OT Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 text-foreground/60 dark:text-foreground/50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        if (date) {
                          const validation = canSubmitOTForDate(date, new Date(), cutoffDay);
                          if (validation.isAllowed) {
                            field.onChange(date);
                            setSubmissionError(null);
                          } else {
                            setSubmissionError(validation.message || 'This date is not allowed for OT submission');
                          }
                        }
                      }}
                      disabled={(date) => {
                        const validation = canSubmitOTForDate(date, new Date(), cutoffDay);
                        return !validation.isAllowed;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
                {submissionError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time *</FormLabel>
                <FormControl>
                  <TimePickerInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time *</FormLabel>
                <FormControl>
                  <TimePickerInput
                    value={field.value}
                    onChange={field.onChange}
                    minTime={startTime}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Card className="p-3 sm:p-4 bg-muted/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Hours</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{totalHours.toFixed(1)} hrs</p>
            </div>
            <div className="flex flex-col items-start sm:items-end">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Day Type</p>
              <Badge className={getDayTypeColor(dayType)}>
                {getDayTypeLabel(dayType)}
              </Badge>
            </div>
          </div>
        </Card>

        <FormField
          control={form.control}
          name="reason_dropdown"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger className="w-full h-10 sm:h-9 text-base sm:text-sm">
                    <SelectValue placeholder="Select a reason category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="System maintenance">System maintenance</SelectItem>
                  <SelectItem value="Project deadline">Project deadline</SelectItem>
                  <SelectItem value="Unexpected breakdown">Unexpected breakdown</SelectItem>
                  <SelectItem value="Client support">Client support</SelectItem>
                  <SelectItem value="Staff shortage">Staff shortage</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('reason_dropdown') === 'Other' && (
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for OT</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Please provide a detailed reason for overtime (minimum 10 characters)"
                    className="min-h-[100px] sm:min-h-[120px] resize-none text-base sm:text-sm"
                    {...field}
                  />
                </FormControl>
                <div className="text-xs text-muted-foreground text-right">
                  {field.value?.length || 0} / 500 characters
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="respective_supervisor_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructed by Supervisor (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger className="w-full h-10 sm:h-9 text-base sm:text-sm">
                    <SelectValue placeholder="Select if another supervisor instructed this OT" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None - Direct supervisor only</SelectItem>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.full_name} ({supervisor.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs sm:text-sm text-muted-foreground">
                If a different supervisor instructed you to work overtime, select them here. They will be asked to confirm before your direct supervisor approves.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attachment_urls"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Attachments (Optional)
              </FormLabel>
              <FormControl>
                <FileUpload
                  onUploadComplete={(urls) => field.onChange(urls)}
                  onRemove={(index) => {
                    const newUrls = [...(field.value || [])];
                    newUrls.splice(index, 1);
                    field.onChange(newUrls);
                  }}
                  currentFiles={field.value || []}
                  maxFiles={5}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 sm:gap-3 pt-2 sm:pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 sm:h-10 bg-primary text-white hover:bg-primary/90 text-base sm:text-sm font-medium"
          >
            {isSubmitting ? 'Submitting...' : 'Submit OT Request'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="w-full h-11 sm:h-10 text-base sm:text-sm font-medium"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
