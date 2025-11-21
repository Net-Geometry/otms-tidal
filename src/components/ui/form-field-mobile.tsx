import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface FormFieldMobileProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  helperText?: string;
  className?: string;
}

/**
 * Mobile-optimized form field wrapper with proper spacing and touch targets
 * Features:
 * - Larger touch targets (min 44px height)
 * - Adequate spacing between fields
 * - Clear error states
 * - Helper text support
 *
 * Usage:
 * <FormFieldMobile label="Full Name" required>
 *   <Input placeholder="Enter your name" />
 * </FormFieldMobile>
 */
export function FormFieldMobile({
  label,
  error,
  required = false,
  children,
  helperText,
  className
}: FormFieldMobileProps) {
  const isMobile = useIsMobile();

  // On desktop, use minimal spacing; on mobile, use generous spacing
  const spacingClass = isMobile ? 'space-y-3' : 'space-y-2';

  return (
    <div className={cn('space-y-2', spacingClass, className)}>
      {/* Label */}
      <label className="block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {/* Input Container - Ensures proper touch targets */}
      <div
        className={cn(
          'rounded-md border border-input bg-background px-3 py-2 transition-colors',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          error && 'border-destructive focus-within:ring-destructive',
          isMobile && 'py-3 px-4 text-base' // Larger padding on mobile for touch
        )}
      >
        {children}
      </div>

      {/* Helper Text or Error Message */}
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

/**
 * Form section wrapper for grouping related fields on mobile
 * Provides visual grouping and spacing on both mobile and desktop
 */
interface FormSectionMobileProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSectionMobile({
  title,
  description,
  children,
  className
}: FormSectionMobileProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        'space-y-4',
        isMobile && 'rounded-lg border border-border/50 bg-muted/30 p-4',
        !isMobile && 'space-y-3',
        className
      )}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * Inline form fields container - renders side-by-side on desktop, stacked on mobile
 */
interface FormRowProps {
  children: ReactNode;
  className?: string;
}

export function FormRow({ children, className }: FormRowProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        'grid gap-4',
        !isMobile && 'grid-cols-2',
        isMobile && 'grid-cols-1',
        className
      )}
    >
      {children}
    </div>
  );
}
