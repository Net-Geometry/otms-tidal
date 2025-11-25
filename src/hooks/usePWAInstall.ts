import { useState, useEffect } from 'react';

/**
 * Browser API for PWA install prompt event
 * Extends standard Event with PWA-specific methods
 */
interface BeforeInstallPromptEvent extends Event {
  /**
   * Programmatically trigger the native install prompt
   */
  prompt: () => Promise<void>;
  /**
   * Promise that resolves with user's choice (accepted or dismissed)
   */
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Device and browser information detected at runtime
 */
export interface DeviceInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isChrome: boolean;
  isEdge: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  browserName: string;
}

/**
 * Return type for usePWAInstall hook
 */
export interface UsePWAInstallReturn {
  /**
   * True if app can be installed (beforeinstallprompt received and app not already installed)
   */
  isInstallable: boolean;
  /**
   * True if app is already installed (running in standalone mode)
   */
  isInstalled: boolean;
  /**
   * True if browser supports PWA installation
   */
  isSupported: boolean;
  /**
   * Trigger native install prompt (only works if isInstallable is true)
   */
  promptInstall: () => Promise<void>;
  /**
   * Device and browser information
   */
  deviceInfo: DeviceInfo;
}

/**
 * Global reference to the most recent beforeinstallprompt event
 * This is set in main.tsx and accessed here
 */
declare global {
  interface Window {
    __pwaPromptEvent?: BeforeInstallPromptEvent | null;
  }
}

/**
 * Detect device and browser type
 * Uses user agent parsing and modern APIs
 */
const detectDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent.toLowerCase();

  // Device detection
  const isAndroid = /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isDesktop = !/mobile|android|iphone|ipad/.test(ua);
  const isMobile = !isDesktop;

  // Browser detection
  const isChrome = /chrome|chromium/.test(ua) && !/edg/.test(ua);
  const isEdge = /edg/.test(ua);
  const isFirefox = /firefox/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua);

  // Determine browser name for display
  let browserName = 'Unknown';
  if (isChrome) browserName = 'Chrome';
  else if (isEdge) browserName = 'Edge';
  else if (isFirefox) browserName = 'Firefox';
  else if (isSafari) browserName = 'Safari';

  return {
    isAndroid,
    isIOS,
    isChrome,
    isEdge,
    isFirefox,
    isSafari,
    isDesktop,
    isMobile,
    browserName,
  };
};

/**
 * Custom React hook to detect PWA install state and browser support
 *
 * Detects:
 * - Whether app is already installed (standalone mode)
 * - Whether browser supports PWA installation
 * - Whether app is installable (beforeinstallprompt event received)
 * - Device and browser information for targeted install guidance
 *
 * Provides method to programmatically trigger install prompt
 *
 * Browser Support:
 * - Chrome/Edge: Full support (beforeinstallprompt, appinstalled events)
 * - Safari iOS 16.4+: Standalone detection only (no programmatic prompt)
 * - Firefox: Limited support (may not fire beforeinstallprompt)
 * - Android Chrome: Full support with standard beforeinstallprompt
 *
 * @returns {UsePWAInstallReturn} Install state, control methods, and device info
 */
export const usePWAInstall = (): UsePWAInstallReturn => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(isStandalone);

    // Check if event was already captured in main.tsx
    if (window.__pwaPromptEvent) {
      setPromptEvent(window.__pwaPromptEvent);
      console.log('[PWA Install] Hook initialized with cached event');
    }

    // Also listen for the event in case it fires after hook mounts
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      console.log('[PWA Install] beforeinstallprompt event received');
      setPromptEvent(event);
      window.__pwaPromptEvent = event;
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA Install] App successfully installed!');
      setIsInstalled(true);
      setPromptEvent(null);
      window.__pwaPromptEvent = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    console.log('[PWA Install] Hook initialized:', {
      isStandalone,
      beforeInstallPromptSupported: 'BeforeInstallPromptEvent' in window,
      userAgent: navigator.userAgent.substring(0, 80),
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!promptEvent) {
      console.warn('[usePWAInstall] Install prompt event not available. Use browser\'s address bar install button.');
      throw new Error('beforeinstallprompt event not available. Use browser\'s address bar install button.');
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === 'accepted') {
        console.log('[usePWAInstall] User accepted install prompt');
        setPromptEvent(null);
        window.__pwaPromptEvent = null;
      } else {
        console.log('[usePWAInstall] User dismissed install prompt');
      }
    } catch (error) {
      console.error('[usePWAInstall] Error triggering install prompt', error);
      throw error;
    }
  };

  const deviceInfo = detectDeviceInfo();
  const isInstallable = !!promptEvent && !isInstalled;

  // Determine if browser supports PWA installation in ANY form
  // - Desktop browsers: check for BeforeInstallPromptEvent
  // - Mobile browsers: always true (Android has beforeinstallprompt, iOS has manual instructions)
  // - Already installed: true (can show install success state)
  // This ensures banner shows on all platforms with appropriate fallback UI
  const isSupported =
    'BeforeInstallPromptEvent' in window ||  // Chrome/Edge desktop & Android
    isInstalled ||                            // Already installed anywhere
    deviceInfo.isMobile;                      // Mobile: always support (iOS manual, Android native)

  return {
    isInstallable,
    isInstalled,
    isSupported,
    promptInstall,
    deviceInfo,
  };
};
