import { Separator } from '@/components/ui/separator';
import type { PayrollMemo } from '@/types/payroll';

interface MemoApprovalTrailProps {
  memo: PayrollMemo;
}

export function MemoApprovalTrail({ memo }: MemoApprovalTrailProps) {
  const hasApproval =
    memo.hr_approved_at || memo.director_approved_at || memo.finance_approved_at;
  const hasRejection = memo.rejected_at;
  const hasPosted = memo.is_posted && memo.posted_at;

  if (!hasApproval && !hasRejection && !hasPosted) {
    return null;
  }

  return (
    <>
      {hasApproval && (
        <>
          <Separator />
          <div className="text-sm space-y-2">
            <p className="font-semibold">Approval Trail</p>
            {memo.hr_approved_at && (
              <p className="text-muted-foreground">
                HR submitted on {new Date(memo.hr_approved_at).toLocaleDateString()}
                {memo.hr_remarks && ` — "${memo.hr_remarks}"`}
              </p>
            )}
            {memo.director_approved_at && (
              <p className="text-muted-foreground">
                Director approved on {new Date(memo.director_approved_at).toLocaleDateString()}
                {memo.director_remarks && ` — "${memo.director_remarks}"`}
              </p>
            )}
            {memo.finance_approved_at && (
              <p className="text-muted-foreground">
                Finance approved on {new Date(memo.finance_approved_at).toLocaleDateString()}
                {memo.finance_remarks && ` — "${memo.finance_remarks}"`}
              </p>
            )}
          </div>
        </>
      )}

      {hasRejection && (
        <>
          <Separator />
          <div className="text-sm">
            <p className="text-destructive font-medium">
              Rejected at {memo.rejection_stage} stage on{' '}
              {new Date(memo.rejected_at!).toLocaleDateString()}
            </p>
            {memo.rejection_remarks && (
              <p className="text-muted-foreground mt-1">Reason: {memo.rejection_remarks}</p>
            )}
          </div>
        </>
      )}

      {hasPosted && (
        <>
          <Separator />
          <div className="text-sm">
            <p className="text-green-600 font-medium">
              Posted on {new Date(memo.posted_at!).toLocaleDateString()}
            </p>
          </div>
        </>
      )}
    </>
  );
}
