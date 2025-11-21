import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  mobileClassName?: string;
  desktopClassName?: string;
  mobileMaxWidth?: boolean;
}

/**
 * ResponsiveContainer - Automatically adjusts padding and width for mobile/desktop
 * Features:
 * - Proper padding for mobile (16px) and desktop (24px)
 * - Optional responsive max-width constraints
 * - Safe area handling for notched phones
 *
 * Usage:
 * <ResponsiveContainer>
 *   <h1>Your content</h1>
 * </ResponsiveContainer>
 */
export function ResponsiveContainer({
  children,
  className,
  mobileClassName,
  desktopClassName,
  mobileMaxWidth = false
}: ResponsiveContainerProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        // Base responsive padding
        isMobile
          ? 'px-4 py-3 safe-area-inset'
          : 'px-6 py-4 lg:px-8',

        // Max width on mobile (full-width by default)
        isMobile && mobileMaxWidth && 'w-full max-w-full',

        // Apply variant classes
        isMobile && mobileClassName,
        !isMobile && desktopClassName,

        // User custom class
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * ResponsivePage - Full-page wrapper with proper safe area handling
 */
interface ResponsivePageProps {
  children: ReactNode;
  className?: string;
  noContainer?: boolean;
}

export function ResponsivePage({
  children,
  className,
  noContainer = false
}: ResponsivePageProps) {
  const isMobile = useIsMobile();

  const containerClass = cn(
    'min-h-screen bg-background',
    !noContainer && (
      isMobile
        ? 'px-4 py-3 safe-area-inset-horizontal'
        : 'px-6 py-4 lg:px-8'
    ),
    className
  );

  return <div className={containerClass}>{children}</div>;
}

/**
 * ResponsiveGrid - Grid that adapts columns for mobile/tablet/desktop
 */
interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className
}: ResponsiveGridProps) {
  const isMobile = useIsMobile();

  const gapClass = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }[gap];

  const gridColsClass = isMobile
    ? `grid-cols-${cols.mobile}`
    : `lg:grid-cols-${cols.desktop} md:grid-cols-${cols.tablet}`;

  return (
    <div className={cn('grid', gridColsClass, gapClass, className)}>
      {children}
    </div>
  );
}

/**
 * ResponsiveStack - Flexbox column that adjusts spacing for mobile/desktop
 */
interface ResponsiveStackProps {
  children: ReactNode;
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  horizontal?: boolean;
}

export function ResponsiveStack({
  children,
  spacing = 'md',
  className,
  horizontal = false
}: ResponsiveStackProps) {
  const isMobile = useIsMobile();

  const spacingMap = {
    xs: { mobile: 'space-y-2', desktop: 'space-y-2' },
    sm: { mobile: 'space-y-3', desktop: 'space-y-2' },
    md: { mobile: 'space-y-4', desktop: 'space-y-4' },
    lg: { mobile: 'space-y-6', desktop: 'space-y-4' },
    xl: { mobile: 'space-y-8', desktop: 'space-y-6' }
  };

  const spacingClass = isMobile
    ? spacingMap[spacing].mobile
    : spacingMap[spacing].desktop;

  return (
    <div
      className={cn(
        horizontal ? 'flex flex-row' : 'flex flex-col',
        spacingClass,
        className
      )}
    >
      {children}
    </div>
  );
}
