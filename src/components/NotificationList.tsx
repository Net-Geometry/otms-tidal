import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCheck, Bell, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function NotificationList() {
  const { notifications, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const navigate = useNavigate();

  // Icon mapping for different notification types
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ot_pending_confirmation':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'ot_supervisor_confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ot_approved':
      case 'ot_requests_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ot_rejected':
      case 'ot_requests_rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'ot_pending_review':
      case 'ot_requests_new':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {notifications.some(n => !n.is_read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead()}
            className="h-8 text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="flex flex-col">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              <button
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                  !notification.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className={cn(
                        "text-sm font-medium leading-none",
                        !notification.is_read && "font-semibold"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
              {index < notifications.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
