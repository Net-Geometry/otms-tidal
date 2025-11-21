/**
 * PWA Diagnostic information
 */
export interface PWADiagnostics {
  // Connection
  https: boolean;
  localhost: boolean;

  // Service Worker
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;

  // Manifest
  manifestFound: boolean;
  manifestValid: boolean;

  // Installation
  beforeInstallPromptSupported: boolean;
  appinstallSupported: boolean;
  installableByBrowser: boolean;

  // Icons
  iconsAccessible: boolean;
  icon192Found: boolean;
  icon512Found: boolean;

  // Device
  isStandalone: boolean;
  isInstalled: boolean;

  // Summary
  summary: string;
  issues: string[];
  recommendations: string[];
}

/**
 * Perform comprehensive PWA diagnostics
 *
 * Checks all critical PWA requirements and returns detailed diagnostic information
 * useful for troubleshooting installation issues across different browsers and devices.
 */
export const performPWADiagnostics = async (): Promise<PWADiagnostics> => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Check HTTPS requirement
  const https = window.location.protocol === 'https:';
  const localhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!https && !localhost) {
    issues.push('App is not served over HTTPS');
    recommendations.push('Deploy app with HTTPS certificate in production');
  }

  // 2. Check Service Worker support and registration
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  let serviceWorkerRegistered = false;

  if (serviceWorkerSupported) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      serviceWorkerRegistered = registrations.length > 0;

      if (!serviceWorkerRegistered) {
        issues.push('Service Worker is not registered');
        recommendations.push('Check service worker registration in main.tsx');
      }
    } catch (error) {
      issues.push('Failed to check Service Worker registration');
    }
  } else {
    issues.push('Service Worker not supported by browser');
  }

  // 3. Check Manifest
  let manifestFound = false;
  let manifestValid = false;

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestFound = true;
    try {
      const href = manifestLink.getAttribute('href');
      if (href) {
        const response = await fetch(href);
        manifestValid = response.ok;

        if (!manifestValid) {
          issues.push('Manifest file not accessible');
          recommendations.push(`Check manifest file at ${href}`);
        }
      }
    } catch (error) {
      issues.push('Failed to fetch manifest');
      recommendations.push('Ensure manifest.json is accessible from public folder');
    }
  } else {
    issues.push('Manifest link not found in HTML head');
    recommendations.push('Add <link rel="manifest" href="/manifest.json" /> to index.html');
  }

  // 4. Check installation support
  const beforeInstallPromptSupported = 'BeforeInstallPromptEvent' in window;
  const appinstallSupported = 'onappinstalled' in window;

  let installableByBrowser = beforeInstallPromptSupported || appinstallSupported;

  // For iOS, check standalone capability
  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  if (isIOS && !beforeInstallPromptSupported) {
    // iOS can still be installable via manual process
    installableByBrowser = true;
    recommendations.push('iOS uses manual installation via Share > Add to Home Screen');
  }

  // 5. Check icon accessibility
  let icon192Found = false;
  let icon512Found = false;

  try {
    const response192 = await fetch('/icons/icon-192x192.png', { method: 'HEAD' });
    icon192Found = response192.ok;

    const response512 = await fetch('/icons/icon-512x512.png', { method: 'HEAD' });
    icon512Found = response512.ok;

    if (!icon192Found || !icon512Found) {
      issues.push('Required icon sizes not found');
      recommendations.push('Ensure 192x192.png and 512x512.png icons are in /public/icons/');
    }
  } catch (error) {
    issues.push('Failed to verify icon files');
  }

  const iconsAccessible = icon192Found && icon512Found;

  // 6. Check installation status
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  // 7. Generate summary
  let summary = 'PWA installation ready';

  if (issues.length === 0) {
    summary = '✓ All PWA requirements met. App should be installable.';
  } else if (issues.length === 1) {
    summary = '⚠ One issue detected that may prevent installation.';
  } else {
    summary = `✗ ${issues.length} issues detected that may prevent installation.`;
  }

  return {
    https,
    localhost,
    serviceWorkerSupported,
    serviceWorkerRegistered,
    manifestFound,
    manifestValid,
    beforeInstallPromptSupported,
    appinstallSupported,
    installableByBrowser,
    iconsAccessible,
    icon192Found,
    icon512Found,
    isStandalone,
    isInstalled: isStandalone,
    summary,
    issues,
    recommendations,
  };
};

/**
 * Get human-readable browser name from user agent
 */
export const getBrowserName = (): string => {
  const ua = navigator.userAgent.toLowerCase();

  if (/chrome|chromium/.test(ua) && !/edg/.test(ua)) return 'Chrome';
  if (/edg/.test(ua)) return 'Edge';
  if (/firefox/.test(ua)) return 'Firefox';
  if (/safari/.test(ua) && !/chrome/.test(ua)) return 'Safari';
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS Safari';
  if (/android/.test(ua)) return 'Android Browser';

  return 'Unknown Browser';
};

/**
 * Get browser version
 */
export const getBrowserVersion = (): string => {
  const ua = navigator.userAgent;

  // Chrome/Chromium
  let match = ua.match(/Chrome\/([0-9]+)/);
  if (match) return match[1];

  // Firefox
  match = ua.match(/Firefox\/([0-9]+)/);
  if (match) return match[1];

  // Safari
  match = ua.match(/Version\/([0-9.]+).*Safari/);
  if (match) return match[1];

  // Edge
  match = ua.match(/Edg\/([0-9]+)/);
  if (match) return match[1];

  return 'Unknown';
};
