// src/hooks/useNotificationPreferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '@/types/notifications';
import { toast } from 'sonner';

interface UseNotificationPreferencesReturn {
  preferences: NotificationPreferences;
  isLoading: boolean;
  error: string | null;
  updatePreference: (key: keyof NotificationPreferences, value: boolean) => Promise<boolean>;
  updateAllPreferences: (preferences: NotificationPreferences) => Promise<boolean>;
}

/**
 * Hook for managing user notification preferences
 * Fetches and updates notification preferences stored in profiles.notification_preferences
 */
export const useNotificationPreferences = (): UseNotificationPreferencesReturn => {
  const queryClient = useQueryClient();

  // Fetch current user's notification preferences
  const {
    data: preferences = DEFAULT_NOTIFICATION_PREFERENCES,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required to fetch preferences');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching notification preferences:', error);
        throw error;
      }

      // Return preferences or default if null/undefined
      return (data?.notification_preferences as unknown as NotificationPreferences) || DEFAULT_NOTIFICATION_PREFERENCES;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Only fetch when component is mounted and needs data
    retry: 1, // Retry once on failure
  });

  // Mutation for updating preferences
  const updateMutation = useMutation({
    mutationFn: async (newPreferences: NotificationPreferences) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required to update preferences');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: newPreferences as unknown as any })
        .eq('id', session.user.id);

      if (error) {
        console.error('Error updating notification preferences:', error);
        throw error;
      }

      return newPreferences;
    },
    onSuccess: (newPreferences) => {
      // Update the cache immediately
      queryClient.setQueryData(['notification-preferences'], newPreferences);
    },
  });

  // Helper function to update a single preference key
  const updatePreference = async (
    key: keyof NotificationPreferences,
    value: boolean
  ): Promise<boolean> => {
    try {
      const updatedPreferences = {
        ...preferences,
        [key]: value,
      };

      await updateMutation.mutateAsync(updatedPreferences);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preference';
      console.error('Error updating preference:', err);
      toast.error('Failed to update notification preference', {
        description: errorMessage,
      });
      return false;
    }
  };

  // Helper function to update all preferences at once
  const updateAllPreferences = async (
    newPreferences: NotificationPreferences
  ): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync(newPreferences);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preferences';
      console.error('Error updating preferences:', err);
      toast.error('Failed to update notification preferences', {
        description: errorMessage,
      });
      return false;
    }
  };

  return {
    preferences,
    isLoading,
    error: queryError ? queryError.message : null,
    updatePreference,
    updateAllPreferences,
  };
};
