import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Claim, NextApproverOption } from '@/types/claims';
import { getClaimStatusDisplay, getClaimApproverName } from '@/types/claims';
import { StatusWithMetadata, getClaimApproverMetadata } from '@/components/StatusWithMetadata';
import { ClaimDetailsSheet } from '@/components/claims/ClaimDetailsSheet';
import { ClaimApprovalActions } from '@/components/claims/ClaimApprovalActions';

type TableRole = 'employee' | 'supervisor' | 'hr' | 'finance' | 'director' | 'gm' | 'head_finance';

/** Group claims by batch_id. Claims without batch_id stay individual. */
interface ClaimGroup {
  key: string; // batch_id or claim id
  ticket_number: string;
  claims: Claim[];
  totalAmount: number;
  typeNames: string[];
  earliestDate: string;
  submittedAt: string;
  status: string;
  /** Representative claim for status/profile info */
  representative: Claim;
}

function groupClaimsByBatch(claims: Claim[]): ClaimGroup[] {
  const batchMap = new Map<string, Claim[]>();
  const singles: Claim[] = [];

  for (const c of claims) {
    if (c.batch_id) {
      const existing = batchMap.get(c.batch_id) || [];
      existing.push(c);
      batchMap.set(c.batch_id, existing);
    } else {
      singles.push(c);
    }
  }

  const groups: ClaimGroup[] = [];

  for (const [batchId, batchClaims] of batchMap) {
    const sorted = batchClaims.sort((a, b) => new Date(a.claim_date).getTime() - new Date(b.claim_date).getTime());
    groups.push({
      key: batchId,
      ticket_number: sorted[0].ticket_number,
      claims: sorted,
      totalAmount: sorted.reduce((sum, c) => sum + Number(c.amount || 0), 0),
      typeNames: [...new Set(sorted.map((c) => c.claim_type?.name || c.claim_type_id))],
      earliestDate: sorted[0].claim_date,
      submittedAt: sorted[0].created_at,
      status: sorted[0].status,
      representative: sorted[0],
    });
  }

  for (const c of singles) {
    groups.push({
      key: c.id,
      ticket_number: c.ticket_number,
      claims: [c],
      totalAmount: Number(c.amount || 0),
      typeNames: [c.claim_type?.name || c.claim_type_id],
      earliestDate: c.claim_date,
      submittedAt: c.created_at,
      status: c.status,
      representative: c,
    });
  }

  // Sort by submitted date descending
  groups.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  return groups;
}

function isPendingForRole(role: TableRole, status: string) {
  if (role === 'supervisor') return status === 'pending_supervisor';
  if (role === 'finance') return status === 'pending_finance';
  if (role === 'hr') return status === 'pending_hr';
  if (role === 'director') return status === 'pending_director';
  if (role === 'gm') return status === 'pending_gm';
  if (role === 'head_finance') return status === 'pending_head_finance';
  return (
    status === 'pending_supervisor' ||
    status === 'pending_finance' ||
    status === 'pending_hr' ||
    status === 'pending_director' ||
    status === 'pending_gm' ||
    status === 'pending_head_finance'
  );
}

import { isClaimFullyApproved } from '@/types/claims';

function statusVariant(status: string) {
  if (isClaimFullyApproved(status as any)) return 'default';
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
  onForward,
  onReject,
  onCancel,
  onPost,
  isApproving,
  isForwarding,
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
  onForward?: (requestIds: string[], nextApprover: NextApproverOption, remarks?: string, approverUserId?: string) => Promise<void> | void;
  onReject?: (requestIds: string[], remarks: string) => Promise<void> | void;
  onCancel?: (requestId: string, reason?: string) => Promise<void> | void;
  onPost?: (claimId: string, reference?: string, remarks?: string) => Promise<void> | void;
  isApproving?: boolean;
  isForwarding?: boolean;
  isRejecting?: boolean;
  isCancelling?: boolean;
  isPosting?: boolean;
  showActions?: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeBatch, setActiveBatch] = useState<Claim[]>([]);
  const [open, setOpen] = useState(false);

  // Group all claims by batch
  const groups = useMemo(() => groupClaimsByBatch(requests), [requests]);

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

  const openDetails = (batch: Claim[]) => {
    setActiveBatch(batch);
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
              <TableHead>Receipt Date</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Amount (RM)</TableHead>
              <TableHead>Status</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const rep = g.representative;
              const employeeName = rep.profiles?.full_name || rep.employee_id;
              const isRowPending = isPendingForRole(role, rep.status);

              return (
                <TableRow key={g.key}>
                  {canBatch && (
                    <TableCell>
                      {isRowPending ? (
                        <Checkbox
                          checked={g.claims.every((c) => !!selected[c.id])}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = { ...prev };
                              for (const c of g.claims) next[c.id] = !!v;
                              return next;
                            })
                          }
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{g.ticket_number}</TableCell>
                  {role !== 'employee' && <TableCell>{employeeName}</TableCell>}
                  <TableCell>
                    {g.typeNames.join(', ')}
                    {g.claims.length > 1 && (
                      <span className="text-muted-foreground ml-1">({g.claims.length} items)</span>
                    )}
                  </TableCell>
                  <TableCell>{g.earliestDate ? format(new Date(g.earliestDate), 'dd MMM yyyy') : '—'}</TableCell>
                  <TableCell>{g.submittedAt ? format(new Date(g.submittedAt), 'dd MMM yyyy') : '—'}</TableCell>
                  <TableCell className="text-right">{g.totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusWithMetadata
                        status={rep.status}
                        label={getClaimStatusDisplay(rep.status)}
                        metadata={getClaimApproverMetadata(rep)}
                      />
                      {rep.is_posted && <Badge variant="secondary">posted</Badge>}
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => openDetails(g.claims)}>
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
        claims={activeBatch}
        open={open}
        onOpenChange={setOpen}
        role={role}
        onApprove={onApprove}
        onForward={onForward}
        onReject={onReject}
        onCancel={onCancel}
        onPost={onPost}
        isApproving={isApproving}
        isForwarding={isForwarding}
        isRejecting={isRejecting}
        isCancelling={isCancelling}
        isPosting={isPosting}
      />
    </div>
  );
}
