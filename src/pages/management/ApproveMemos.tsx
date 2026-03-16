import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { ConsolidatedClaimMemo } from '@/components/claims/ConsolidatedClaimMemo';

export default function ApproveMemos() {
  return (
    <AppLayout>
      <PageLayout
        title="Approve Memos"
        description="Review and approve consolidated claim, OT, and allowance memos."
      >
        <ConsolidatedClaimMemo />
      </PageLayout>
    </AppLayout>
  );
}
