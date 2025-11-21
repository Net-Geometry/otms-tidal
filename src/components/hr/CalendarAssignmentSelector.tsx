import { useState, useEffect } from 'react';
import { useAllCalendars, useEmployeeCalendarAssignment } from '@/hooks/hr/useEmployeeCalendarAssignment';
import { useUpdateEmployeeCalendar, useRemoveCalendarAssignmentOverride } from '@/hooks/hr/useUpdateEmployeeCalendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface CalendarAssignmentSelectorProps {
  employeeId: string;
  state?: string | null;
  disabled?: boolean;
}

export function CalendarAssignmentSelector({
  employeeId,
  state,
  disabled = false,
}: CalendarAssignmentSelectorProps) {
  const { data: assignedCalendar, isLoading } = useEmployeeCalendarAssignment(employeeId);
  const { data: availableCalendars } = useAllCalendars();
  const updateCalendar = useUpdateEmployeeCalendar();
  const removeOverride = useRemoveCalendarAssignmentOverride();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  // Initialize selected calendar when assigned calendar loads
  useEffect(() => {
    if (assignedCalendar) {
      setSelectedCalendarId(assignedCalendar.calendar_id);
    }
  }, [assignedCalendar]);

  const handleOpenDialog = () => {
    if (assignedCalendar) {
      setSelectedCalendarId(assignedCalendar.calendar_id);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (selectedCalendarId && selectedCalendarId !== assignedCalendar?.calendar_id) {
      updateCalendar.mutate(
        {
          employeeId,
          calendarId: selectedCalendarId,
          notes: `Manually assigned by HR`,
        },
        {
          onSuccess: () => {
            setIsDialogOpen(false);
          },
        }
      );
    } else {
      setIsDialogOpen(false);
    }
  };

  const handleResetToAuto = () => {
    removeOverride.mutate(
      { employeeId },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
        },
      }
    );
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading calendar assignment...</div>;
  }

  if (!assignedCalendar) {
    return <div className="text-sm text-muted-foreground">No calendar assigned</div>;
  }

  const stateInfo = state ? `(${state})` : '';
  const autoAssignedText = assignedCalendar.is_override
    ? 'Manually assigned'
    : 'Auto-assigned based on state';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-sm">{assignedCalendar.calendar_name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{autoAssignedText}</span>
            {assignedCalendar.is_override && (
              <Badge variant="secondary" className="text-xs">
                Override
              </Badge>
            )}
          </div>
          {assignedCalendar.state_codes && assignedCalendar.state_codes.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              States: {assignedCalendar.state_codes.join(', ')}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenDialog}
          disabled={disabled}
        >
          Change Calendar
        </Button>
      </div>

      {!assignedCalendar.is_override && state && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-700">
            Calendar is automatically matched to state: <strong>{state}</strong>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Calendar</DialogTitle>
            <DialogDescription>
              Select a calendar for this employee. {state && `Current state: ${state}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Available Calendars</label>
              <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a calendar" />
                </SelectTrigger>
                <SelectContent>
                  {availableCalendars?.map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      <div className="flex flex-col">
                        <span>{calendar.name}</span>
                        {calendar.state_codes && calendar.state_codes.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {calendar.state_codes.join(', ')}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignedCalendar.is_override && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This is a manual override. Click "Reset to Auto-Assign" to revert to location-based assignment.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            {assignedCalendar.is_override && (
              <Button
                variant="outline"
                onClick={handleResetToAuto}
                disabled={removeOverride.isPending}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Auto-Assign
              </Button>
            )}
            <div className="flex-1"></div>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={updateCalendar.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateCalendar.isPending}
            >
              Save Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
