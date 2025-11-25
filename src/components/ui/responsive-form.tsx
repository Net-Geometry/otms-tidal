import { ReactNode, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  isValid?: boolean;
}

interface ResponsiveFormWrapperProps {
  children: ReactNode;
  steps?: FormStep[];
  onSubmit?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  className?: string;
}

/**
 * ResponsiveFormWrapper handles form layouts with step-by-step mode for mobile
 *
 * Usage:
 * <ResponsiveFormWrapper
 *   steps={[
 *     { id: 'personal', title: 'Personal Info', children: <PersonalFields /> },
 *     { id: 'details', title: 'OT Details', children: <OTDetailsFields /> },
 *   ]}
 *   onSubmit={() => submitForm()}
 * >
 *   {/* On desktop, this fallback content is shown */}
 *   <FormContent />
 * </ResponsiveFormWrapper>
 */
export function ResponsiveFormWrapper({
  children,
  steps,
  onSubmit,
  submitLabel = 'Submit',
  isSubmitting = false,
  className
}: ResponsiveFormWrapperProps) {
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState(0);

  // If not mobile or no steps provided, render children as-is (desktop layout)
  if (!isMobile || !steps || steps.length === 0) {
    return <div className={className}>{children}</div>;
  }

  // Mobile step-by-step form
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Step Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{step.title}</h2>
          <span className="text-sm text-muted-foreground">
            {currentStep + 1} of {steps.length}
          </span>
        </div>
        {step.description && (
          <p className="text-sm text-muted-foreground">{step.description}</p>
        )}

        {/* Progress Bar */}
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[300px] space-y-4">
        {step.children}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={isFirstStep}
          className="flex-1 h-12"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        {!isLastStep ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={step.isValid === false}
            className="flex-1 h-12"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || step.isValid === false}
            className="flex-1 h-12"
          >
            {isSubmitting ? 'Submitting...' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
