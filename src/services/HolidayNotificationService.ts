/**
 * Holiday Notification Service
 *
 * Service for sending push notifications about holidays.
 * Integrates with the existing push notification system.
 */

import { supabase } from '@/integrations/supabase/client';
import type { HolidayOverride } from '@/types/holiday-overrides';
import { format, addDays, differenceInDays } from 'date-fns';

interface HolidayNotificationData {
  type: 'holiday_reminder' | 'emergency_holiday';
  holiday_id: string;
  holiday_name: string;
  holiday_date: string;
  holiday_type: string;
  description?: string;
}

export class HolidayNotificationService {
  /**
   * Send immediate notification for emergency holidays
   *
   * This is triggered when an emergency holiday is created.
   * All employees receive an immediate notification.
   *
   * @param holiday - The emergency holiday override
   */
  async sendEmergencyHolidayNotification(holiday: HolidayOverride): Promise<void> {
    if (holiday.type !== 'emergency') {
      console.warn('sendEmergencyHolidayNotification called for non-emergency holiday');
      return;
    }

    try {
      const formattedDate = format(new Date(holiday.date), 'MMMM d, yyyy');
      const daysUntil = differenceInDays(new Date(holiday.date), new Date());

      let bodyText = `${holiday.name} on ${formattedDate} - Office closed`;
      if (daysUntil === 0) {
        bodyText = `${holiday.name} TODAY - Office closed`;
      } else if (daysUntil === 1) {
        bodyText = `${holiday.name} TOMORROW (${formattedDate}) - Office closed`;
      } else if (daysUntil > 1) {
        bodyText = `${holiday.name} in ${daysUntil} days (${formattedDate}) - Office closed`;
      }

      const notificationData: HolidayNotificationData = {
        type: 'emergency_holiday',
        holiday_id: holiday.id,
        holiday_name: holiday.name,
        holiday_date: holiday.date,
        holiday_type: holiday.type,
        description: holiday.description,
      };

      // Get all active employees
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'active');

      if (employeesError) {
        console.error('Error fetching employees for emergency notification:', employeesError);
        return;
      }

      if (!employees || employees.length === 0) {
        console.log('No active employees to notify');
        return;
      }

      // Send notification to all employees
      const sendPromises = employees.map((employee) =>
        this.sendNotificationToUser(employee.id, {
          title: '🚨 Emergency Holiday Announcement',
          body: bodyText,
          icon: '/icons/icon-192x192.png',
          data: notificationData,
        })
      );

      await Promise.allSettled(sendPromises);
      console.log(`Sent emergency holiday notifications to ${employees.length} employees`);
    } catch (error) {
      console.error('Error sending emergency holiday notification:', error);
    }
  }

  /**
   * Send day-before reminder notification for a holiday
   *
   * This is typically called by a scheduled job (e.g., cron) to remind
   * employees about holidays happening tomorrow.
   *
   * @param holiday - The holiday to remind about
   */
  async sendDayBeforeReminder(holiday: { id: string; name: string; date: string; type: string; description?: string }): Promise<void> {
    try {
      const formattedDate = format(new Date(holiday.date), 'MMMM d, yyyy (EEEE)');

      const notificationData: HolidayNotificationData = {
        type: 'holiday_reminder',
        holiday_id: holiday.id,
        holiday_name: holiday.name,
        holiday_date: holiday.date,
        holiday_type: holiday.type,
        description: holiday.description,
      };

      // Get all active employees
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('status', 'active');

      if (employeesError) {
        console.error('Error fetching employees for holiday reminder:', employeesError);
        return;
      }

      if (!employees || employees.length === 0) {
        console.log('No active employees to notify');
        return;
      }

      // Send notification to all employees
      const sendPromises = employees.map((employee) =>
        this.sendNotificationToUser(employee.id, {
          title: `📅 Holiday Tomorrow: ${holiday.name}`,
          body: `Office closed on ${formattedDate}`,
          icon: '/icons/icon-192x192.png',
          data: notificationData,
        })
      );

      await Promise.allSettled(sendPromises);
      console.log(`Sent day-before reminders to ${employees.length} employees for ${holiday.name}`);
    } catch (error) {
      console.error('Error sending day-before holiday reminder:', error);
    }
  }

  /**
   * Send push notification to a specific user
   *
   * @private
   * @param userId - Target user ID
   * @param notification - Notification content
   */
  private async sendNotificationToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      icon?: string;
      data?: HolidayNotificationData;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: userId,
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192x192.png',
          data: notification.data || {},
        },
      });

      if (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
    }
  }

  /**
   * Schedule day-before notifications for all upcoming holidays
   *
   * This method should be called by a scheduled job (e.g., daily cron)
   * to check for holidays happening tomorrow and send reminders.
   *
   * @param holidays - List of all holidays (scraped + overrides merged)
   */
  async scheduleDayBeforeNotifications(
    holidays: Array<{ id: string; name: string; date: string; type: string; description?: string }>
  ): Promise<void> {
    try {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

      // Find holidays happening tomorrow
      const tomorrowHolidays = holidays.filter((h) => h.date === tomorrowStr);

      if (tomorrowHolidays.length === 0) {
        console.log('No holidays tomorrow to notify about');
        return;
      }

      console.log(`Found ${tomorrowHolidays.length} holidays tomorrow:`, tomorrowHolidays.map(h => h.name));

      // Send reminder for each holiday
      for (const holiday of tomorrowHolidays) {
        await this.sendDayBeforeReminder(holiday);
      }
    } catch (error) {
      console.error('Error scheduling day-before notifications:', error);
    }
  }

  /**
   * Check if holiday notifications should be sent for a specific notification type
   *
   * This method checks user preferences to determine if notifications should be sent.
   * Currently, holiday notifications are separate from OT notifications.
   *
   * @param userId - User ID to check preferences for
   * @returns True if user should receive holiday notifications
   */
  async shouldSendHolidayNotification(userId: string): Promise<boolean> {
    try {
      // Check if user has disabled all notifications
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking notification preferences:', error);
        return true; // Default to sending if we can't check preferences
      }

      // If no preferences exist or all_disabled is false, send notifications
      const prefs = data?.notification_preferences as any;
      return !prefs?.all_disabled;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to sending on error
    }
  }
}

// Export singleton instance
export const holidayNotificationService = new HolidayNotificationService();
