import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedEmployeeDashboardCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'purple' | 'yellow' | 'green';
}

export function EnhancedEmployeeDashboardCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle,
  variant = 'purple'
}: EnhancedEmployeeDashboardCardProps) {
  const gradientClasses = {
    purple: 'from-primary/20 to-primary/10',
    yellow: 'from-warning/20 to-warning/10',
    green: 'from-success/20 to-success/10',
  };

  const iconColorClasses = {
    purple: 'text-primary',
    yellow: 'text-warning',
    green: 'text-success',
  };

  return (
    <Card className={cn(
      'border-0 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02]',
      'bg-gradient-to-br rounded-2xl',
      gradientClasses[variant]
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold text-foreground">{value}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn(
            'h-14 w-14 rounded-full flex items-center justify-center',
            'bg-card shadow-sm',
            iconColorClasses[variant]
          )}>
            <Icon className="h-7 w-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
