import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { ContentLoadingSkeleton } from '@/components/ContentLoadingSkeleton';
import { ClaimSubmitForm, type ClaimSubmitFormValues } from '@/components/claims/ClaimSubmitForm';
import { ClaimRequestTable } from '@/components/claims/ClaimRequestTable';
import { useClaimTypes } from '@/hooks/claims/useClaimTypes';
import { useClaimSubmit } from '@/hooks/claims/useClaimSubmit';
import { useClaimRequests } from '@/hooks/claims/useClaimRequests';

export default function ClaimSubmit() {
  const navigate = useNavigate();
  const { data: claimTypes = [], isLoading: typesLoading } = useClaimTypes();
  const submit = useClaimSubmit();
  const history = useClaimRequests({ filter: 'all' });

  const isLoading = typesLoading;
  if (isLoading) {
    return (
      <AppLayout>
        <ContentLoadingSkeleton />
      </AppLayout>
    );
  }

  const handleSubmit = async (values: ClaimSubmitFormValues) => {
    await submit.mutateAsync({
      items: values.items.map((item) => ({
        claim_type_id: item.claim_type_id,
        claim_date: item.claim_date,
        amount: item.amount,
        purpose: item.purpose,
        receipt_urls: item.receipt_urls,
      })),
    });
    navigate('/claims/history');
  };

  return (
    <AppLayout>
      <PageLayout
        title="Submit Claim"
        description="Submit a new claim and review your recent claim history."
        onBack={() => navigate('/dashboard')}
      >
        <div className="space-y-6">
          <ClaimSubmitForm
            claimTypes={claimTypes}
            onSubmit={handleSubmit}
            isSubmitting={submit.isPending}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">Recent Claims</div>
                <div className="text-sm text-muted-foreground">Your latest submissions</div>
              </div>
            </div>
            <ClaimRequestTable
              requests={(history.data || []).slice(0, 10)}
              isLoading={history.isLoading}
              role="employee"
              enableBatch={false}
              onCancel={async (requestId, reason) => {
                await history.cancelClaimRequest({ requestId, reason });
              }}
              isCancelling={history.isCancelling}
            />
          </div>
        </div>
      </PageLayout>
    </AppLayout>
  );
}
