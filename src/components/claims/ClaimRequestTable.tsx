import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Claim } from '@/types/claims';
import { ClaimDetailsSheet } from '@/components/claims/ClaimDetailsSheet';
import { ClaimApprovalActions } from '@/components/claims/ClaimApprovalActions';

type TableRole = 'employee' | 'supervisor' | 'hr' | 'finance';

function isPendingForRole(role: TableRole, status: string) {
  if (role === 'supervisor') return status === 'pending_supervisor';
  if (role === 'hr') return status === 'pending_hr' || status === 'supervisor_approved';
  if (role === 'finance') return status === 'pending_finance';
  return (
    status === 'pending_supervisor' ||
    status === 'supervisor_approved' ||
    status === 'pending_hr' ||
    status === 'pending_finance'
  );
}

function statusVariant(status: string) {
  if (status === 'finance_approved' || status === 'hr_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export function ClaimRequestTable({
  requests,
  isLoading,
  role,
  enableBatch,
  onApprove,
  onReject,
  onCancel,
  onPost,
  isApproving,
  isRejecting,
  isCancelling,
  isPosting,
  showActions = true,
}: {
  requests: Claim[];
  isLoading: boolean;
  role: TableRole;
  enableBatch?: boolean;
  onApprove?: (requestIds: string[], remarks?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  onPost?: (claimId: string, reference?: string, remarks?: string) => Promise<void> | void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
  isPosting?: boolean;
  showActions?: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<Claim | null>(null);
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

  const openDetails = (req: Claim) => {
    setActive(req);
    setOpen(true);
  };

  const canBatch = !!enableBatch && role !== 'employee' && !!onApprove && !!onReject;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (!requests || requests.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No claims found.</div>;
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
            <div className="text-sm">Select all pending ({pendingIds.length})</div>
          </div>
          <div className="flex items-center gap-2">
            <ClaimApprovalActions
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
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount (RM)</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const typeName = r.claim_type?.name || r.claim_type_id;
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
                  <TableCell>{r.claim_date ? format(new Date(r.claim_date), 'dd MMM yyyy') : '—'}</TableCell>
                  <TableCell className="text-right">{Number(r.amount || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(r.status) as any}>{String(r.status).replace(/_/g, ' ')}</Badge>
                      {r.is_posted && <Badge variant="secondary">posted</Badge>}
                    </div>
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

      <ClaimDetailsSheet
        request={active}
        open={open}
        onOpenChange={setOpen}
        role={role}
        onApprove={onApprove}
        onReject={onReject}
        onCancel={onCancel}
        onPost={onPost}
        isApproving={isApproving}
        isRejecting={isRejecting}
        isCancelling={isCancelling}
        isPosting={isPosting}
      />
    </div>
  );
}
