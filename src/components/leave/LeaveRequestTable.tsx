import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { LeaveRequest } from '@/types/leave';
import { getLeaveStatusDisplay, getLeaveApproverName } from '@/types/leave';
import { StatusWithMetadata, getLeaveApproverMetadata } from '@/components/StatusWithMetadata';
import { LeaveRequestDetailsSheet } from '@/components/leave/LeaveRequestDetailsSheet';
import { LeaveApprovalActions } from '@/components/leave/LeaveApprovalActions';

type TableRole = 'employee' | 'supervisor' | 'hr' | 'management';

function isPendingForRole(role: TableRole, status: string) {
  if (role === 'supervisor') return status === 'pending_supervisor';
  if (role === 'hr') return status === 'pending_hr' || status === 'supervisor_approved';
  if (role === 'management') return status === 'hr_approved' || status === 'pending_management';
  return status === 'pending_supervisor' || status === 'pending_hr' || status === 'supervisor_approved' || status === 'hr_approved' || status === 'pending_management';
}

function statusVariant(status: string) {
  if (status === 'management_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export function LeaveRequestTable({
  requests,
  isLoading,
  role,
  enableBatch,
  onApprove,
  onReject,
  onCancel,
  isApproving,
  isRejecting,
  isCancelling,
  showActions = true,
}: {
  requests: LeaveRequest[];
  isLoading: boolean;
  role: TableRole;
  enableBatch?: boolean;
  onApprove?: (requestIds: string[], remarks?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
  showActions?: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<LeaveRequest | null>(null);
  const [open, setOpen] = useState(false);

  const pendingIds = useMemo(() => {
    return requests.filter((r) => isPendingForRole(role, r.status)).map((r) => r.id);
  }, [requests, role]);

  const selectedIds = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id)
      .filter((id) => pendingIds.includes(id));
  }, [pendingIds, selected]);

  const selectAllPending = (value: boolean) => {
    if (!value) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const id of pendingIds) next[id] = true;
    setSelected(next);
  };

  const openDetails = (req: LeaveRequest) => {
    setActive(req);
    setOpen(true);
  };

  const canBatch = !!enableBatch && role !== 'employee' && !!onApprove && !!onReject;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (!requests || requests.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No leave requests found.</div>;
  }

  return (
    <div className="space-y-4">
      {canBatch && pendingIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.length > 0 && selectedIds.length === pendingIds.length}
              onCheckedChange={(v) => selectAllPending(!!v)}
            />
            <div className="text-sm">
              Select all pending ({pendingIds.length})
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LeaveApprovalActions
              approveLabel="Approve Selected"
              rejectLabel="Reject Selected"
              onApprove={async (remarks) => {
                if (!onApprove) return;
                if (selectedIds.length === 0) return;
                await onApprove(selectedIds, remarks);
                setSelected({});
              }}
              onReject={async (remarks) => {
                if (!onReject) return;
                if (selectedIds.length === 0) return;
                await onReject(selectedIds, remarks);
                setSelected({});
              }}
              isApproving={isApproving}
              isRejecting={isRejecting}
            />
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {canBatch && <TableHead className="w-10"></TableHead>}
              <TableHead>Ticket</TableHead>
              {role !== 'employee' && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const typeName = r.leave_type?.name || r.leave_type_id;
              const employeeName = r.profiles?.full_name || r.employee_id;
              const isRowPending = isPendingForRole(role, r.status);

              return (
                <TableRow key={r.id}>
                  {canBatch && (
                    <TableCell>
                      {isRowPending ? (
                        <Checkbox
                          checked={!!selected[r.id]}
                          onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [r.id]: !!v }))}
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{r.ticket_number}</TableCell>
                  {role !== 'employee' && <TableCell>{employeeName}</TableCell>}
                  <TableCell>{typeName}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(r.start_date), 'dd MMM yyyy')} - {format(new Date(r.end_date), 'dd MMM yyyy')}
                    </div>
                    {r.is_half_day && <div className="text-xs text-muted-foreground">Half-day ({r.half_day_period || '—'})</div>}
                  </TableCell>
                  <TableCell className="text-right">{Number(r.total_days || 0).toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusWithMetadata 
                      status={r.status} 
                      label={getLeaveStatusDisplay(r.status)}
                      metadata={getLeaveApproverMetadata(r)}
                    />
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => openDetails(r)}>
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <LeaveRequestDetailsSheet
        request={active}
        open={open}
        onOpenChange={setOpen}
        role={role}
        onApprove={onApprove}
        onReject={onReject}
        onCancel={onCancel}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isCancelling={isCancelling}
      />
    </div>
  );
}
