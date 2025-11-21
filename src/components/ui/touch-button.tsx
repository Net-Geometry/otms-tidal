import { Button, ButtonProps } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import React from 'react';

/**
 * TouchButton - A mobile-optimized button component with proper touch targets
 * Features:
 * - Minimum 44px height on mobile for touch accessibility
 * - Proper padding and spacing
 * - Maintains desktop size on larger screens
 *
 * Usage:
 * <TouchButton>Click me</TouchButton>
 * <TouchButton size="sm">Small button</TouchButton>
 * <TouchButton variant="destructive">Delete</TouchButton>
 */
export const TouchButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { expandOnMobile?: boolean }
>(({ className, children, expandOnMobile = true, ...props }, ref) => {
  const isMobile = useIsMobile();

  return (
    <Button
      ref={ref}
      className={cn(
        // Base mobile styling
        isMobile && [
          'h-11 text-base font-medium', // Min 44px height for touch targets
          expandOnMobile && 'w-full'
        ],
        // Desktop styling remains compact
        !isMobile && 'h-10 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
});
TouchButton.displayName = 'TouchButton';
