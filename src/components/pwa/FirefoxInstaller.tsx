import { AlertCircle, Info } from 'lucide-react';

/**
 * FirefoxInstaller Component
 *
 * Provides installation guidance for Firefox users
 * Firefox has limited PWA support, so we provide alternative approaches
 */
export function FirefoxInstaller() {
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-orange-900">Limited Support in Firefox</h4>
            <p className="text-orange-700 mt-1 text-xs">
              Firefox has limited PWA installation support. Try using Chrome or Edge for the best experience.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Add to Shortcuts (Alternative)</h4>
            <ol className="space-y-2 ml-2">
              <li className="text-xs text-blue-700">
                <span className="font-semibold">1.</span> Press the menu button (☰) in the top right
              </li>
              <li className="text-xs text-blue-700">
                <span className="font-semibold">2.</span> Select "Create Shortcut"
              </li>
              <li className="text-xs text-blue-700">
                <span className="font-semibold">3.</span> Confirm to create a desktop shortcut
              </li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        <p className="font-semibold mb-1">💡 Pro Tip</p>
        <p>
          For the best PWA experience and app-like behavior, consider using Chrome, Edge, or Safari on iOS.
        </p>
      </div>
    </div>
  );
}
