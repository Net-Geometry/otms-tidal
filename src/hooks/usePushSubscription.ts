import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VAPIDAPIResponse } from '@/types/vapid';

interface UsePushSubscriptionReturn {
  subscription: PushSubscription | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

/**
 * Helper function to convert base64 VAPID key to Uint8Array
 * Required for service worker push subscription API
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushSubscription = (): UsePushSubscriptionReturn => {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check for existing subscription on mount
   */
  useEffect(() => {
    const checkExistingSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
          setSubscription(existingSubscription);
          setIsSubscribed(true);
        }
      } catch (err) {
        console.error('Error checking existing subscription:', err);
      }
    };

    checkExistingSubscription();
  }, []);

  /**
   * Fetch VAPID public key from backend
   */
  const fetchVAPIDPublicKey = async (): Promise<string | null> => {
    try {
      // Get authentication token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required to fetch VAPID public key');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapid-public-key`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch VAPID public key');
      }

      const data: VAPIDAPIResponse = await response.json();

      if (!data.success) {
        throw new Error('error' in data ? data.error : 'Failed to fetch VAPID public key');
      }

      return data.publicKey;
    } catch (err) {
      console.error('Error fetching VAPID public key:', err);
      setError('Failed to fetch VAPID configuration');
      return null;
    }
  };

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check service worker and push manager support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Fetch VAPID public key
      const vapidPublicKey = await fetchVAPIDPublicKey();
      if (!vapidPublicKey) {
        throw new Error('Failed to get VAPID public key');
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe via service worker
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Get authentication token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required to subscribe to push notifications');
      }

      // Send subscription to backend API
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
            subscription: {
              endpoint: newSubscription.endpoint,
              keys: {
                p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')),
                auth: arrayBufferToBase64(newSubscription.getKey('auth'))
              }
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save subscription to backend');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to save subscription');
      }

      // Update state
      setSubscription(newSubscription);
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
        throw new Error('Authentication required to unsubscribe from push notifications');
      }

      // Unsubscribe from service worker
      await subscription.unsubscribe();

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
            endpoint: subscription.endpoint
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove subscription from backend');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to remove subscription');
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
 * Helper function to convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
