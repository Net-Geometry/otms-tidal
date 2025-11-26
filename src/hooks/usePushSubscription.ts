import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFirebaseMessaging, isFirebaseConfigured } from '@/config/firebase';
import { getToken } from 'firebase/messaging';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

interface UsePushSubscriptionReturn {
  subscription: string | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

/**
 * Custom hook for managing Firebase Cloud Messaging subscriptions
 */
export const usePushSubscription = (): UsePushSubscriptionReturn => {
  const [subscription, setSubscription] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check for existing FCM token on mount and set up token refresh listener
   */
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log('Firebase not configured, skipping push subscription check');
      return;
    }

    const checkExistingToken = async () => {
      try {
        const messaging = getFirebaseMessaging();
        if (!messaging) {
          console.log('Firebase messaging not initialized');
          return;
        }

        // Get current token
        const token = await getToken(messaging, {
          vapidKey: VAPID_PUBLIC_KEY
        });

        if (token) {
          setSubscription(token);
          setIsSubscribed(true);
          console.log('Existing FCM token found');
        }
      } catch (err) {
        console.error('Error checking existing FCM token:', err);
      }
    };

    checkExistingToken();
  }, []);

  /**
   * Register or update FCM token with backend
   */
  const registerTokenWithBackend = async (token: string): Promise<boolean> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-push-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'subscribe',
            fcm_token: token,
            device_name: getDeviceName(),
            device_type: 'web'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to register FCM token with backend');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to register token');
      }

      console.log('FCM token registered with backend:', result.subscriptionId);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register token';
      console.error('Token registration error:', err);
      throw new Error(errorMessage);
    }
  };

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isFirebaseConfigured()) {
        throw new Error('Firebase is not configured');
      }

      const messaging = getFirebaseMessaging();
      if (!messaging) {
        throw new Error('Firebase messaging is not available');
      }

      // Check for service worker support
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported in this browser');
      }

      // Ensure service worker is registered
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.error('Service worker registration failed:', err);
        // Don't fail if service worker registration fails, it might already be registered
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY
      });

      if (!token) {
        throw new Error('Failed to get FCM token');
      }

      // Register token with backend
      await registerTokenWithBackend(token);

      // Update state
      setSubscription(token);
      setIsSubscribed(true);
      setIsLoading(false);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      console.error('Push subscription error:', err);
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!subscription) {
        throw new Error('No active subscription to unsubscribe from');
      }

      // Get authentication token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required to unsubscribe');
      }

      // Remove subscription from backend
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-push-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'unsubscribe',
            fcm_token: subscription
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove subscription from backend');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to unsubscribe');
      }

      // Update state
      setSubscription(null);
      setIsSubscribed(false);
      setIsLoading(false);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      console.error('Push unsubscribe error:', err);
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  }, [subscription]);

  return {
    subscription,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe
  };
};

/**
 * Helper function to generate a device name based on browser info
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Try to detect browser name
  let browser = 'Browser';
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Chromium') === -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';

  return `${browser} - ${date}`;
}
