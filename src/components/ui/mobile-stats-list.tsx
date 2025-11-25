import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface MobileStatItem {
    id: string | number;
    label: string;
    value: string | number;
    subValue?: string;
    icon?: ReactNode;
    color?: string;
    onClick?: () => void;
}

interface MobileStatsListProps {
    title: string;
    description?: string;
    items: MobileStatItem[];
    totalLabel?: string;
    totalValue?: string | number;
    trend?: {
        value: number;
        label: string;
        positiveIsGood?: boolean;
    };
    className?: string;
    columns?: 1 | 2;
}

export function MobileStatsList({
    title,
    description,
    items,
    totalLabel,
    totalValue,
    trend,
    className,
    columns = 1
}: MobileStatsListProps) {
    return (
        <Card className={cn("shadow-md rounded-xl", className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className={cn("grid gap-3", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "p-3 bg-muted/30 rounded-lg flex items-center justify-between",
                                columns === 2 && "flex-col text-center justify-center gap-2"
                            )}
                            onClick={item.onClick}
                        >
                            <div className={cn("flex items-center gap-3", columns === 2 && "justify-center")}>
                                {item.icon && <div className="text-muted-foreground">{item.icon}</div>}
                                <span className="font-medium text-sm">{item.label}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span
                                    className="text-lg font-bold"
                                    style={item.color ? { color: item.color } : undefined}
                                >
                                    {item.value}
                                </span>
                                {item.subValue && (
                                    <span className="text-xs text-muted-foreground">{item.subValue}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {(totalValue !== undefined || trend) && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                        {totalValue !== undefined && (
                            <div className="text-sm text-muted-foreground">
                                {totalLabel || 'Total'}: <span className="font-semibold text-foreground">{totalValue}</span>
                            </div>
                        )}

                        {trend && (
                            <div className="flex items-center gap-1.5">
                                {trend.value >= 0 ? (
                                    <TrendingUp className={cn("h-4 w-4", trend.positiveIsGood !== false ? "text-green-600" : "text-red-600")} />
                                ) : (
                                    <TrendingDown className={cn("h-4 w-4", trend.positiveIsGood !== false ? "text-red-600" : "text-green-600")} />
                                )}
                                <span className={cn(
                                    "text-sm font-medium",
                                    trend.value >= 0
                                        ? (trend.positiveIsGood !== false ? "text-green-600" : "text-red-600")
                                        : (trend.positiveIsGood !== false ? "text-red-600" : "text-green-600")
                                )}>
                                    {Math.abs(trend.value).toFixed(1)}% {trend.label}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
