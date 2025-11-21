import { useState } from 'react';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { OTRequest } from '@/types/otms';
import { formatCurrency, formatHours } from '@/lib/otCalculations';
import { OTApprovalDetailsSheet } from './OTApprovalDetailsSheet';
import { Badge } from '@/components/ui/badge';

interface OTApprovalTableProps {
  requests: OTRequest[];
  isLoading: boolean;
}

export function OTApprovalTable({ requests, isLoading }: OTApprovalTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<OTRequest | null>(null);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No OT requests found
      </div>
    );
  }

  const getDayTypeBadge = (dayType: string) => {
    const variants: Record<string, string> = {
      weekday: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      saturday: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      sunday: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      public_holiday: 'bg-red-500/10 text-red-600 dark:text-red-400',
    };
    
    return (
      <Badge variant="outline" className={variants[dayType]}>
        {dayType.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>OT Date</TableHead>
              <TableHead>Day Type</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <span className="font-mono text-sm font-medium text-primary">
                    {request.ticket_number}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{request.employee_id}</div>
                  </div>
                </TableCell>
                <TableCell>{format(new Date(request.ot_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{getDayTypeBadge(request.day_type)}</TableCell>
                <TableCell>{formatHours(request.total_hours)} hrs</TableCell>
                <TableCell>{formatCurrency(request.ot_amount || 0)}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status} rejectionStage={request.rejection_stage} />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OTApprovalDetailsSheet
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      />
    </>
  );
}
