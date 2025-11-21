import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface TableCardField {
  label: string;
  value: ReactNode;
  variant?: 'default' | 'badge' | 'muted' | 'highlight';
  className?: string;
}

export interface TableCardConfig {
  title: ReactNode;
  subtitle?: ReactNode;
  fields: TableCardField[];
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

interface ResponsiveTableProps {
  children: ReactNode;
  cardConfig?: {
    render: (data: any) => TableCardConfig;
    data: any[];
    emptyMessage?: ReactNode;
  };
}

/**
 * ResponsiveTable wrapper that automatically switches between table (desktop) and card grid (mobile)
 *
 * Usage:
 * <ResponsiveTable
 *   cardConfig={{
 *     data: items,
 *     render: (item) => ({
 *       title: item.name,
 *       fields: [
 *         { label: 'Email', value: item.email },
 *         { label: 'Status', value: item.status, variant: 'badge' }
 *       ],
 *       actions: <ActionButtons item={item} />
 *     })
 *   }}
 * >
 *   <Table>... your table content ...</Table>
 * </ResponsiveTable>
 */
export function ResponsiveTable({ children, cardConfig }: ResponsiveTableProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  if (!cardConfig) {
    return <>{children}</>;
  }

  const { data, render, emptyMessage } = cardConfig;

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage || 'No data found'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const config = render(item);
        return (
          <TableCard key={index} config={config} />
        );
      })}
    </div>
  );
}

interface TableCardProps {
  config: TableCardConfig;
}

function TableCard({ config }: TableCardProps) {
  const { title, subtitle, fields, actions, onClick, className } = config;

  return (
    <Card
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex-shrink-0 flex gap-2">
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      {fields.length > 0 && (
        <CardContent className="space-y-2">
          {fields.map((field, idx) => (
            <TableCardField key={idx} field={field} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

interface TableCardFieldProps {
  field: TableCardField;
}

function TableCardField({ field }: TableCardFieldProps) {
  const { label, value, variant = 'default', className } = field;

  const valueContent = (() => {
    switch (variant) {
      case 'badge':
        return <Badge variant="secondary">{value}</Badge>;
      case 'muted':
        return <span className="text-sm text-muted-foreground">{value}</span>;
      case 'highlight':
        return <span className="text-sm font-medium text-foreground">{value}</span>;
      default:
        return <span className="text-sm">{value}</span>;
    }
  })();

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className="text-right flex-shrink-0">{valueContent}</div>
    </div>
  );
}
