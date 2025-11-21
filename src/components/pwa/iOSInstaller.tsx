import { AlertCircle, Share2 } from 'lucide-react';
import { useState } from 'react';

/**
 * iOSInstaller Component
 *
 * Provides detailed manual installation instructions for iOS Safari users
 * since iOS doesn't support programmatic PWA installation
 */
export function iOSInstaller() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="space-y-4 text-sm">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900">Manual Installation Required</h4>
            <p className="text-amber-700 mt-1 text-xs">
              iOS doesn't support automatic app installation. Follow these steps to add OTMS to your home screen.
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        <li
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            activeStep === 0
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-muted hover:border-primary/50'
          }`}
          onClick={() => setActiveStep(0)}
        >
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
              1
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                Tap Share Button
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Look for the share icon (⬆️) in the bottom toolbar of Safari
              </p>
            </div>
          </div>
        </li>

        <li
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            activeStep === 1
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-muted hover:border-primary/50'
          }`}
          onClick={() => setActiveStep(1)}
        >
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
              2
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Scroll Down</p>
              <p className="text-xs text-muted-foreground mt-1">
                Scroll down in the menu and find "Add to Home Screen"
              </p>
            </div>
          </div>
        </li>

        <li
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            activeStep === 2
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-muted hover:border-primary/50'
          }`}
          onClick={() => setActiveStep(2)}
        >
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
              3
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Tap Add to Home Screen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Select "Add to Home Screen" from the menu
              </p>
            </div>
          </div>
        </li>

        <li
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            activeStep === 3
              ? 'bg-primary/10 border-primary'
              : 'bg-muted/50 border-muted hover:border-primary/50'
          }`}
          onClick={() => setActiveStep(3)}
        >
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
              4
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Confirm Name & Add</p>
              <p className="text-xs text-muted-foreground mt-1">
                Verify the app name and tap "Add" to confirm
              </p>
            </div>
          </div>
        </li>
      </ol>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-xs text-green-700 font-semibold">
          ✓ Done! OTMS will now appear on your home screen as an icon.
        </p>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tip: Click on each step above to highlight instructions
      </p>
    </div>
  );
}
