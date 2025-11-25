import { AlertCircle, BookOpen } from 'lucide-react';

/**
 * FallbackInstaller Component
 *
 * Provides basic guidance for unsupported browsers
 */
export function FallbackInstaller() {
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900">Browser Not Supported</h4>
            <p className="text-gray-700 mt-1 text-xs">
              Your browser doesn't support PWA installation. Please update to a modern browser.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2">
          <BookOpen className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Supported Browsers</h4>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>✓ Chrome 51+</li>
              <li>✓ Edge 15+</li>
              <li>✓ Safari 15.1+ (iOS)</li>
              <li>✓ Firefox 55+ (limited support)</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        You can still use OTMS normally in your browser, but PWA app features like home screen shortcuts won't be available.
      </p>
    </div>
  );
}
