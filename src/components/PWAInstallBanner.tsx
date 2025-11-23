import { useState, useEffect } from 'react';
import { X, Download, Smartphone, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAuth } from '@/hooks/useAuth';
import { usePWABannerTiming } from '@/hooks/usePWABannerTiming';
import { AndroidChromeInstaller } from '@/components/pwa/AndroidChromeInstaller';
import { iOSInstaller } from '@/components/pwa/iOSInstaller';
import { FirefoxInstaller } from '@/components/pwa/FirefoxInstaller';
import { FallbackInstaller } from '@/components/pwa/FallbackInstaller';
import { logPWAEvent } from '@/lib/pwaAnalytics';

/**
 * PWAInstallBanner - Unified PWA Installation Prompt
 *
 * This is the consolidated PWA install banner that handles:
 * - Showing installable PWA prompt to authenticated users
 * - Handling both automatic (Chrome/Edge) and manual (iOS) installation flows
 * - Respecting user dismiss preferences with 7-day reset interval
 * - Fallback to manual instructions if automatic install fails
 *
 * Features:
 * - Fixed position banner (top-left on mobile, centered on desktop)
 * - Automatic dismiss after installation
 * - Re-shows after 7 days to remind users
 * - Graceful fallback for unsupported browsers
 * - Auth-gated to only show for authenticated users
 */
export function PWAInstallBanner() {
  const { user } = useAuth();
  const { isInstallable, isInstalled, promptInstall, isSupported, deviceInfo } = usePWAInstall();
  const { shouldShowBanner } = usePWABannerTiming();
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check if user has dismissed the banner before
    return localStorage.getItem('pwa-install-banner-dismissed') === 'true';
  });
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [expandedInstructions, setExpandedInstructions] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Reset dismissal after 7 days to remind users again
  useEffect(() => {
    const dismissedDate = localStorage.getItem('pwa-install-banner-dismissed-date');
    if (dismissedDate) {
      const daysSince = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        localStorage.removeItem('pwa-install-banner-dismissed');
        localStorage.removeItem('pwa-install-banner-dismissed-date');
        setIsDismissed(false);
      }
    }
  }, []);

  // Log banner shown event when conditions are right
  useEffect(() => {
    if (shouldShowBanner && !isDismissed && isSupported && user) {
      logPWAEvent('prompt_shown', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`, {
        installable: isInstallable,
        userAgent: navigator.userAgent.substring(0, 100),
      });
    }
  }, [shouldShowBanner, isDismissed, isSupported, user, isInstallable, deviceInfo]);

  // Watch for successful installation and show success message
  useEffect(() => {
    if (isInstalled && installSuccess) {
      // Log successful installation
      logPWAEvent('install_success', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`);

      // Auto-hide banner after showing success message for 3 seconds
      const timer = setTimeout(() => {
        setIsDismissed(true);
        localStorage.setItem('pwa-install-banner-dismissed', 'true');
        localStorage.setItem('pwa-install-banner-dismissed-date', Date.now().toString());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isInstalled, installSuccess, deviceInfo]);

  // Check if banner should be shown
  // Must be done AFTER all hooks are called
  // Show for: authenticated user, not installed, not dismissed, supported browser, after user interaction
  const shouldDisplay = user && !isInstalled && !isDismissed && isSupported && shouldShowBanner;

  // Early return after all hooks have been called
  // Note: shouldDisplay requires shouldShowBanner which waits for user interaction before showing
  // On desktop it shows after click/scroll, on mobile after any interaction (tap/scroll)
  if (!shouldDisplay) {
    return null;
  }

  const handleInstall = async () => {
    logPWAEvent('prompt_clicked', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`);

    if (isInstallable) {
      try {
        await promptInstall();
        // Show success message after install attempt
        logPWAEvent('prompt_accepted', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`);
        setInstallSuccess(true);
        setExpandedInstructions(false);
        // Banner will automatically hide when app is installed due to isInstalled check
      } catch (error) {
        console.error('Failed to install PWA:', error);
        logPWAEvent('install_failed', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`, {
          error: String(error),
        });
        // Show instructions if automatic install fails
        setExpandedInstructions(true);
      }
    } else {
      // Show instructions for browsers that don't support automatic install
      setExpandedInstructions(true);
    }
  };

  const handleDismiss = () => {
    logPWAEvent('prompt_dismissed', deviceInfo.browserName, `${deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'Desktop'}`);
    setIsDismissed(true);
    // Remember user's choice with timestamp
    localStorage.setItem('pwa-install-banner-dismissed', 'true');
    localStorage.setItem('pwa-install-banner-dismissed-date', Date.now().toString());
  };

  // Helper function to render appropriate installation instructions
  const renderInstructions = () => {
    if (deviceInfo.isIOS) {
      return <iOSInstaller />;
    } else if (deviceInfo.isChrome || deviceInfo.isEdge) {
      // Chrome and Edge have full PWA support on both Android and Desktop
      return <AndroidChromeInstaller />;
    } else if (deviceInfo.isFirefox) {
      return <FirefoxInstaller />;
    } else {
      return <FallbackInstaller />;
    }
  };

  // If installation was successful, show success message
  if (installSuccess && isInstalled) {
    return (
      <Card className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-96 z-50 p-4 shadow-lg border-green-200 bg-green-50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-green-900">App Installed Successfully!</h3>
            <p className="text-xs text-green-700 mt-1">OTMS is ready to use offline.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`fixed left-4 right-4 z-50 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm transition-all duration-300 ${
      expandedInstructions
        ? 'top-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md'
        : 'top-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-96'
    } ${expandedInstructions ? 'p-4' : 'p-4'}`}>
      <div className="space-y-4">
        {/* Header Section */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Install OTMS App
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {expandedInstructions
                ? `Installation guide for ${deviceInfo.browserName}`
                : 'Get quick access and work offline.'
              }
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Action Buttons */}
        {!expandedInstructions && (
          <div className="flex items-center gap-2">
            {isInstallable && (
              <Button
                size="sm"
                onClick={handleInstall}
                className="h-8 text-xs whitespace-nowrap"
              >
                <Download className="h-3 w-3 mr-1" />
                Install
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedInstructions(true)}
              className="h-8 text-xs"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Instructions
            </Button>
          </div>
        )}

        {/* Expanded Instructions */}
        {expandedInstructions && (
          <div className="space-y-3">
            {renderInstructions()}
            <div className="flex gap-2 pt-2 border-t">
              {isInstallable && (
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1 h-8 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Install Now
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedInstructions(false)}
                className="flex-1 h-8 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}