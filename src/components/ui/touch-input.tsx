import { Input, InputProps } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import React from 'react';

/**
 * TouchInput - A mobile-optimized input component with proper touch targets
 * Features:
 * - Minimum 44px height on mobile for touch accessibility
 * - Larger base font on mobile (16px) to prevent zoom on iOS
 * - Proper padding for touch comfort
 * - Maintains desktop size on larger screens
 *
 * Usage:
 * <TouchInput placeholder="Enter your name" />
 * <TouchInput type="email" />
 */
export const TouchInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const isMobile = useIsMobile();

    return (
      <Input
        ref={ref}
        className={cn(
          // Mobile: larger touch targets, bigger font
          isMobile && 'h-11 text-base px-4 py-3',
          // Desktop: compact sizing
          !isMobile && 'h-9 text-sm px-3 py-2',
          className
        )}
        {...props}
      />
    );
  }
);
TouchInput.displayName = 'TouchInput';

/**
 * TouchTextarea - A mobile-optimized textarea component
 */
export const TouchTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const isMobile = useIsMobile();

  return (
    <textarea
      ref={ref}
      className={cn(
        'flex rounded-md border border-input bg-background transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        'disabled:opacity-50 resize-none',
        // Mobile: larger touch area
        isMobile && 'px-4 py-3 text-base min-h-[120px]',
        // Desktop: compact
        !isMobile && 'px-3 py-2 text-sm min-h-[100px]',
        className
      )}
      {...props}
    />
  );
});
TouchTextarea.displayName = 'TouchTextarea';

/**
 * TouchSelect - Mobile-optimized select trigger
 */
export const TouchSelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile();

  return (
    <button
      ref={ref}
      className={cn(
        'flex items-center justify-between rounded-md border border-input bg-background px-3 py-2',
        'text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        // Mobile sizing
        isMobile && 'h-11 px-4 py-3 text-base',
        // Desktop sizing
        !isMobile && 'h-9 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
TouchSelectTrigger.displayName = 'TouchSelectTrigger';
