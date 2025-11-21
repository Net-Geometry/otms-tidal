/**
 * Add Holiday Form Component
 *
 * Form for adding or editing holiday overrides.
 * Includes validation, date picker, and type selection.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MergedHoliday, HolidayOverrideType } from '@/types/holiday-overrides';
import { holidayOverrideService } from '@/services/HolidayOverrideService';

const formSchema = z.object({
  date: z.date({
    required_error: 'Holiday date is required',
  }),
  name: z
    .string()
    .min(3, 'Holiday name must be at least 3 characters')
    .max(100, 'Holiday name must be less than 100 characters'),
  type: z.enum(['company', 'emergency', 'government'], {
    required_error: 'Please select a holiday type',
  }),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddHolidayFormProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  existingHoliday?: MergedHoliday | null;
}

export function AddHolidayForm({ open, onClose, existingHoliday }: AddHolidayFormProps) {
  const isEditing = !!existingHoliday;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'company',
      description: '',
    },
  });

  // Load existing holiday data when editing
  useEffect(() => {
    if (existingHoliday) {
      form.reset({
        date: new Date(existingHoliday.date),
        name: existingHoliday.name,
        type: existingHoliday.type as HolidayOverrideType,
        description: existingHoliday.description || '',
      });
    } else {
      form.reset({
        name: '',
        type: 'company',
        description: '',
      });
    }
  }, [existingHoliday, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const formattedDate = format(data.date, 'yyyy-MM-dd');

      if (isEditing) {
        // Update existing override
        const response = await holidayOverrideService.updateOverride(existingHoliday.id, {
          name: data.name,
          type: data.type,
          description: data.description,
        });

        if (response.success) {
          toast.success('Holiday updated', {
            description: `${data.name} has been updated successfully.`,
          });
          onClose(true);
        } else {
          toast.error('Failed to update holiday', {
            description: response.error,
          });
        }
      } else {
        // Create new override
        const response = await holidayOverrideService.createOverride({
          date: formattedDate,
          name: data.name,
          type: data.type,
          description: data.description,
        });

        if (response.success) {
          toast.success('Holiday created', {
            description: `${data.name} has been added on ${format(data.date, 'MMM d, yyyy')}.`,
          });
          onClose(true);
        } else {
          toast.error('Failed to create holiday', {
            description: response.error,
          });
        }
      }
    } catch (error) {
      console.error('Error saving holiday:', error);
      toast.error('Failed to save holiday');
    }
  };

  const handleCancel = () => {
    form.reset();
    onClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => handleCancel()}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Edit Holiday Override' : 'Add Holiday Override'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEditing
              ? 'Update the details for this holiday override.'
              : 'Add a new holiday to your company calendar. This will override any scraped holidays on the same date.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            {/* Date Picker */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          disabled={isEditing} // Don't allow date changes when editing
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          isEditing // Disable all dates when editing
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {isEditing && (
                    <FormDescription>
                      Date cannot be changed when editing. Delete and recreate to change date.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Holiday Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Holiday Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Company Founder Day"
                      className="h-10 sm:h-9 text-base sm:text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Holiday Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Holiday Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 sm:h-9 text-base sm:text-sm">
                        <SelectValue placeholder="Select holiday type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="company">
                        Company - Company-specific holiday
                      </SelectItem>
                      <SelectItem value="emergency">
                        Emergency - Emergency closure (triggers immediate notification)
                      </SelectItem>
                      <SelectItem value="government">
                        Government - Last-minute government change
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs sm:text-sm">
                    Emergency holidays will trigger immediate notifications to all employees.
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details about this holiday..."
                      className="resize-none text-base sm:text-sm min-h-[100px] sm:min-h-[80px]"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="w-full sm:w-auto h-10 sm:h-9 text-base sm:text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full sm:w-auto h-10 sm:h-9 text-base sm:text-sm"
              >
                {form.formState.isSubmitting
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Holiday'
                  : 'Add Holiday'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
