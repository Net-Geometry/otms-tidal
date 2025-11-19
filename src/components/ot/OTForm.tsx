import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from './FileUpload';
import { calculateTotalHours, getDayTypeColor, getDayTypeLabel } from '@/lib/otCalculations';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Generate hours (00-23 in 24-hour format)
const generateHours = () => {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: hour, label: hour };
  });
};

// Generate minutes in 5-minute increments
const generateMinutes = () => {
  return Array.from({ length: 12 }, (_, i) => {
    const minute = (i * 5).toString().padStart(2, '0');
    return { value: minute, label: minute };
  });
};

// Parse HH:MM string into hour and minute
const parseTime = (timeString: string) => {
  if (!timeString) return { hour: '', minute: '' };
  const [hour, minute] = timeString.split(':');
  return { hour: hour || '', minute: minute || '' };
};

// Format hour and minute into HH:MM string
const formatTime = (hour: string, minute: string) => {
  if (!hour || !minute) return '';
  return `${hour}:${minute}`;
};

// Create schema factory that accepts requireAttachment parameter
const createOTFormSchema = (requireAttachment: boolean) => z.object({
  ot_date: z.date({
    required_error: 'OT date is required',
  }),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  reason: z.string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  attachment_urls: requireAttachment 
    ? z.array(z.string().url('Invalid file URL'))
        .min(1, 'At least one attachment is required')
        .max(5, 'Maximum 5 attachments allowed')
    : z.array(z.string().url('Invalid file URL'))
        .max(5, 'Maximum 5 attachments allowed')
        .optional(),
});

type OTFormValues = z.infer<ReturnType<typeof createOTFormSchema>>;

interface OTFormProps {
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  employeeId: string;
  fullName: string;
  onCancel: () => void;
  defaultValues?: Partial<OTFormValues>;
  requireAttachment?: boolean;
}

export function OTForm({ onSubmit, isSubmitting, employeeId, fullName, onCancel, defaultValues, requireAttachment = false }: OTFormProps) {
  const [totalHours, setTotalHours] = useState<number>(0);
  const [dayType, setDayType] = useState<string>('weekday');

  const form = useForm<OTFormValues>({
    resolver: zodResolver(createOTFormSchema(requireAttachment)),
    defaultValues: defaultValues || {
      reason: '',
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
    onSubmit({
      ot_date: format(values.ot_date, 'yyyy-MM-dd'),
      start_time: values.start_time,
      end_time: values.end_time,
      total_hours: totalHours,
      day_type: dayType,
      reason: values.reason,
      attachment_urls: values.attachment_urls,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        {/* Employee Information Card */}
        <Card className="bg-gray-50 p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <Input 
                type="text" 
                value={employeeId}
                readOnly
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input 
                type="text" 
                value={fullName}
                readOnly
                className="bg-white"
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4">
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
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date() || date < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => {
              const { hour, minute } = parseTime(field.value);
              return (
                <FormItem>
                  <FormLabel>Start Time *</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={hour}
                      onValueChange={(value) => {
                        const currentMinute = parseTime(field.value).minute || '00';
                        field.onChange(formatTime(value, currentMinute));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateHours().map((h) => (
                          <SelectItem key={h.value} value={h.value}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={minute}
                      onValueChange={(value) => {
                        const currentHour = parseTime(field.value).hour || '00';
                        field.onChange(formatTime(currentHour, value));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateMinutes().map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => {
              const { hour, minute } = parseTime(field.value);
              return (
                <FormItem>
                  <FormLabel>End Time *</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={hour}
                      onValueChange={(value) => {
                        const currentMinute = parseTime(field.value).minute || '00';
                        field.onChange(formatTime(value, currentMinute));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateHours().map((h) => (
                          <SelectItem key={h.value} value={h.value}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={minute}
                      onValueChange={(value) => {
                        const currentHour = parseTime(field.value).hour || '00';
                        field.onChange(formatTime(currentHour, value));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateMinutes().map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Total Hours</p>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)} hrs</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Day Type</p>
              <Badge className={getDayTypeColor(dayType)}>
                {getDayTypeLabel(dayType)}
              </Badge>
            </div>
          </div>
        </Card>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for OT *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please provide a detailed reason for overtime (minimum 10 characters)"
                  className="min-h-[100px] resize-none"
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

         <FormField
           control={form.control}
           name="attachment_urls"
           render={({ field }) => (
             <FormItem>
               <FormLabel>
                 Attachments {requireAttachment ? '*' : '(Optional)'}
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

        <div className="flex flex-col gap-3">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full bg-primary text-white hover:bg-primary/90"
          >
            {isSubmitting ? 'Submitting...' : 'Submit OT Request'}
          </Button>
          <Button 
            type="button" 
            variant="secondary"
            onClick={onCancel}
            className="w-full text-gray-600 border hover:bg-gray-50"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
