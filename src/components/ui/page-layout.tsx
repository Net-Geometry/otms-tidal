
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PageLayoutProps {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    onBack?: () => void;
}

export function PageLayout({
    title,
    description,
    actions,
    children,
    className,
    onBack
}: PageLayoutProps) {
    return (
        <div className={cn("space-y-6 md:space-y-8 w-full max-w-7xl mx-auto", className)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    {onBack && (
                        <Button variant="ghost" size="sm" className="mt-1" onClick={onBack}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                    )}
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
                        {description && (
                            <p className="text-sm md:text-base text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
}

