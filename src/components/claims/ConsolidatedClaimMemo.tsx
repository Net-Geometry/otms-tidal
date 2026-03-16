import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilePlus, Info, Download } from 'lucide-react';
import { useClaimMemo, useClaimMemoPreview } from '@/hooks/claims/useClaimMemo';
import { useActiveRole } from '@/hooks/useActiveRole';
import { isFinanceRole } from '@/lib/financeRoles';
import { ClaimMemoApprovalActions } from './ClaimMemoApprovalActions';
import { ClaimMemoApprovalTrail } from './ClaimMemoApprovalTrail';
import { formatCurrency } from '@/lib/otCalculations';
import { generateClaimMemoPDF } from '@/lib/claimMemoPdfGenerator';
import { CLAIM_MEMO_STATUS_LABELS } from '@/types/claims';
import type { ClaimMemoApprovalRole, ClaimMemoStatus } from '@/types/claims';

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 1 + i);

function getStatusBadgeVariant(
  status: ClaimMemoStatus
): 'default' | 'destructive' | 'secondary' {
  if (status === 'posted' || status === 'finance_approved') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function deriveApprovalRole(
  activeRole: string | null
): ClaimMemoApprovalRole {
  if (activeRole === 'management' || activeRole === 'director' || activeRole === 'gm' || activeRole === 'sgm' || activeRole === 'dmd')
    return 'management';
  if (isFinanceRole(activeRole) || activeRole === 'head_finance') return 'finance';
  return 'hr';
}

export function ConsolidatedClaimMemo() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const {
    memo,
    isLoading: memoLoading,
    createMemo,
    isCreating,
    deleteMemo,
    isDeleting,
    approveMemo,
    isApproving,
    rejectMemo,
    isRejecting,
    resubmitMemo,
    isResubmitting,
    postMemo,
    isPosting,
  } = useClaimMemo(month, year);

  const { activeRole } = useActiveRole();
  const approvalRole = deriveApprovalRole(activeRole);

  const canCreateMemo = !memo && !memoLoading && approvalRole === 'hr';
  const showRejectionAlert = memo?.status === 'rejected';

  const claimsBreakdown = memo?.type_breakdown ?? [];
  const otBreakdown = memo?.ot_breakdown ?? [];
  const allowanceBreakdown = memo?.allowance_breakdown ?? [];

  // Preview query for HR when no memo exists
  const { data: preview, isLoading: previewLoading } = useClaimMemoPreview(
    month,
    year,
    canCreateMemo
  );

  const previewClaims = preview?.claims ?? [];
  const previewOT = preview?.otRequests ?? [];
  const previewAllowances = preview?.allowances ?? [];

  // Aggregate preview claims by type
  const previewByType = canCreateMemo
    ? previewClaims.reduce<Record<string, { name: string; count: number; total: number }>>((acc, c: any) => {
        const typeId = c.claim_type_id;
        if (!acc[typeId]) {
          acc[typeId] = { name: c.claim_types?.name ?? 'Unknown', count: 0, total: 0 };
        }
        acc[typeId].count += 1;
        acc[typeId].total += Number(c.amount || 0);
        return acc;
      }, {})
    : {};

  const previewClaimRows = Object.values(previewByType);
  const previewClaimTotal = previewClaimRows.reduce((s, r) => s + r.total, 0);

  // Aggregate preview OT by employee
  const previewOTByEmployee = canCreateMemo
    ? previewOT.reduce<Record<string, { name: string; hours: number; amount: number }>>((acc, ot: any) => {
        const empId = ot.employee_id;
        if (!acc[empId]) {
          acc[empId] = { name: ot.profiles?.full_name ?? 'Unknown', hours: 0, amount: 0 };
        }
        acc[empId].hours += Number(ot.total_hours || 0);
        acc[empId].amount += Number(ot.ot_amount || 0);
        return acc;
      }, {})
    : {};

  const previewOTRows = Object.values(previewOTByEmployee);
  const previewOTTotal = previewOTRows.reduce((s, r) => s + r.amount, 0);

  // Aggregate preview allowances by type
  const previewAllowByType = canCreateMemo
    ? previewAllowances.reduce<Record<string, { name: string; count: number; total: number }>>((acc, a: any) => {
        const typeId = a.allowance_type_id;
        if (!acc[typeId]) {
          acc[typeId] = { name: a.allowance_types?.name ?? 'Unknown', count: 0, total: 0 };
        }
        acc[typeId].count += 1;
        acc[typeId].total += Number(a.amount || 0);
        return acc;
      }, {})
    : {};

  const previewAllowRows = Object.values(previewAllowByType);
  const previewAllowTotal = previewAllowRows.reduce((s, r) => s + r.total, 0);

  const previewGrandTotal = previewClaimTotal + previewOTTotal + previewAllowTotal;
  const hasPreviewData = previewClaims.length > 0 || previewOT.length > 0 || previewAllowances.length > 0;

  // Company profile for PDF
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile-memo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_profile').select('*').single();
      if (error) throw error;
      return data as { name: string; registration_no: string; address: string; phone: string; logo_url: string | null };
    },
    staleTime: 60 * 1000,
  });

  // Fetch approver names for PDF signatures
  const approverIds = memo ? [memo.hr_id, memo.director_id, memo.finance_id].filter(Boolean) : [];
  const { data: approverProfiles } = useQuery({
    queryKey: ['memo-approver-profiles', ...approverIds],
    queryFn: async () => {
      if (approverIds.length === 0) return {};
      const db = supabase as any;
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, position_id, positions(name), department_id, departments(name)')
        .in('id', approverIds);
      if (error) throw error;
      const map: Record<string, { full_name: string; position: string; department: string }> = {};
      for (const p of (data || []) as any[]) {
        map[p.id] = {
          full_name: p.full_name,
          position: p.positions?.name ?? '',
          department: p.departments?.name ?? '',
        };
      }
      return map;
    },
    enabled: approverIds.length > 0,
    staleTime: 30 * 1000,
  });

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!memo || !companyProfile) return;
    setIsDownloading(true);
    try {
      const hrProfile = memo.hr_id && approverProfiles?.[memo.hr_id];
      const directorProfile = memo.director_id && approverProfiles?.[memo.director_id];
      const financeProfile = memo.finance_id && approverProfiles?.[memo.finance_id];

      await generateClaimMemoPDF({
        company: companyProfile,
        memo,
        approvers: {
          prepared_by: hrProfile
            ? { name: hrProfile.full_name, title: hrProfile.position, department: hrProfile.department }
            : null,
          reviewed_by: directorProfile
            ? { name: directorProfile.full_name, title: directorProfile.position, department: directorProfile.department }
            : null,
          approved_by: financeProfile
            ? { name: financeProfile.full_name, title: financeProfile.position }
            : null,
        },
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Claim, OT & Allowance Memo
              {memo && (
                <Badge variant={getStatusBadgeVariant(memo.status)}>
                  {CLAIM_MEMO_STATUS_LABELS[memo.status]}
                </Badge>
              )}
            </CardTitle>
            {memo && (
              <p className="text-sm text-muted-foreground mt-1">
                {memo.memo_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="claim-memo-month">Month</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger id="claim-memo-month" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.slice(1).map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="claim-memo-year">Year</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger id="claim-memo-year" className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {canCreateMemo && (
            <Button onClick={() => createMemo()} disabled={isCreating || !hasPreviewData}>
              <FilePlus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Generate & Submit Memo'}
            </Button>
          )}
          {memo && (
            <ClaimMemoApprovalActions
              memo={memo}
              role={approvalRole}
              onApprove={approveMemo}
              onReject={rejectMemo}
              onResubmit={resubmitMemo}
              onPost={postMemo}
              onDelete={deleteMemo}
              isApproving={isApproving}
              isRejecting={isRejecting}
              isResubmitting={isResubmitting}
              isPosting={isPosting}
              isDeleting={isDeleting}
            />
          )}
          {memo && (
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isDownloading || !companyProfile}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {showRejectionAlert && memo && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="font-semibold">Memo rejected</span>
              {memo.rejection_stage && (
                <> at the <strong>{memo.rejection_stage}</strong> stage</>
              )}
              {memo.rejection_remarks && <>: {memo.rejection_remarks}</>}
            </AlertDescription>
          </Alert>
        )}

        {memoLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : memo ? (
          /* ── Memo exists: show all sections ── */
          <>
            {/* Claims Section */}
            {claimsBreakdown.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Claims</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Claim Type</TableHead>
                        <TableHead className="text-center w-[100px]">Count</TableHead>
                        <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claimsBreakdown.map((row) => (
                        <TableRow key={row.claim_type_id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="text-center">{row.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Claims Subtotal</TableCell>
                        <TableCell className="text-center">{memo.claim_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(memo.total_amount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* OT Section */}
            {otBreakdown.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overtime (OT)</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Employee</TableHead>
                        <TableHead className="text-center w-[100px]">Hours</TableHead>
                        <TableHead className="text-right min-w-[140px]">Amount (RM)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otBreakdown.map((row) => (
                        <TableRow key={row.employee_id}>
                          <TableCell>{row.employee_name}</TableCell>
                          <TableCell className="text-center">{row.hours.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>OT Subtotal</TableCell>
                        <TableCell className="text-center">{memo.ot_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(memo.ot_total_amount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Allowance Section */}
            {allowanceBreakdown.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Allowances</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Allowance Type</TableHead>
                        <TableHead className="text-center w-[100px]">Count</TableHead>
                        <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allowanceBreakdown.map((row) => (
                        <TableRow key={row.allowance_type_id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="text-center">{row.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Allowances Subtotal</TableCell>
                        <TableCell className="text-center">{memo.allowance_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(memo.allowance_total_amount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  <TableRow className="font-bold text-base bg-primary/5">
                    <TableCell className="min-w-[200px]">Grand Total</TableCell>
                    <TableCell className="text-center w-[100px]" />
                    <TableCell className="text-right min-w-[140px]">{formatCurrency(memo.grand_total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        ) : canCreateMemo && !previewLoading ? (
          /* ── No memo yet: show preview for HR ── */
          hasPreviewData ? (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Preview for {MONTHS[month]} {year} — Grand Total: {formatCurrency(previewGrandTotal)}.
                  Click "Create Memo" to consolidate.
                </AlertDescription>
              </Alert>

              {/* Preview Claims */}
              {previewClaimRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Claims</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Claim Type</TableHead>
                          <TableHead className="text-center w-[100px]">Count</TableHead>
                          <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewClaimRows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-center">{row.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>Claims Subtotal</TableCell>
                          <TableCell className="text-center">{previewClaims.length}</TableCell>
                          <TableCell className="text-right">{formatCurrency(previewClaimTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Preview OT */}
              {previewOTRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overtime (OT)</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Employee</TableHead>
                          <TableHead className="text-center w-[100px]">Hours</TableHead>
                          <TableHead className="text-right min-w-[140px]">Amount (RM)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewOTRows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-center">{row.hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>OT Subtotal</TableCell>
                          <TableCell className="text-center">{previewOT.length}</TableCell>
                          <TableCell className="text-right">{formatCurrency(previewOTTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Preview Allowances */}
              {previewAllowRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Allowances</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Allowance Type</TableHead>
                          <TableHead className="text-center w-[100px]">Count</TableHead>
                          <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewAllowRows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-center">{row.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>Allowances Subtotal</TableCell>
                          <TableCell className="text-center">{previewAllowances.length}</TableCell>
                          <TableCell className="text-right">{formatCurrency(previewAllowTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No approved claims, OT, or allowances found for {MONTHS[month]} {year}.
            </p>
          )
        ) : !memo ? (
          <p className="text-muted-foreground text-sm">
            No memo for {MONTHS[month]} {year}.
          </p>
        ) : null}

        {memo && <ClaimMemoApprovalTrail memo={memo} />}
      </CardContent>
    </Card>
  );
}
