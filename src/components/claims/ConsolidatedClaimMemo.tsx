import { useState } from 'react';
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
import { FilePlus, Info } from 'lucide-react';
import { useClaimMemo, useClaimMemoPreview } from '@/hooks/claims/useClaimMemo';
import { useActiveRole } from '@/hooks/useActiveRole';
import { isFinanceRole } from '@/lib/financeRoles';
import { ClaimMemoApprovalActions } from './ClaimMemoApprovalActions';
import { ClaimMemoApprovalTrail } from './ClaimMemoApprovalTrail';
import { formatCurrency } from '@/lib/otCalculations';
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

  const breakdown = memo?.type_breakdown ?? [];

  // Preview query for HR when no memo exists
  const { data: previewClaims = [], isLoading: previewLoading } = useClaimMemoPreview(
    month,
    year,
    canCreateMemo
  );

  // Aggregate preview claims by type for the preview table
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

  const previewRows = Object.values(previewByType);
  const previewTotal = previewRows.reduce((s, r) => s + r.total, 0);
  const previewCount = previewRows.reduce((s, r) => s + r.count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Claim Memo
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
          {canCreateMemo && previewClaims.length > 0 && (
            <Button onClick={() => createMemo()} disabled={isCreating}>
              <FilePlus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Memo'}
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
          /* ── Memo exists: show type breakdown ── */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Claim Type</TableHead>
                  <TableHead className="text-center w-[100px]">Claims</TableHead>
                  <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row) => (
                  <TableRow key={row.claim_type_id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-center">{row.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell>Grand Total</TableCell>
                  <TableCell className="text-center">{memo.claim_count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(memo.total_amount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : canCreateMemo && !previewLoading ? (
          /* ── No memo yet: show preview for HR ── */
          previewClaims.length > 0 ? (
            <div className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {previewCount} approved claim(s) totalling {formatCurrency(previewTotal)} found
                  for {MONTHS[month]} {year}. Click "Create Memo" to consolidate them.
                </AlertDescription>
              </Alert>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Claim Type</TableHead>
                      <TableHead className="text-center w-[100px]">Claims</TableHead>
                      <TableHead className="text-right min-w-[140px]">Total (RM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-center">{row.count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell>Grand Total</TableCell>
                      <TableCell className="text-center">{previewCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(previewTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No approved, unposted claims found for {MONTHS[month]} {year}.
            </p>
          )
        ) : !memo ? (
          <p className="text-muted-foreground text-sm">
            No claim memo for {MONTHS[month]} {year}.
          </p>
        ) : null}

        {memo && <ClaimMemoApprovalTrail memo={memo} />}
      </CardContent>
    </Card>
  );
}
