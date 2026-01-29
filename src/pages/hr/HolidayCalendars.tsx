import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useHolidayCalendars } from '@/hooks/hr/useHolidayCalendars';
import { useDeleteHolidayCalendar } from '@/hooks/hr/useDeleteHolidayCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HolidayCalendars() {
  const navigate = useNavigate();
  const { data: calendars, isLoading } = useHolidayCalendars();
  const { mutate: deleteCalendar } = useDeleteHolidayCalendar();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Holiday Calendars
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage holiday calendars for different years
            </p>
          </div>
          <Button onClick={() => navigate('/hr/calendar/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Calendar
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {calendars?.map((calendar) => (
            <Card key={calendar.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl line-clamp-1" title={calendar.name}>{calendar.name}</CardTitle>
                    <CardDescription>{calendar.year}</CardDescription>
                  </div>
                  <Badge variant={calendar.total_holidays < 10 ? "destructive" : "secondary"}>
                    {calendar.total_holidays} Holidays
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>From: {format(new Date(calendar.date_from), 'd MMM yyyy')}</p>
                  <p>To: {format(new Date(calendar.date_to), 'd MMM yyyy')}</p>
                  
                  {calendar.total_holidays < 10 && (
                     <div className="flex items-center gap-2 text-destructive mt-2">
                       <AlertTriangle className="h-4 w-4" />
                       <span className="text-xs">Low holiday count</span>
                     </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between gap-2">
                 <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/hr/calendar/${calendar.id}/edit`)}>
                   <Edit className="mr-2 h-4 w-4" /> Edit
                 </Button>
                 
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Calendar?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{calendar.name}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCalendar(calendar.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </CardFooter>
            </Card>
          ))}
          
          {calendars?.length === 0 && (
            <div className="col-span-full text-center py-12 border rounded-lg border-dashed text-muted-foreground">
               No holiday calendars found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
