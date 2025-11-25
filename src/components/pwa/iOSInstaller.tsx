import { AlertCircle, Share2, Check, Home } from 'lucide-react';
import { useState } from 'react';

/**
 * IOSInstaller Component
 *
 * Provides detailed manual installation instructions for iOS Safari users
 * since iOS doesn't support programmatic PWA installation
 *
 * Works for: iPhone, iPad, and all iOS devices
 */
export function IOSInstaller() {
  const [activeStep, setActiveStep] = useState(0);
  const isStepActive = (step: number) => activeStep === step;

  const steps = [
    {
      number: 1,
      title: 'Tap Share Button',
      description: 'Look for the share icon (⬆️ box) at the bottom right of Safari. Tap it.',
      details: 'On iPad, the share button might be at the top right instead.',
    },
    {
      number: 2,
      title: 'Scroll Down in Share Menu',
      description: 'Scroll down through the action menu to find "Add to Home Screen"',
      details: 'This option appears after other sharing options like Mail, Messages, etc.',
    },
    {
      number: 3,
      title: 'Tap "Add to Home Screen"',
      description: 'Select the "Add to Home Screen" option from the list',
      details: 'This option is unique to web apps and PWAs. It won\'t appear in regular websites.',
    },
    {
      number: 4,
      title: 'Confirm and Add',
      description: 'A dialog will appear showing "OTMS" as the app name with the app icon',
      details: 'Verify the name looks correct, then tap the "Add" button in the top right',
    },
  ];

  return (
    <div className="space-y-4 text-sm">
      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900">Install OTMS on Your Device</h4>
            <p className="text-blue-700 mt-1 text-xs">
              iOS and iPad don't have automatic installation like Android. Follow these 4 simple steps to add OTMS to your home screen as an app.
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.number}
            onClick={() => setActiveStep(step.number - 1)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              isStepActive(step.number - 1)
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-gray-50 border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex gap-3 items-start">
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  isStepActive(step.number - 1)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${isStepActive(step.number - 1) ? 'text-blue-900' : 'text-gray-900'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                {isStepActive(step.number - 1) && (
                  <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold text-blue-600">💡 Tip: </span>
                      {step.details}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex gap-2 items-start">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-green-900">What Happens Next</p>
            <p className="text-xs text-green-700 mt-1">
              After tapping "Add", OTMS will appear as an icon on your home screen. Tap it to launch the app in full-screen mode with quick access.
            </p>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-amber-900 mb-2">Not seeing "Add to Home Screen"?</p>
        <ul className="text-xs text-amber-800 space-y-1 ml-3">
          <li>• Make sure you're in Safari (not Chrome or another browser)</li>
          <li>• Try refreshing the page (pull down to refresh)</li>
          <li>• Close Safari completely and open it again</li>
          <li>• Check that your iOS version is iOS 15 or newer</li>
        </ul>
      </div>

      {/* Interactive Hint */}
      <p className="text-xs text-gray-500 text-center italic">
        👆 Click on each step above to see more details
      </p>
    </div>
  );
}
