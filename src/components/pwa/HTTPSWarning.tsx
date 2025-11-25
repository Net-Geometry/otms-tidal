import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useHTTPSValidation } from '@/hooks/useHTTPSValidation';

/**
 * HTTPSWarning Component
 *
 * Displays a warning banner when app is not served over HTTPS,
 * which is required for PWA functionality.
 *
 * Features:
 * - Only shows on production environments (not localhost)
 * - Dismissible banner
 * - Clear explanation of HTTPS requirement
 * - Helpful guidance for administrators
 */
export function HTTPSWarning() {
  const { shouldShowHTTPSWarning } = useHTTPSValidation();
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('https-warning-dismissed') === 'true';
  });

  // Don't show if warning not needed or already dismissed
  if (!shouldShowHTTPSWarning || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('https-warning-dismissed', 'true');
  };

  return (
    <Alert className="border-amber-200 bg-amber-50 mb-4" variant="default">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">HTTPS Required for PWA</AlertTitle>
      <AlertDescription className="text-amber-800 text-sm">
        <p className="mb-2">
          The application is not served over HTTPS. PWA installation requires a secure HTTPS connection.
        </p>
        <p className="text-xs">
          Please ensure your server is configured to use HTTPS in production.
        </p>
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="absolute right-2 top-2 h-6 w-6 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
