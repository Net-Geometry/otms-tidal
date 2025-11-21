import { useState, useEffect } from 'react';

/**
 * Return type for usePWABannerTiming hook
 */
export interface UsePWABannerTimingReturn {
  /**
   * Whether to show the banner based on user interactions
   */
  shouldShowBanner: boolean;
  /**
   * Record that user has interacted with the app
   */
  recordUserInteraction: () => void;
}

/**
 * Custom React hook for smart PWA banner timing
 *
 * Shows banner only after user has interacted with the app,
 * rather than immediately on page load. This improves UX
 * by not being intrusive for first-time visitors.
 *
 * @returns {UsePWABannerTimingReturn} Banner timing state and methods
 */
export const usePWABannerTiming = (): UsePWABannerTimingReturn => {
  const [userHasInteracted, setUserHasInteracted] = useState(() => {
    // Check if user has already interacted with the app
    return localStorage.getItem('pwa-user-interacted') === 'true';
  });

  const recordUserInteraction = () => {
    setUserHasInteracted(true);
    localStorage.setItem('pwa-user-interacted', 'true');
  };

  useEffect(() => {
    // If user already interacted, don't set up listeners
    if (userHasInteracted) return;

    // List of interaction events that indicate user engagement
    const interactionEvents = [
      'click',
      'keydown',
      'touchstart',
      'mousemove',
    ];

    // Handler to record first user interaction
    const handleUserInteraction = () => {
      recordUserInteraction();
      // Remove all listeners once we've recorded interaction
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };

    // Add event listeners for user interactions
    interactionEvents.forEach((event) => {
      window.addEventListener(event, handleUserInteraction, { once: true });
    });

    // Cleanup: Remove event listeners on unmount
    return () => {
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [userHasInteracted]);

  return {
    shouldShowBanner: userHasInteracted,
    recordUserInteraction,
  };
};
