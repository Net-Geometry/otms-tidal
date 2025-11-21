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
    // Supports both standard display-mode media query and iOS-specific navigator.standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(isStandalone);

    // Log initial PWA state
    console.log('[PWA Install] Hook initialized:', {
      isStandalone,
      beforeInstallPromptSupported: 'BeforeInstallPromptEvent' in window,
      userAgent: navigator.userAgent.substring(0, 80),
    });

    // Listen for beforeinstallprompt event (Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default install prompt from showing automatically
      e.preventDefault();
      // Store event reference for later use (when user clicks install button)
      console.log('[PWA Install] beforeinstallprompt event received and stored');
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled event (fires after successful installation)
    const handleAppInstalled = () => {
      console.log('[PWA Install] App successfully installed!');
      setIsInstalled(true);
      // Clear prompt event since app is now installed
      setPromptEvent(null);
    };

    // Register event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Log when listeners are attached
    console.log('[PWA Install] Event listeners attached');

    // Cleanup: Remove event listeners on component unmount to prevent memory leaks
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []); // Empty dependency array: run once on mount

  /**
   * Trigger the browser's native install prompt
   * Only works if beforeinstallprompt event was received and stored
   *
   * If the event is not available (some browsers/platforms don't fire it),
   * we fall back to providing instructions
   */
  const promptInstall = async () => {
    if (!promptEvent) {
      console.warn('[usePWAInstall] Install prompt event not available. This is normal on some Linux/Chrome configurations.');
      console.info('[usePWAInstall] The app is installable via Chrome\'s address bar. Look for the install icon/button next to the URL.');

      // On some platforms (especially Linux), Chrome doesn't fire beforeinstallprompt
      // but still allows installation via the address bar UI
      // Throw an error to trigger the fallback (show instructions)
      throw new Error('beforeinstallprompt event not available. Use browser\'s address bar install button.');
    }

    try {
      // Show native install prompt
      await promptEvent.prompt();

      // Wait for user's choice
      const choice = await promptEvent.userChoice;

      if (choice.outcome === 'accepted') {
        console.log('[usePWAInstall] User accepted install prompt');
        // Clear prompt event since it's been used
        setPromptEvent(null);
      } else {
        console.log('[usePWAInstall] User dismissed install prompt');
      }
    } catch (error) {
      console.error('[usePWAInstall] Error triggering install prompt', error);
    }
  };

  // Detect device info once
  const deviceInfo = detectDeviceInfo();

  // Determine if app is installable:
  // Only show Install button when we've actually received the beforeinstallprompt event
  // This prevents showing a non-functional button on platforms where the event doesn't fire (e.g., Linux Chrome)
  // On those platforms, the Instructions button guides users to the browser's native install UI
  const isInstallable = !!promptEvent && !isInstalled;

  return {
    // App can be installed (Install button shown) only if we received the beforeinstallprompt event
    isInstallable,
    isInstalled,
    // Browser supports PWA install if BeforeInstallPromptEvent exists or app is already installed
    // Note: Safari doesn't support BeforeInstallPromptEvent but can still install PWAs
    isSupported: 'BeforeInstallPromptEvent' in window || isInstalled,
    promptInstall,
    deviceInfo,
  };
};
