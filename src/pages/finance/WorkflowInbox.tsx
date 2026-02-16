import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { DashboardCard } from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Clock3, FileWarning, XCircle } from 'lucide-react';
import {
  useApprovalHistory,
  useApprovalWorkflows,
} from '@/hooks/finance/useFinanceFoundation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  FINANCE_APPROVAL_STATUS_LABELS,
  FINANCE_DOA_DOCUMENT_LABELS,
  type ApprovalWorkflow,
  type FinanceApprovalStatus,
} from '@/types/finance';

function statusVariant(status: FinanceApprovalStatus) {
  if (status === 'approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export default function WorkflowInbox() {
  const [statusFilter, setStatusFilter] = useState<FinanceApprovalStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState<'approve' | 'reject'>('approve');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const workflows = useApprovalWorkflows({ status: statusFilter, search });
  const history = useApprovalHistory(selectedWorkflow?.id);

  const stats = useMemo(() => {
    const rows = workflows.workflows;
    return {
      pending: rows.filter((row) => row.status === 'pending').length,
      approved: rows.filter((row) => row.status === 'approved').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
    };
  }, [workflows.workflows]);

  const openDecisionDialog = (workflow: ApprovalWorkflow, mode: 'approve' | 'reject') => {
    setSelectedWorkflow(workflow);
    setDecisionMode(mode);
    setDecisionRemarks('');
    setDecisionDialogOpen(true);
  };

  const submitDecision = async () => {
    if (selectedIds.size > 0) {
      for (const id of selectedIds) {
        await workflows.decideWorkflow({
          workflowId: id,
          decision: decisionMode,
          comments: decisionRemarks.trim() || undefined,
        });
      }
      setSelectedIds(new Set());
    } else if (selectedWorkflow) {
      await workflows.decideWorkflow({
        workflowId: selectedWorkflow.id,
        decision: decisionMode,
        comments: decisionRemarks.trim() || undefined,
      });
    }

    setDecisionDialogOpen(false);
    setDecisionRemarks('');
  };

  return (
    <AppLayout>
      <PageLayout
        title="Approval Inbox"
        description="Review and decide pending finance approvals routed by the DOA matrix across document types."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <DashboardCard title="Pending" value={stats.pending} subtitle="Awaiting action" icon={Clock3} />
          <DashboardCard title="Approved" value={stats.approved} subtitle="Decisions completed" icon={CheckCircle2} />
          <DashboardCard title="Rejected" value={stats.rejected} subtitle="Returned for revision" icon={FileWarning} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="approval-search">Search</Label>
                <Input
                  id="approval-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Document no, type, requester, company..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FinanceApprovalStatus | 'all')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending & Recent Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-md bg-muted/50 p-3">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    for (const id of selectedIds) {
                      await workflows.decideWorkflow({ workflowId: id, decision: 'approve' });
                    }
                    setSelectedIds(new Set());
                  }}
                  disabled={workflows.isDeciding}
                >
                  Approve Selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedWorkflow(null);
                    setDecisionMode('reject');
                    setDecisionRemarks('');
                    setDecisionDialogOpen(true);
                  }}
                  disabled={workflows.isDeciding}
                >
                  Reject Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}
            {!workflows.workflows.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No workflows found for this filter.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={selectedIds.size > 0 && selectedIds.size === workflows.workflows.filter(w => w.status === 'pending').length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(new Set(workflows.workflows.filter(w => w.status === 'pending').map(w => w.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.workflows.map((workflow) => (
                      <TableRow
                        key={workflow.id}
                        className={selectedWorkflow?.id === workflow.id ? 'bg-muted/40' : ''}
                      >
                        <TableCell>
                          {workflow.status === 'pending' && (
                            <Checkbox
                              checked={selectedIds.has(workflow.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                if (checked) next.add(workflow.id); else next.delete(workflow.id);
                                setSelectedIds(next);
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => setSelectedWorkflow(workflow)}
                          >
                            <div className="font-medium">{workflow.document_number || workflow.id.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground">
                              {FINANCE_DOA_DOCUMENT_LABELS[workflow.document_type]}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>{workflow.requester?.full_name || '-'}</TableCell>
                        <TableCell>{workflow.companies?.code || '-'}</TableCell>
                        <TableCell>Level {workflow.current_level}</TableCell>
                        <TableCell className="text-right">
                          {workflow.amount != null ? (
                            <span>{Number(workflow.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} {workflow.currency || 'MYR'}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(workflow.status)}>
                            {FINANCE_APPROVAL_STATUS_LABELS[workflow.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(workflow.submitted_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {workflow.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => openDecisionDialog(workflow, 'approve')} disabled={workflows.isDeciding}>
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openDecisionDialog(workflow, 'reject')}
                                disabled={workflows.isDeciding}
                              >
                                Reject
                              </Button>
                              {workflow.requested_by === user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    const db = supabase as any;
                                    await db.from('approval_workflows').update({ status: 'cancelled', remarks: 'Recalled by requester' }).eq('id', workflow.id).eq('status', 'pending');
                                    await db.from('approval_history').insert({
                                      workflow_id: workflow.id,
                                      approval_level: workflow.current_level,
                                      action: 'recalled',
                                      acted_by: user?.id,
                                      comments: 'Recalled by requester',
                                    });
                                    workflows.refetch();
                                  }}
                                >
                                  Recall
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedWorkflow(workflow)}>
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedWorkflow ? (
              <div className="py-4 text-sm text-muted-foreground">Select a workflow row to inspect approval history.</div>
            ) : !history.data?.length ? (
              <div className="py-4 text-sm text-muted-foreground">No decision history yet for this workflow.</div>
            ) : (
              <div className="space-y-3">
                {history.data.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium uppercase">{entry.action}</div>
                      <div className="text-xs text-muted-foreground">{new Date(entry.acted_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Level {entry.approval_level} by {entry.actor?.full_name || 'System'}
                    </div>
                    {entry.comments && <div className="mt-2 text-sm">{entry.comments}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {decisionMode === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {selectedIds.size > 0
                  ? `${decisionMode === 'approve' ? 'Approve' : 'Reject'} ${selectedIds.size} Document${selectedIds.size > 1 ? 's' : ''}`
                  : decisionMode === 'approve' ? 'Approve Document' : 'Reject Document'}
              </DialogTitle>
              <DialogDescription>
                {selectedIds.size > 0
                  ? `Batch ${decisionMode} for ${selectedIds.size} selected workflow${selectedIds.size > 1 ? 's' : ''}`
                  : selectedWorkflow
                  ? `${selectedWorkflow.document_number || selectedWorkflow.id.slice(0, 8)} (${FINANCE_DOA_DOCUMENT_LABELS[selectedWorkflow.document_type]})`
                  : 'Confirm your decision'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="decision-remarks">Remarks</Label>
              <Textarea
                id="decision-remarks"
                placeholder={decisionMode === 'approve' ? 'Optional approval note' : 'Provide rejection reason'}
                value={decisionRemarks}
                onChange={(event) => setDecisionRemarks(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDecisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={decisionMode === 'approve' ? 'default' : 'destructive'}
                disabled={workflows.isDeciding || (decisionMode === 'reject' && !decisionRemarks.trim())}
                onClick={submitDecision}
              >
                {workflows.isDeciding ? 'Submitting...' : decisionMode === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </AppLayout>
  );
}
