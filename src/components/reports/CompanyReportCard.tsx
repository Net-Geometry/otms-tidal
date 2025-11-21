import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Users, Clock, DollarSign } from 'lucide-react';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { cn } from '@/lib/utils';

interface CompanyReportCardProps {
  companyName: string;
  companyCode: string;
  stats: {
    totalEmployees: number;
    totalHours: number;
    totalCost: number;
  };
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function CompanyReportCard({
  companyName,
  companyCode,
  stats,
  children,
  defaultExpanded = false,
}: CompanyReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="overflow-hidden border-border/50">
      <div 
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {companyName}
              </h3>
              <Badge variant="secondary" className="font-mono">
                {companyCode}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Employees:</span>
              <span className="font-semibold text-foreground">
                {stats.totalEmployees}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hours:</span>
              <span className="font-semibold text-foreground">
                {formatHours(stats.totalHours)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(stats.totalCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border/50 overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 bg-muted/20">
          {children}
        </div>
      </div>
    </Card>
  );
}
