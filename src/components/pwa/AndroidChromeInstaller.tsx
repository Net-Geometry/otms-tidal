import { AlertCircle, CheckCircle2, Download, MapPin } from 'lucide-react';

/**
 * ChromeEdgeInstaller Component
 *
 * Provides step-by-step installation instructions for Chrome and Edge browsers
 * Works on both desktop and Android platforms
 */
export function AndroidChromeInstaller() {
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900">Install OTMS App</h4>
            <p className="text-blue-700 mt-1">
              Your browser supports app installation. Use the Install button or browser menu to add OTMS to your device.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-foreground mb-2">Option 1: Use the Install Button</h4>
          <ol className="space-y-2 ml-2">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
                1
              </span>
              <div className="text-xs text-muted-foreground">
                Click the "Install" button above
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
                2
              </span>
              <div className="text-xs text-muted-foreground">
                Confirm in the browser popup
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-semibold">
                3
              </span>
              <div className="text-xs text-muted-foreground">
                OTMS will be installed on your device
              </div>
            </li>
          </ol>
        </div>

        <div className="border-t pt-3">
          <h4 className="font-semibold text-foreground mb-2">Option 2: Use Browser Menu (Linux/Desktop)</h4>
          <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded p-2">
            <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Look for the <strong>install icon</strong> in your browser's address bar (right side of URL) or access it via the menu (⋮) → "Install app"
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-green-700">
          <p className="font-semibold">Once installed, you get:</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            <li>Offline access</li>
            <li>App-like experience</li>
            <li>Quick access from home screen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
