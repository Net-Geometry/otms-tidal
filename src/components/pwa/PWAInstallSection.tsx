import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Check, Download, Smartphone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * PWAInstallSection Component
 *
 * Provides a Settings page section for manually installing the OTMS PWA.
 * Serves as a secondary install path for users who dismissed the banner or want to install later.
 *
 * Features:
 * - Shows install status (Installed / Not Installed)
 * - Install button for supported browsers (triggers native prompt)
 * - iOS-specific manual instructions (Safari doesn't support programmatic install)
 * - Browser compatibility message for unsupported browsers
 * - Responsive design with Card component matching Settings page style
 *
 * States handled:
 * 1. Installed: Shows checkmark with "App is installed" message
 * 2. Installable (non-iOS): Shows Install button
 * 3. Installable (iOS): Shows manual installation instructions
 * 4. Not supported: Shows browser compatibility message
 *
 * @returns {JSX.Element} PWA Install settings section
 */
export const PWAInstallSection = () => {
  const { isInstallable, isInstalled, isSupported, promptInstall } = usePWAInstall();

  /**
   * Handle Install button click
   * Triggers native PWA install prompt
   */
  const handleInstall = async () => {
    await promptInstall();
  };

  /**
   * Reset banner dismissal preference
   * Allows user to see the install banner again
   */
  const handleResetBannerDismissal = () => {
    localStorage.removeItem('pwa-install-banner-dismissed');
    localStorage.removeItem('pwa-install-banner-dismissed-date');
    toast.success('Install banner will appear again on page refresh');
  };

  /**
   * Detect iOS devices using user agent
   * iOS Safari doesn't support programmatic install, requires manual steps
   */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Check if user has dismissed the banner
  const isBannerDismissed = localStorage.getItem('pwa-install-banner-dismissed') === 'true';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Install App
        </CardTitle>
        <CardDescription>
          Install OTMS on your device for quick access and a native app experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInstalled ? (
          // State 1: App is already installed
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">App is installed</span>
          </div>
        ) : isInstallable ? (
          // State 2: App is installable on non-iOS browser
          <Button onClick={handleInstall}>
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        ) : isIOS ? (
          // State 3: iOS device - show manual instructions
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">To install on iOS:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Tap the Share button <span className="inline-flex items-center justify-center w-5 h-5 text-xs border rounded">⬆️</span> in Safari</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
            <p className="text-xs mt-2">
              Note: iOS doesn't support automatic installation. Follow the steps above to add OTMS to your home screen.
            </p>
          </div>
        ) : (
          // State 4: Browser doesn't support PWA installation
          <p className="text-sm text-muted-foreground">
            Install not available. Make sure you're using a supported browser (Chrome, Edge, or Safari).
          </p>
        )}
        
        {/* Banner settings section - only show if not installed */}
        {!isInstalled && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Install Banner Settings</h4>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {isBannerDismissed 
                    ? "Install banner is hidden. Click to show it again." 
                    : "Install banner will appear on pages if available."}
                </div>
                {isBannerDismissed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetBannerDismissal}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Show Banner
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
