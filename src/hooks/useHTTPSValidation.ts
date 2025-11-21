import { useState, useEffect } from 'react';

/**
 * Return type for useHTTPSValidation hook
 */
export interface UseHTTPSValidationReturn {
  /**
   * True if app is served over HTTPS (required for PWA)
   */
  isHTTPS: boolean;
  /**
   * True if running in development/localhost (where HTTP is acceptable)
   */
  isLocalhost: boolean;
  /**
   * True if HTTPS validation has completed
   */
  isReady: boolean;
  /**
   * Whether user should see HTTPS warning
   */
  shouldShowHTTPSWarning: boolean;
}

/**
 * Custom React hook to validate HTTPS requirement for PWA
 *
 * PWAs require HTTPS for security reasons (except localhost for development).
 * This hook checks:
 * - If running over HTTPS
 * - If running on localhost/127.0.0.1 (development)
 * - Whether to show warning to user
 *
 * @returns {UseHTTPSValidationReturn} HTTPS validation state
 */
export const useHTTPSValidation = (): UseHTTPSValidationReturn => {
  const [isHTTPS, setIsHTTPS] = useState(true);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if using HTTPS
    const https = window.location.protocol === 'https:';
    setIsHTTPS(https);

    // Check if localhost/127.0.0.1 (development)
    const hostname = window.location.hostname;
    const localhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    setIsLocalhost(localhost);

    // Mark validation as complete
    setIsReady(true);

    // Log for debugging
    if (!https && !localhost) {
      console.warn('[PWA] App is not served over HTTPS. PWA features may not work correctly.');
      console.warn('[PWA] Hostname:', hostname);
    }
  }, []);

  // Show warning if not HTTPS and not localhost
  const shouldShowHTTPSWarning = isReady && !isHTTPS && !isLocalhost;

  return {
    isHTTPS,
    isLocalhost,
    isReady,
    shouldShowHTTPSWarning,
  };
};
