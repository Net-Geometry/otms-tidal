import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StateCodeBadge } from '@/components/hr/calendar/StateCodeBadge';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export interface HolidayItem {
  id?: string;
  holiday_date: string;
  description: string;
  state_code?: string | null;
  temp_id?: string;
}

interface HolidayItemsTableProps {
  items: HolidayItem[];
  onRemove?: (index: number) => void;
  readOnly?: boolean;
}

export function HolidayItemsTable({ items, onRemove, readOnly = false }: HolidayItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        No holidays added yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">No.</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Day</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>State</TableHead>
            {!readOnly && <TableHead className="w-20"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id || item.temp_id || index}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>
                {format(new Date(item.holiday_date + 'T00:00:00'), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                {format(new Date(item.holiday_date + 'T00:00:00'), 'EEEE')}
              </TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>
                {item.state_code && (
                  <StateCodeBadge code={item.state_code} />
                )}
              </TableCell>
              {!readOnly && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove?.(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
